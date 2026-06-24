from __future__ import annotations

from dataclasses import dataclass
import mimetypes

import httpx
from fastapi import HTTPException, status
from google.auth.exceptions import RefreshError
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from app.config import settings
from app.crypto import decrypt_token_data, encrypt_token_data
from app.models import Event, FaceEmbedding, Photo, Photographer
from app.schemas import DriveFolderListResponse, DriveFolderResponse, normalize_drive_folder_id

IMAGE_MIME_PREFIX = "image/"
FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"


@dataclass
class DriveSyncResult:
    scanned: int
    created: int
    updated: int
    deleted: int
    photos_total: int


def _google_tokens(photographer: Photographer) -> dict:
    if not photographer.google_oauth_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Drive access not connected for this photographer",
        )

    try:
        payload = decrypt_token_data(settings.secret_key, photographer.google_oauth_token)
    except Exception as exc:  # pragma: no cover - defensive for bad stored secrets
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored Drive credentials could not be decrypted",
        ) from exc

    if not payload.get("provider_token") and not payload.get("provider_refresh_token"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Drive credentials are incomplete. Sign in again to reconnect Google Drive.",
        )

    return payload


def _refresh_access_token(refresh_token: str) -> str:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Google token expired and backend refresh is not configured yet. "
                "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or sign in again."
            ),
        )

    response = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=15.0,
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google Drive access expired. Please sign in again.",
        )

    body = response.json()
    access_token = body.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google Drive token refresh did not return an access token",
        )
    return access_token


def _google_credentials(tokens: dict) -> Credentials:
    access_token = tokens.get("provider_token")
    refresh_token = tokens.get("provider_refresh_token")

    credentials = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id or None,
        client_secret=settings.google_client_secret or None,
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )

    if not access_token and refresh_token:
        credentials.token = _refresh_access_token(refresh_token)

    return credentials


def _store_refreshed_access_token(db: Session, photographer: Photographer, tokens: dict) -> dict:
    refresh_token = tokens.get("provider_refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google Drive access expired. Please sign in again.",
        )

    access_token = _refresh_access_token(refresh_token)
    tokens["provider_token"] = access_token
    photographer.google_oauth_token = encrypt_token_data(settings.secret_key, tokens)
    db.commit()
    return tokens


def _drive_service(photographer: Photographer, db: Session):
    tokens = _google_tokens(photographer)
    refresh_token = tokens.get("provider_refresh_token")
    credentials = _google_credentials(tokens)

    try:
        return build("drive", "v3", credentials=credentials, cache_discovery=False), tokens
    except Exception:
        if not refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google Drive access expired. Please sign in again.",
            )

    tokens = _store_refreshed_access_token(db, photographer, tokens)
    credentials = _google_credentials(tokens)
    return build("drive", "v3", credentials=credentials, cache_discovery=False), tokens


def build_drive_service_for_photographer(photographer: Photographer, db: Session):
    drive, _tokens = _drive_service(photographer, db)
    return drive


def download_photo_bytes(db: Session, photographer: Photographer, photo: Photo) -> bytes:
    drive, tokens = _drive_service(photographer, db)

    try:
        request = drive.files().get_media(fileId=photo.drive_file_id, supportsAllDrives=True)
        return request.execute()
    except RefreshError:
        tokens = _store_refreshed_access_token(db, photographer, tokens)
        drive = build("drive", "v3", credentials=_google_credentials(tokens), cache_discovery=False)
        try:
            request = drive.files().get_media(fileId=photo.drive_file_id, supportsAllDrives=True)
            return request.execute()
        except RefreshError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google Drive access expired. Please sign in again.",
            ) from exc
    except HttpError as exc:
        status_code = getattr(exc.resp, "status", None)
        if status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found on Google Drive anymore.",
            ) from exc
        if status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google Drive access expired or was denied. Sign in again to reconnect Drive.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to download photo from Google Drive.",
        ) from exc


def delete_photo_record(db: Session, photo: Photo) -> None:
    db.query(FaceEmbedding).filter(FaceEmbedding.photo_id == photo.id).delete(synchronize_session=False)
    db.delete(photo)
    db.commit()

def guess_photo_content_type(photo: Photo) -> str:
    content_type, _encoding = mimetypes.guess_type(photo.filename)
    return content_type or "image/jpeg"


def _thumbnail_url(file_id: str, api_thumbnail: str | None) -> str:
    if api_thumbnail:
        separator = "&" if "?" in api_thumbnail else "?"
        return f"{api_thumbnail}{separator}sz=w800"
    return f"https://drive.google.com/thumbnail?id={file_id}&sz=w800"


def list_drive_folders(
    db: Session,
    photographer: Photographer,
    parent_id: str | None = None,
) -> DriveFolderListResponse:
    drive, tokens = _drive_service(photographer, db)
    normalized_parent = parent_id.strip() if parent_id else "root"
    current_folder_id = normalized_parent
    current_folder_name = "My Drive"
    parent_folder_id: str | None = None

    try:
        if normalized_parent != "root":
            current_folder = (
                drive.files()
                .get(
                    fileId=normalized_parent,
                    fields="id,name,parents,mimeType",
                    supportsAllDrives=True,
                )
                .execute()
            )
            if current_folder.get("mimeType") != FOLDER_MIME_TYPE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected Drive item is not a folder.",
                )
            current_folder_name = current_folder.get("name") or "Folder"
            parent_folder_id = (current_folder.get("parents") or [None])[0]

        response = (
            drive.files()
            .list(
                q=(
                    f"'{normalized_parent}' in parents and trashed = false "
                    f"and mimeType = '{FOLDER_MIME_TYPE}'"
                ),
                fields="files(id,name)",
                orderBy="folder,name_natural",
                pageSize=100,
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
            )
            .execute()
        )
    except HttpError as exc:
        status_code = getattr(exc.resp, "status", None)
        if status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google Drive folder not found or no longer accessible.",
            ) from exc
        if status_code in {401, 403}:
            refresh_token = tokens.get("provider_refresh_token")
            if not refresh_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google Drive access expired. Please sign in again.",
                ) from exc
            refreshed_tokens = _store_refreshed_access_token(db, photographer, tokens)
            drive = build("drive", "v3", credentials=_google_credentials(refreshed_tokens), cache_discovery=False)
            return list_drive_folders(db, photographer, parent_id=parent_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to browse Google Drive folders.",
        ) from exc

    folders = sorted(response.get("files", []), key=lambda item: item.get("name", "").lower())
    return DriveFolderListResponse(
        current_folder_id=current_folder_id,
        current_folder_name=current_folder_name,
        parent_folder_id=parent_folder_id,
        folders=[
            DriveFolderResponse(id=item["id"], name=item.get("name") or "Untitled folder")
            for item in folders
        ],
    )


def sync_event_photos(db: Session, photographer: Photographer, event: Event) -> DriveSyncResult:
    drive, tokens = _drive_service(photographer, db)
    folder_id = normalize_drive_folder_id(event.drive_folder_id)

    if folder_id != event.drive_folder_id:
        event.drive_folder_id = folder_id
        db.commit()

    created = 0
    updated = 0
    scanned = 0
    deleted = 0
    synced_drive_file_ids: set[str] = set()
    page_token: str | None = None

    while True:
        try:
            response = (
                drive.files()
                .list(
                    q=(
                        f"'{folder_id}' in parents and trashed = false "
                        f"and mimeType contains '{IMAGE_MIME_PREFIX}'"
                    ),
                    fields="nextPageToken, files(id, name, mimeType, webViewLink, thumbnailLink)",
                    pageSize=200,
                    pageToken=page_token,
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                )
                .execute()
            )
        except HttpError as exc:
            status_code = getattr(exc.resp, "status", None)
            if status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Google Drive folder not found. Use the folder ID or folder URL "
                        "for a folder your signed-in Google account can access."
                    ),
                ) from exc

            refresh_token = tokens.get("provider_refresh_token")
            if not refresh_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google Drive request failed. Please sign in again.",
                )

            drive = build(
                "drive",
                "v3",
                credentials=_google_credentials(_store_refreshed_access_token(db, photographer, tokens)),
                cache_discovery=False,
            )
            response = (
                drive.files()
                .list(
                    q=(
                        f"'{folder_id}' in parents and trashed = false "
                        f"and mimeType contains '{IMAGE_MIME_PREFIX}'"
                    ),
                    fields="nextPageToken, files(id, name, mimeType, webViewLink, thumbnailLink)",
                    pageSize=200,
                    pageToken=page_token,
                    includeItemsFromAllDrives=True,
                    supportsAllDrives=True,
                )
                .execute()
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google Drive sync failed unexpectedly. Please try again.",
            ) from exc

        for item in response.get("files", []):
            scanned += 1
            synced_drive_file_ids.add(item["id"])
            photo = db.query(Photo).filter(Photo.drive_file_id == item["id"]).first()

            thumbnail_url = _thumbnail_url(item["id"], item.get("thumbnailLink"))
            drive_url = item.get("webViewLink") or f"https://drive.google.com/file/d/{item['id']}/view"

            if photo is None:
                photo = Photo(
                    event_id=event.id,
                    drive_file_id=item["id"],
                    drive_url=drive_url,
                    thumbnail_url=thumbnail_url,
                    filename=item["name"],
                    processing_status="pending",
                )
                db.add(photo)
                created += 1
            else:
                changed = (
                    photo.event_id != event.id
                    or photo.drive_url != drive_url
                    or photo.thumbnail_url != thumbnail_url
                    or photo.filename != item["name"]
                )
                if changed:
                    photo.event_id = event.id
                    photo.drive_url = drive_url
                    photo.thumbnail_url = thumbnail_url
                    photo.filename = item["name"]
                    updated += 1

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    stale_photo_query = db.query(Photo).filter(Photo.event_id == event.id)
    if synced_drive_file_ids:
        stale_photo_query = stale_photo_query.filter(Photo.drive_file_id.notin_(synced_drive_file_ids))
    stale_photo_ids = [photo_id for (photo_id,) in stale_photo_query.with_entities(Photo.id).all()]
    if stale_photo_ids:
        deleted = len(stale_photo_ids)
        db.query(FaceEmbedding).filter(FaceEmbedding.photo_id.in_(stale_photo_ids)).delete(synchronize_session=False)
        db.query(Photo).filter(Photo.id.in_(stale_photo_ids)).delete(synchronize_session=False)

    db.commit()

    photos_total = db.query(Photo).filter(Photo.event_id == event.id).count()
    return DriveSyncResult(
        scanned=scanned,
        created=created,
        updated=updated,
        deleted=deleted,
        photos_total=photos_total,
    )

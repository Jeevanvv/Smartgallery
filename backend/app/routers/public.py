import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Photo
from app.photo_access import verify_photo_access_token
from app.rate_limit import client_ip, public_search_limiter
from app.schemas import PublicEventResponse, PublicSearchResponse
from app.services import drive as drive_service
from app.services import public_search

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/events/{slug}", response_model=PublicEventResponse)
def get_public_event(slug: str, db: Session = Depends(get_db)):
    event = public_search.get_public_event_by_slug(db, slug)

    photos_indexed = (
        db.query(func.count(Photo.id))
        .filter(Photo.event_id == event.id, Photo.processing_status == "done")
        .scalar()
        or 0
    )

    return {
        "name": event.name,
        "slug": event.slug,
        "photos_indexed": photos_indexed,
        "ready": photos_indexed > 0,
    }


@router.post("/events/{slug}/search", response_model=PublicSearchResponse)
async def search_public_event(
    request: Request,
    slug: str,
    guest_name: str = Form(..., min_length=1, max_length=255),
    guest_phone: str = Form(..., min_length=1, max_length=50),
    guest_email: str = Form(..., min_length=1, max_length=255),
    privacy_consent: bool = Form(...),
    selfie: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    allowed, retry_after = public_search_limiter.check(client_ip(request))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many searches. Please wait before trying again.",
            headers={"Retry-After": str(retry_after)},
        )
    if not privacy_consent:
        raise HTTPException(status_code=400, detail="Privacy consent is required")
    clean_name = guest_name.strip()
    clean_phone = guest_phone.strip()
    clean_email = guest_email.strip().lower()
    if not clean_name or any(ord(char) < 32 for char in clean_name):
        raise HTTPException(status_code=400, detail="Enter a valid name")
    if not clean_phone or not all(char.isdigit() or char in "+-() " for char in clean_phone):
        raise HTTPException(status_code=400, detail="Enter a valid phone number")
    if clean_email.count("@") != 1 or "." not in clean_email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if selfie.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP image")
    if selfie.size is not None and selfie.size > settings.max_selfie_bytes:
        raise HTTPException(status_code=413, detail="Selfie file is too large")

    event = public_search.get_public_event_by_slug(db, slug)
    selfie_bytes = await selfie.read(settings.max_selfie_bytes + 1)
    await selfie.close()
    if len(selfie_bytes) > settings.max_selfie_bytes:
        raise HTTPException(status_code=413, detail="Selfie file is too large")
    return public_search.search_event_photos(
        db,
        event,
        selfie_bytes,
        clean_name,
        clean_phone,
        clean_email,
    )


def _authorized_photo(slug: str, photo_id: uuid.UUID, token: str, db: Session) -> Photo:
    event = public_search.get_public_event_by_slug(db, slug)
    photo = (
        db.query(Photo)
        .filter(Photo.id == photo_id, Photo.event_id == event.id, Photo.processing_status == "done")
        .first()
    )
    if photo is None or not photo.drive_url:
        raise HTTPException(status_code=404, detail="Photo not found")
    verify_photo_access_token(token, event.id, photo.id)
    return photo


@router.get("/events/{slug}/photos/{photo_id}/download")
def download_public_photo(slug: str, photo_id: uuid.UUID, token: str, db: Session = Depends(get_db)):
    photo = _authorized_photo(slug, photo_id, token, db)
    image_bytes = drive_service.download_photo_bytes(db, photo.event.photographer, photo)
    filename = quote(photo.filename, safe="")
    return Response(
        content=image_bytes,
        media_type=drive_service.guess_photo_content_type(photo),
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/events/{slug}/photos/{photo_id}/thumbnail")
def preview_public_photo(slug: str, photo_id: uuid.UUID, token: str, db: Session = Depends(get_db)):
    photo = _authorized_photo(slug, photo_id, token, db)

    photographer = photo.event.photographer
    try:
        image_bytes = drive_service.download_photo_bytes(db, photographer, photo)
    except HTTPException as exc:
        if exc.status_code == 404:
            drive_service.delete_photo_record(db, photo)
            raise HTTPException(status_code=404, detail="Photo was removed from Google Drive.") from exc
        raise
    return Response(
        content=image_bytes,
        media_type=drive_service.guess_photo_content_type(photo),
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )

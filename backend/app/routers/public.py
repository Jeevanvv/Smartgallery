from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Photo
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
    slug: str,
    guest_name: str = Form(..., min_length=1, max_length=255),
    guest_phone: str = Form(..., min_length=1, max_length=50),
    guest_email: str = Form(..., min_length=1, max_length=255),
    selfie: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    event = public_search.get_public_event_by_slug(db, slug)
    selfie_bytes = await selfie.read()
    return public_search.search_event_photos(
        db,
        event,
        selfie_bytes,
        guest_name.strip(),
        guest_phone.strip(),
        guest_email.strip().lower(),
    )


@router.get("/events/{slug}/photos/{photo_id}/download")
def download_public_photo(slug: str, photo_id: str, db: Session = Depends(get_db)):
    event = public_search.get_public_event_by_slug(db, slug)
    photo = (
        db.query(Photo)
        .filter(Photo.id == photo_id, Photo.event_id == event.id, Photo.processing_status == "done")
        .first()
    )
    if photo is None or not photo.drive_url:
        raise HTTPException(status_code=404, detail="Photo not found")
    return RedirectResponse(photo.drive_url)


@router.get("/events/{slug}/photos/{photo_id}/thumbnail")
def preview_public_photo(slug: str, photo_id: str, db: Session = Depends(get_db)):
    event = public_search.get_public_event_by_slug(db, slug)
    photo = (
        db.query(Photo)
        .filter(Photo.id == photo_id, Photo.event_id == event.id, Photo.processing_status == "done")
        .first()
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")

    photographer = event.photographer
    try:
        image_bytes = drive_service.download_photo_bytes(db, photographer, photo)
    except HTTPException as exc:
        if exc.status_code == 404:
            drive_service.delete_photo_record(db, photo)
            raise HTTPException(status_code=404, detail="Photo was removed from Google Drive.") from exc
        raise
    return Response(content=image_bytes, media_type=drive_service.guess_photo_content_type(photo))

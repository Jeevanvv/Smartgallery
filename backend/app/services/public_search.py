from __future__ import annotations

from collections.abc import Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Event, FaceEmbedding, Photo, SearchSession
from app.schemas import PublicPhotoResponse, PublicSearchResponse
from app.services import faces


def get_public_event_by_slug(db: Session, slug: str) -> Event:
    event = db.query(Event).filter(Event.slug == slug, Event.status == "active").first()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


def search_event_photos(db: Session, event: Event, selfie_bytes: bytes) -> PublicSearchResponse:
    indexed_count = (
        db.query(Photo).filter(Photo.event_id == event.id, Photo.processing_status == "done").count()
    )
    if indexed_count == 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Event not ready yet. Photo indexing is still in progress.",
        )

    try:
        query_embedding = faces.primary_face_embedding(selfie_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected in the uploaded selfie.",
        ) from exc

    distance = FaceEmbedding.embedding.cosine_distance(query_embedding)
    rows: Sequence[tuple[Photo, float]] = (
        db.query(Photo, distance.label("distance"))
        .join(FaceEmbedding, FaceEmbedding.photo_id == Photo.id)
        .filter(Photo.event_id == event.id, Photo.processing_status == "done", distance < settings.similarity_threshold)
        .order_by(distance.asc())
        .limit(settings.max_search_results)
        .all()
    )

    seen: set = set()
    photos: list[PublicPhotoResponse] = []
    for photo, _score in rows:
        if photo.id in seen:
            continue
        seen.add(photo.id)
        photos.append(
            PublicPhotoResponse(
                id=photo.id,
                thumbnail_url=photo.thumbnail_url,
                drive_url=photo.drive_url,
                filename=photo.filename,
            )
        )

    search_session = SearchSession(
        event_id=event.id,
        match_count=len(photos),
    )
    db.add(search_session)
    db.commit()
    db.refresh(search_session)

    return PublicSearchResponse(
        session_id=search_session.id,
        match_count=len(photos),
        photos=photos,
    )

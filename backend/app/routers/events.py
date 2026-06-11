import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_photographer
from app.database import get_db
from app.models import Photographer
from app.schemas import (
    DriveFolderListResponse,
    EventCreate,
    EventListResponse,
    EventReindexResponse,
    EventResponse,
    EventSyncResponse,
)
from app.services import drive as drive_service
from app.services import events as event_service
from app.services import indexing as indexing_service

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=EventListResponse)
def list_events(
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    return event_service.list_events(db, photographer)


@router.get("/drive-folders", response_model=DriveFolderListResponse)
def list_drive_folders(
    parent_id: str | None = None,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    return drive_service.list_drive_folders(db, photographer, parent_id=parent_id)


@router.post("", response_model=EventResponse, status_code=201)
def create_event(
    body: EventCreate,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    return event_service.create_event(db, photographer, body)


@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    return event_service.get_event(db, photographer, event_id)


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event_service.archive_event(db, photographer, event_id)


@router.post("/{event_id}/sync", response_model=EventSyncResponse)
def sync_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event = event_service.get_event_model(db, photographer, event_id)
    result = drive_service.sync_event_photos(db, photographer, event)
    return EventSyncResponse(
        scanned=result.scanned,
        created=result.created,
        updated=result.updated,
        photos_total=result.photos_total,
    )


@router.post("/{event_id}/reindex", response_model=EventReindexResponse)
def reindex_event(
    event_id: uuid.UUID,
    photographer: Photographer = Depends(get_current_photographer),
    db: Session = Depends(get_db),
):
    event = event_service.get_event_model(db, photographer, event_id)
    result = indexing_service.queue_event_reindex(db, photographer, event)
    return EventReindexResponse(
        queued=result.queued,
        reset=result.reset,
        photos_total=result.photos_total,
    )

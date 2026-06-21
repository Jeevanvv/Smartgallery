import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Event, FaceEmbedding, Photo, Photographer, SearchSession
from app.schemas import DashboardStatsResponse, EventCreate, EventListResponse, EventResponse, slugify


def _public_url(slug: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/event/{slug}"


def _event_response(db: Session, event: Event) -> EventResponse:
    photos_total = db.query(func.count(Photo.id)).filter(Photo.event_id == event.id).scalar() or 0
    photos_indexed = (
        db.query(func.count(Photo.id))
        .filter(Photo.event_id == event.id, Photo.processing_status == "done")
        .scalar()
        or 0
    )
    photos_pending = (
        db.query(func.count(Photo.id))
        .filter(Photo.event_id == event.id, Photo.processing_status.in_(["pending", "queued"]))
        .scalar()
        or 0
    )
    photos_processing = (
        db.query(func.count(Photo.id))
        .filter(Photo.event_id == event.id, Photo.processing_status == "processing")
        .scalar()
        or 0
    )
    photos_failed = (
        db.query(func.count(Photo.id))
        .filter(Photo.event_id == event.id, Photo.processing_status == "failed")
        .scalar()
        or 0
    )
    search_stats = (
        db.query(
            func.count(SearchSession.id).label("search_count"),
            func.max(SearchSession.searched_at).label("last_searched_at"),
        )
        .filter(SearchSession.event_id == event.id)
        .one()
    )
    return EventResponse(
        id=event.id,
        name=event.name,
        slug=event.slug,
        drive_folder_id=event.drive_folder_id,
        status=event.status,
        photos_total=photos_total,
        photos_indexed=photos_indexed,
        photos_pending=photos_pending,
        photos_processing=photos_processing,
        photos_failed=photos_failed,
        search_count=search_stats.search_count or 0,
        last_searched_at=search_stats.last_searched_at,
        public_url=_public_url(event.slug),
        created_at=event.created_at,
    )


def list_events(
    db: Session, photographer: Photographer, status_filter: str = "active"
) -> EventListResponse:
    if status_filter not in {"active", "archived", "all"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event status filter")

    query = db.query(Event).filter(Event.photographer_id == photographer.id)
    if status_filter != "all":
        query = query.filter(Event.status == status_filter)

    events = query.order_by(Event.created_at.desc()).all()
    event_responses = [_event_response(db, event) for event in events]

    stats = DashboardStatsResponse(
        events_count=len(event_responses),
        ready_events_count=sum(1 for event in event_responses if event.photos_indexed > 0),
        photos_total=sum(event.photos_total for event in event_responses),
        photos_indexed=sum(event.photos_indexed for event in event_responses),
        searches_total=sum(event.search_count for event in event_responses),
    )
    matches_query = (
        db.query(func.coalesce(func.sum(SearchSession.match_count), 0))
        .join(Event, Event.id == SearchSession.event_id)
        .filter(Event.photographer_id == photographer.id)
    )
    if status_filter != "all":
        matches_query = matches_query.filter(Event.status == status_filter)
    stats.matches_total = matches_query.scalar() or 0

    return EventListResponse(stats=stats, events=event_responses)


def create_event_model(db: Session, photographer: Photographer, data: EventCreate) -> Event:
    slug = data.slug or slugify(data.name)
    if not slug:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid event name")

    existing_active = db.query(Event).filter(Event.slug == slug, Event.status == "active").first()
    if existing_active:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    event = Event(
        photographer_id=photographer.id,
        name=data.name,
        slug=slug,
        drive_folder_id=data.drive_folder_id,
    )
    db.add(event)
    db.flush()
    return event


def create_event(db: Session, photographer: Photographer, data: EventCreate) -> EventResponse:
    event = create_event_model(db, photographer, data)
    db.commit()
    db.refresh(event)
    return _event_response(db, event)


def get_event(db: Session, photographer: Photographer, event_id: uuid.UUID) -> EventResponse:
    event = get_event_model(db, photographer, event_id)
    return _event_response(db, event)


def get_event_model(
    db: Session, photographer: Photographer, event_id: uuid.UUID, include_archived: bool = False
) -> Event:
    query = db.query(Event).filter(Event.id == event_id, Event.photographer_id == photographer.id)
    if not include_archived:
        query = query.filter(Event.status == "active")
    event = query.first()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


def archive_event(db: Session, photographer: Photographer, event_id: uuid.UUID) -> None:
    event = get_event_model(db, photographer, event_id)
    event.status = "archived"
    db.commit()


def restore_event(db: Session, photographer: Photographer, event_id: uuid.UUID) -> EventResponse:
    event = get_event_model(db, photographer, event_id, include_archived=True)
    existing_active = (
        db.query(Event)
        .filter(Event.slug == event.slug, Event.status == "active", Event.id != event.id)
        .first()
    )
    if existing_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active event already uses this public link. Archive it before restoring this event.",
        )

    event.status = "active"
    db.commit()
    db.refresh(event)
    return _event_response(db, event)


def permanently_delete_event(db: Session, photographer: Photographer, event_id: uuid.UUID) -> None:
    event = get_event_model(db, photographer, event_id, include_archived=True)
    if event.status != "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archive the event before permanently deleting it.",
        )

    photo_ids = [photo_id for (photo_id,) in db.query(Photo.id).filter(Photo.event_id == event.id).all()]
    if photo_ids:
        db.query(FaceEmbedding).filter(FaceEmbedding.photo_id.in_(photo_ids)).delete(synchronize_session=False)
    db.query(SearchSession).filter(SearchSession.event_id == event.id).delete(synchronize_session=False)
    db.query(Photo).filter(Photo.event_id == event.id).delete(synchronize_session=False)
    db.delete(event)
    db.commit()

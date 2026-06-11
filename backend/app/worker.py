import sys
import logging

from celery import Celery

from app.config import settings
from app.database import SessionLocal
from app.models import Event, Photographer
from app.services import drive as drive_service
from app.services.indexing import process_photo_indexing

logger = logging.getLogger(__name__)

celery_app = Celery(
    "smartgallery",
    broker=settings.celery_broker_url or settings.redis_url,
    backend=settings.celery_result_backend or settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    beat_schedule={
        "events.auto_sync": {
            "task": "events.auto_sync",
            "schedule": max(settings.auto_sync_interval_minutes, 1) * 60,
        }
    },
)

# Celery's default prefork/spawn pools are flaky on Windows for this project.
# Use the single-process solo pool by default so queued jobs can run reliably.
if sys.platform.startswith("win"):
    celery_app.conf.worker_pool = "solo"
    celery_app.conf.worker_concurrency = 1


@celery_app.task(name="health.ping")
def ping():
    return "pong"


@celery_app.task(name="photos.index_photo")
def index_photo_task(photo_id: str):
    process_photo_indexing(photo_id)


@celery_app.task(name="events.auto_sync")
def auto_sync_events_task():
    from app.services.indexing import queue_pending_event_photos

    db = SessionLocal()
    try:
        events = (
            db.query(Event, Photographer)
            .join(Photographer, Photographer.id == Event.photographer_id)
            .filter(Event.status == "active", Photographer.google_oauth_token.is_not(None))
            .all()
        )

        synced_events = 0
        queued_photos = 0

        for event, photographer in events:
            try:
                result = drive_service.sync_event_photos(db, photographer, event)
                if result.created or result.updated:
                    queued_photos += queue_pending_event_photos(db, event).queued
                synced_events += 1
            except Exception:
                logger.exception("Automatic Drive sync failed for event %s", event.id)

        return {"synced_events": synced_events, "queued_photos": queued_photos}
    finally:
        db.close()

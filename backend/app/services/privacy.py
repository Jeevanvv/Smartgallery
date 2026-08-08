from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models import SearchSession


def delete_expired_search_sessions(db: Session) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.search_session_retention_days)
    deleted = (
        db.query(SearchSession)
        .filter(SearchSession.searched_at < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted

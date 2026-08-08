from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
import jwt
from jwt.exceptions import PyJWTError

from app.config import settings

ALGORITHM = "HS256"
AUDIENCE = "smartgallery-public-photo"


def create_photo_access_token(
    event_id: uuid.UUID,
    photo_id: uuid.UUID,
    search_session_id: uuid.UUID,
) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "aud": AUDIENCE,
            "event_id": str(event_id),
            "photo_id": str(photo_id),
            "session_id": str(search_session_id),
            "iat": now,
            "exp": now + timedelta(minutes=settings.photo_access_token_minutes),
        },
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def verify_photo_access_token(token: str, event_id: uuid.UUID, photo_id: uuid.UUID) -> None:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[ALGORITHM],
            audience=AUDIENCE,
        )
        if payload.get("event_id") != str(event_id) or payload.get("photo_id") != str(photo_id):
            raise PyJWTError("Photo access token does not match the requested resource")
        uuid.UUID(str(payload["session_id"]))
    except (PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Photo access link is invalid or expired",
        ) from exc

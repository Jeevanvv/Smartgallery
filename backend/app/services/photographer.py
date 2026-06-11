from sqlalchemy.orm import Session

from app.auth import SupabaseUser
from app.config import settings
from app.crypto import decrypt_token_data, encrypt_token_data
from app.models import Photographer
from app.schemas import SyncProfileRequest


def _stored_google_tokens(photographer: Photographer | None) -> dict:
    if photographer is None or not photographer.google_oauth_token:
        return {}

    try:
        return decrypt_token_data(settings.secret_key, photographer.google_oauth_token)
    except Exception:
        return {}


def upsert_photographer(
    db: Session,
    user: SupabaseUser,
    body: SyncProfileRequest,
) -> Photographer:
    photographer = (
        db.query(Photographer)
        .filter(Photographer.supabase_user_id == user.id)
        .first()
    )
    if photographer is None:
        photographer = db.query(Photographer).filter(Photographer.email == user.email).first()

    existing_tokens = _stored_google_tokens(photographer)
    token_payload: dict | None = None
    if body.provider_refresh_token or body.provider_token:
        token_payload = {
            "provider_token": body.provider_token or existing_tokens.get("provider_token"),
            "provider_refresh_token": body.provider_refresh_token
            or existing_tokens.get("provider_refresh_token"),
        }

    if photographer is None:
        photographer = Photographer(
            supabase_user_id=user.id,
            name=user.name or user.email.split("@")[0],
            email=user.email,
            google_oauth_token=(
                encrypt_token_data(settings.secret_key, token_payload)
                if token_payload
                else None
            ),
        )
        db.add(photographer)
    else:
        photographer.supabase_user_id = user.id
        if user.name:
            photographer.name = user.name
        if token_payload:
            photographer.google_oauth_token = encrypt_token_data(
                settings.secret_key, token_payload
            )

    db.commit()
    db.refresh(photographer)
    return photographer

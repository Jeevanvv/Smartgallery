import uuid
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Photographer

security = HTTPBearer(auto_error=False)


@dataclass
class SupabaseUser:
    id: uuid.UUID
    email: str
    name: str | None


def _user_from_supabase_payload(data: dict) -> SupabaseUser:
    user_id = data.get("id") or data.get("sub")
    email = data.get("email")
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    metadata = data.get("user_metadata") or {}
    name = metadata.get("full_name") or metadata.get("name")

    return SupabaseUser(
        id=uuid.UUID(str(user_id)),
        email=email,
        name=name,
    )


def _verify_via_supabase_api(token: str) -> SupabaseUser | None:
    """Validate token with Supabase Auth API (works with all signing key types)."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    try:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_service_role_key,
            },
            timeout=10.0,
        )
    except httpx.HTTPError:
        return None

    if response.status_code != 200:
        return None

    return _user_from_supabase_payload(response.json())


def _verify_via_jwt_secret(token: str) -> SupabaseUser:
    """Fallback for legacy HS256 JWT secret."""
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase JWT secret not configured",
        )

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    return _user_from_supabase_payload(payload)


def decode_supabase_jwt(token: str) -> SupabaseUser:
    user = _verify_via_supabase_api(token)
    if user is not None:
        return user

    return _verify_via_jwt_secret(token)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> SupabaseUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
        )
    return decode_supabase_jwt(credentials.credentials)


def get_current_photographer(
    user: SupabaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Photographer:
    photographer = (
        db.query(Photographer)
        .filter(Photographer.supabase_user_id == user.id)
        .first()
    )
    if photographer is None:
        photographer = (
            db.query(Photographer).filter(Photographer.email == user.email).first()
        )
    if photographer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photographer profile not found. Call /auth/sync-profile first.",
        )
    return photographer

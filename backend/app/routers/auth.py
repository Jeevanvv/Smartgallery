from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import SupabaseUser, get_current_user
from app.database import get_db
from app.schemas import PhotographerResponse, SyncProfileRequest
from app.services.photographer import upsert_photographer

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/sync-profile", response_model=PhotographerResponse)
def sync_profile(
    body: SyncProfileRequest,
    user: SupabaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    photographer = upsert_photographer(db, user, body)
    return PhotographerResponse(
        id=photographer.id,
        name=photographer.name,
        email=photographer.email,
        has_drive_access=photographer.google_oauth_token is not None,
        created_at=photographer.created_at,
    )


@router.get("/me", response_model=PhotographerResponse)
def get_me(
    user: SupabaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    photographer = upsert_photographer(db, user, SyncProfileRequest())
    return PhotographerResponse(
        id=photographer.id,
        name=photographer.name,
        email=photographer.email,
        has_drive_access=photographer.google_oauth_token is not None,
        created_at=photographer.created_at,
    )


@router.post("/logout")
def logout():
    return {"status": "ok"}

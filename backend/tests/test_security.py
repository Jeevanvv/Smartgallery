import asyncio
import time
import uuid

import httpx
import pytest
from fastapi import HTTPException

from app.config import Settings
from app.main import app
from app.photo_access import create_photo_access_token, verify_photo_access_token
from app.rate_limit import SearchRateLimiter

def test_settings_reject_weak_secret():
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(_env_file=None, secret_key="change-me")
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(_env_file=None, secret_key="replace-with-at-least-32-random-characters")


def test_local_auth_is_rejected_outside_loopback_development():
    base = {
        "_env_file": None,
        "secret_key": "a-secure-random-production-secret-value",
        "local_dev_auth": True,
        "local_dev_auth_token": "a-local-development-token-over-32-chars",
        "database_url": "postgresql://user:password@127.0.0.1/database",
        "frontend_url": "http://localhost:3000",
    }
    with pytest.raises(ValueError, match="only allowed in development"):
        Settings(**base)

    base["app_environment"] = "development"
    base["database_url"] = "postgresql://user:password@database.example/database"
    with pytest.raises(ValueError, match="loopback database"):
        Settings(**base)


def test_photo_token_is_bound_to_event_and_photo():
    event_id = uuid.uuid4()
    photo_id = uuid.uuid4()
    token = create_photo_access_token(event_id, photo_id, uuid.uuid4())

    verify_photo_access_token(token, event_id, photo_id)
    with pytest.raises(HTTPException) as error:
        verify_photo_access_token(token, event_id, uuid.uuid4())
    assert error.value.status_code == 403


def test_local_rate_limiter_enforces_window():
    limiter = SearchRateLimiter(limit=2, window_seconds=1)
    assert limiter.check("client")[0]
    assert limiter.check("client")[0]
    allowed, retry_after = limiter.check("client")
    assert not allowed
    assert retry_after >= 1

    time.sleep(1.05)
    assert limiter.check("client")[0]


def test_health_endpoint_and_production_docs_default():
    async def request_health():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.get("/api/health")

    response = asyncio.run(request_health())
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"

    production_defaults = Settings(
        _env_file=None,
        secret_key="a-secure-random-production-secret-value",
    )
    assert production_defaults.debug is False
    assert production_defaults.expose_api_docs is False


def test_search_rejects_oversized_content_length_before_parsing():
    async def request_search():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.post(
                "/api/public/events/example/search",
                headers={"content-length": str(9 * 1024 * 1024)},
                content=b"",
            )

    response = asyncio.run(request_search())
    assert response.status_code == 413

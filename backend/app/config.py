from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = "SmartGallery"
    app_version: str = "0.1.0"
    debug: bool = False
    secret_key: str = "change-me"

    database_url: str = ""
    redis_url: str = ""
    celery_broker_url: str = ""
    celery_result_backend: str = ""

    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""

    similarity_threshold: float = 0.4
    max_search_results: int = 200
    face_model_name: str = "buffalo_l"
    face_detection_size: int = 640
    face_detection_fallback_size: int = 1024
    auto_sync_interval_minutes: int = 30

    frontend_url: str = "http://localhost:3000"

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return bool(value)


settings = Settings()

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./fashion.db")
    app_env: str = os.getenv("APP_ENV", "development")
    app_origin: str = os.getenv("APP_ORIGIN", "http://localhost:3000")
    secret: str = os.getenv("JWT_SECRET", "local-development-only-change-before-deploy-000000")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    media_root: Path = Path(os.getenv("MEDIA_ROOT", "./media"))
    access_ttl: int = int(os.getenv("ACCESS_TOKEN_TTL", "900"))
    refresh_ttl: int = int(os.getenv("REFRESH_TOKEN_TTL", "604800"))

    def validate(self):
        if self.app_env == "production":
            if len(self.secret) < 32 or self.secret.startswith("local-development"):
                raise RuntimeError(
                    "Production requires a unique JWT_SECRET of at least 32 characters"
                )
            if not self.app_origin.startswith("https://"):
                raise RuntimeError("Production APP_ORIGIN must use HTTPS")
            if not self.database_url.startswith("postgresql"):
                raise RuntimeError("Production requires PostgreSQL")


settings = Settings()

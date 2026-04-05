"""Konfiguration aus .env laden via Pydantic BaseSettings."""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Alle konfigurierbaren Umgebungsvariablen der myProductivity App."""

    # Datenbank
    database_url: str = "sqlite:///./data/productivity.db"

    # Server
    host: str = "0.0.0.0"
    port: int = 8001

    # App-eigener Passwort-Schutz (Session-Cookie)
    app_password: str = ""
    session_secret: str = "change-me-in-production"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Singleton-Pattern für Settings – wird nur einmal instanziert."""
    return Settings()

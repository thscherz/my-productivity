"""FastAPI App-Instanz, Startup-Events, Middleware und CORS-Konfiguration."""
from __future__ import annotations

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

from database import engine, Base
from config import get_settings
from routes import auth, tasks, projects
from routes import tags
from routes import attachments
from routes.auth import verify_session_cookie

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Endpunkte die OHNE Login erreichbar sein müssen (exakte Pfad-Präfixe)
AUTH_WHITELIST = [
    "/api/v1/auth/login",
    "/api/v1/auth/check",
    "/api/v1/auth/logout",
    "/api/v1/health",
    "/assets/",
    "/favicon",
]


def _auto_shift_job() -> None:
    """Täglicher Cron-Job: Verschiebt Zeithorizonte nach vorne."""
    from database import SessionLocal
    from services.auto_shift_service import AutoShiftService
    db = SessionLocal()
    try:
        AutoShiftService(db).run_daily_shift()
    except Exception:
        logger.exception("Auto-Shift fehlgeschlagen")
    finally:
        db.close()


def _is_whitelisted(path: str) -> bool:
    """
    Prüft ob ein Request-Pfad von der Auth-Prüfung ausgenommen ist.
    Statische Dateien (kein /api/-Präfix) werden immer durchgelassen.
    """
    # Statische Dateien und Frontend-Routen: kein API-Aufruf
    if not path.startswith("/api/"):
        return True

    # Whitelist-Prüfung für API-Pfade
    for whitelisted in AUTH_WHITELIST:
        if path.startswith(whitelisted):
            return True

    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: Datenverzeichnis, Datenbank-Tabellen und Scheduler erstellen."""
    logger.info("myProductivity startet...")

    # Sicherheitsprüfung: SESSION_SECRET darf kein Dummy-Wert sein
    _settings = get_settings()
    _insecure_defaults = {"change-me-in-production", "", "secret", "changeme"}
    if not _settings.session_secret or _settings.session_secret.strip().lower() in _insecure_defaults:
        raise RuntimeError(
            "SESSION_SECRET ist nicht gesetzt oder verwendet einen unsicheren Standard-Wert. "
            "Bitte SESSION_SECRET in der .env-Datei auf einen zufälligen, starken Wert setzen "
            "(z.B. mit: python -c \"import secrets; print(secrets.token_hex(32))\")."
        )

    # Datenverzeichnis und Upload-Verzeichnis für Anhänge erstellen
    os.makedirs("data", exist_ok=True)
    os.makedirs(os.path.join("data", "attachments"), exist_ok=True)

    # Alle SQLAlchemy-Models importieren damit Base.metadata sie kennt
    import models  # noqa: F401

    # Tabellen erstellen (falls noch nicht vorhanden)
    Base.metadata.create_all(bind=engine)

    # APScheduler für täglichen Horizont-Auto-Shift starten
    berlin_tz = pytz.timezone("Europe/Berlin")
    scheduler = BackgroundScheduler(timezone=berlin_tz)
    scheduler.add_job(
        func=_auto_shift_job,
        trigger=CronTrigger(hour=4, minute=0, timezone=berlin_tz),
        id="auto_shift",
        name="Täglicher Horizont Auto-Shift",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Auto-Shift Scheduler gestartet (täglich 04:00 Europe/Berlin).")

    logger.info("myProductivity bereit. Datenbank initialisiert.")
    yield

    # Scheduler sauber beenden
    scheduler.shutdown()
    logger.info("myProductivity heruntergefahren.")


# FastAPI-App erstellen
app = FastAPI(
    title="myProductivity API",
    description="myProductivity – Persönliches Aufgaben- und Projektmanagement",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS für Entwicklung (Vite Dev Server auf Port 5174, Fallback 5173 und 3000)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _verify_api_key(request: Request) -> bool:
    """
    Prüft ob der Header X-API-Key einen gültigen, konfigurierten API-Key enthält.
    Gibt False zurück wenn kein API_KEY in den Settings gesetzt ist (leerer String).
    """
    settings = get_settings()

    # Kein API_KEY konfiguriert → Feature deaktiviert, nie akzeptieren
    if not settings.api_key:
        return False

    header_key = request.headers.get("X-API-Key", "")
    return header_key == settings.api_key


@app.middleware("http")
async def session_auth_middleware(request: Request, call_next):
    """
    Prüft bei jedem API-Request die Authentifizierung.
    Reihenfolge:
      1. Whitelisted Endpunkte → immer durchlassen
      2. X-API-Key Header gültig → durchlassen (für programmatischen Zugriff)
      3. Session-Cookie gültig → durchlassen (für Browser-Zugriff)
      4. Sonst → 401 Unauthorized
    """
    path = request.url.path

    # Whitelisted Endpunkte ohne Auth-Prüfung durchlassen
    if _is_whitelisted(path):
        return await call_next(request)

    # API-Key-Authentifizierung: Header X-API-Key prüfen
    if _verify_api_key(request):
        logger.debug("API-Key-Authentifizierung erfolgreich für: %s", path)
        return await call_next(request)

    # Cookie-Authentifizierung für Browser-Zugriff
    if verify_session_cookie(request):
        return await call_next(request)

    logger.debug("Unauthentifizierter API-Zugriff auf: %s", path)
    return JSONResponse(
        status_code=401,
        content={"detail": "Nicht eingeloggt."},
    )


# Auth-Router zuerst registrieren
app.include_router(auth.router)

# Fachliche API-Routen registrieren
app.include_router(tasks.router)
app.include_router(projects.router)
app.include_router(tags.router)
app.include_router(attachments.router)


@app.get("/api/v1/health")
def health_check():
    """Health-Check-Endpunkt für Monitoring und Deployment-Checks."""
    return {"status": "ok", "version": "1.0.0"}


# Statische Frontend-Dateien in Produktion ausliefern
# WICHTIG: Mount muss NACH allen API-Routen kommen, sonst fängt "/" alles ab.
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    # Assets-Verzeichnis für CSS/JS/Fonts mounten
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # SPA Catch-All: Alle nicht-API-Routen liefern index.html (React Router übernimmt das Routing)
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        """Fallback für React SPA – liefert index.html für alle Frontend-Routen."""
        # Prüfen ob eine echte statische Datei existiert (CSS, JS, Bilder etc.)
        static_file = os.path.join(frontend_dist, full_path)
        if os.path.isfile(static_file):
            return FileResponse(static_file)
        # Sonst: index.html zurückgeben (React Router übernimmt das Client-Routing)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

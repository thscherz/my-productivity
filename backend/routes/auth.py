"""
Auth-Routen: Login, Logout und Session-Check.
Verwendet signierte HTTP-only Cookies via itsdangerous.
"""

import logging
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel
from itsdangerous import TimestampSigner, SignatureExpired, BadSignature

from config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Cookie-Name für myProductivity (unterscheidet sich von vince-health "session")
COOKIE_NAME = "prod_session"
# Ablauf: 30 Tage in Sekunden
SESSION_MAX_AGE = 30 * 24 * 60 * 60
# Fester Cookie-Wert – nur die Signatur beweist Authentizität
SESSION_VALUE = "authenticated"


def _get_signer() -> TimestampSigner:
    """Erstellt einen TimestampSigner mit dem konfigurierten Secret."""
    settings = get_settings()
    return TimestampSigner(settings.session_secret)


def _is_localhost(request: Request) -> bool:
    """Prüft ob der Request von localhost kommt (für secure-Flag)."""
    host = request.headers.get("host", "")
    return host.startswith("localhost") or host.startswith("127.0.0.1")


def verify_session_cookie(request: Request) -> bool:
    """
    Prüft ob ein gültiges, nicht abgelaufenes Session-Cookie vorhanden ist.
    Gibt True zurück wenn eingeloggt, sonst False.
    """
    cookie_value = request.cookies.get(COOKIE_NAME)
    if not cookie_value:
        return False

    signer = _get_signer()
    try:
        # max_age in Sekunden – abgelaufene Cookies werden abgelehnt
        signer.unsign(cookie_value, max_age=SESSION_MAX_AGE)
        return True
    except SignatureExpired:
        logger.info("Session-Cookie abgelaufen.")
        return False
    except BadSignature:
        logger.warning("Ungültiges Session-Cookie – möglicher Manipulationsversuch.")
        return False


class LoginBody(BaseModel):
    """Request-Body für den Login."""
    password: str


@router.post("/login")
def login(body: LoginBody, request: Request, response: Response):
    """
    Prüft das Passwort und setzt ein signiertes Session-Cookie bei Erfolg.
    """
    settings = get_settings()

    # Einfacher String-Vergleich – kein bcrypt für Single-User-App
    if body.password != settings.app_password:
        logger.warning("Fehlgeschlagener Login-Versuch.")
        raise HTTPException(status_code=401, detail="Falsches Passwort.")

    # Signiertes Cookie erstellen
    signer = _get_signer()
    signed_value = signer.sign(SESSION_VALUE).decode("utf-8")

    # secure-Flag nur setzen wenn nicht localhost
    is_secure = not _is_localhost(request)

    response.set_cookie(
        key=COOKIE_NAME,
        value=signed_value,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=is_secure,
        samesite="lax",
    )

    logger.info("Erfolgreich eingeloggt.")
    return {"status": "ok"}


@router.post("/logout")
def logout(response: Response):
    """Löscht das Session-Cookie und beendet die Session."""
    response.delete_cookie(key=COOKIE_NAME)
    logger.info("Ausgeloggt.")
    return {"status": "ok"}


@router.get("/check")
def check(request: Request):
    """
    Prüft ob eine gültige Session besteht.
    HTTP 200 = eingeloggt, HTTP 401 = nicht eingeloggt.
    """
    if verify_session_cookie(request):
        return {"status": "authenticated"}
    raise HTTPException(status_code=401, detail="Nicht eingeloggt.")

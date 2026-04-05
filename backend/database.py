"""SQLAlchemy Engine und Session-Verwaltung."""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)


# WAL-Modus für bessere Performance bei gleichzeitigen Reads/Writes
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Aktiviert WAL-Modus und Foreign Keys bei jeder neuen Verbindung."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Basis-Klasse für alle SQLAlchemy Models."""
    pass


def get_db():
    """Dependency für FastAPI: liefert eine DB-Session und schliesst sie nach dem Request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

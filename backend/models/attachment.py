"""SQLAlchemy Model für Datei-Anhänge an Tasks."""
from __future__ import annotations

from typing import Optional
from sqlalchemy import Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Attachment(Base):
    """
    Repräsentiert einen Datei-Anhang, der einem Task zugeordnet ist.
    Wird bei Task-Löschung via CASCADE automatisch mitgelöscht.
    """

    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # FK auf den zugehörigen Task – CASCADE sorgt für automatisches Löschen
    task_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Originaler Dateiname wie vom User hochgeladen
    filename: Mapped[str] = mapped_column(Text, nullable=False)

    # Auf Disk gespeicherter Dateiname (UUID-Prefix verhindert Kollisionen)
    stored_filename: Mapped[str] = mapped_column(Text, nullable=False)

    # MIME-Type (z.B. "image/png", "application/pdf")
    content_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Dateigrösse in Bytes
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Erstellungszeitpunkt als ISO-UTC-String
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

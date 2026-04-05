"""SQLAlchemy Model für Tags."""
from __future__ import annotations

from typing import Optional
from sqlalchemy import Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Tag(Base):
    """
    Tag-Model für die Klassifizierung von Tasks.
    Tags können mehreren Tasks zugeordnet werden (Many-to-Many via task_tags).
    """

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Eindeutiger Tag-Name
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    # Optionale Farbe als Hex-Wert (z.B. "#FF5733")
    color: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # ISO-Timestamp der Erstellung
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

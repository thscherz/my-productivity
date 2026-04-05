"""SQLAlchemy Model für Projekte."""
from __future__ import annotations

from typing import List, Optional
from sqlalchemy import Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Project(Base):
    """Ein Projekt gruppiert mehrere Tasks thematisch zusammen."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Hex-Farbe für die UI-Darstellung (z.B. "#3B82F6")
    color: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # SQLite-Boolean: 0 = aktiv, 1 = archiviert
    is_archived: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # ISO-Timestamps in UTC
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship zu Tasks (ein Projekt hat viele Tasks)
    tasks: Mapped[List["Task"]] = relationship(  # type: ignore[name-defined]
        "Task",
        back_populates="project",
        foreign_keys="Task.project_id",
    )

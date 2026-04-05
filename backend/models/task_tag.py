"""Assoziationstabelle für die Many-to-Many Beziehung zwischen Tasks und Tags."""
from __future__ import annotations

from sqlalchemy import Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class TaskTag(Base):
    """
    Verbindungstabelle zwischen tasks und tags.
    Beim Löschen eines Tasks oder Tags werden die Einträge kaskadiert gelöscht.
    """

    __tablename__ = "task_tags"

    task_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )

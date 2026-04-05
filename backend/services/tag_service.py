"""Service für Tags – Business-Logik und Timestamp-Management."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List
from sqlalchemy.orm import Session
from fastapi import HTTPException

from models.tag import Tag
from repositories.tag_repo import TagRepo
from schemas.tag import TagCreate, TagUpdate

logger = logging.getLogger(__name__)


def _now_utc() -> str:
    """Gibt den aktuellen UTC-Zeitstempel als ISO-String zurück."""
    return datetime.now(timezone.utc).isoformat()


class TagService:
    """Business-Logik für Tags."""

    def __init__(self, db: Session) -> None:
        self.repo = TagRepo(db)

    def create_tag(self, data: TagCreate) -> Tag:
        """Erstellt einen neuen Tag. Name muss eindeutig sein."""
        now = _now_utc()
        return self.repo.create(name=data.name, color=data.color, now=now)

    def get_all(self) -> List[Tag]:
        """Gibt alle Tags zurück."""
        return self.repo.get_all()

    def get_by_id(self, tag_id: int) -> Tag:
        """
        Gibt einen einzelnen Tag zurück.
        HTTP 404 wenn nicht gefunden.
        """
        tag = self.repo.get_by_id(tag_id)
        if tag is None:
            raise HTTPException(status_code=404, detail="Tag nicht gefunden.")
        return tag

    def update_tag(self, tag_id: int, data: TagUpdate) -> Tag:
        """
        Aktualisiert einen Tag.
        HTTP 404 wenn nicht gefunden.
        """
        tag = self.repo.update(tag_id, data)
        if tag is None:
            raise HTTPException(status_code=404, detail="Tag nicht gefunden.")
        return tag

    def delete_tag(self, tag_id: int) -> None:
        """
        Löscht einen Tag.
        HTTP 404 wenn nicht gefunden.
        """
        deleted = self.repo.delete(tag_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Tag nicht gefunden.")

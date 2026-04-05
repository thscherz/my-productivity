"""Repository für Tags – kapselt alle Datenbankoperationen."""
from __future__ import annotations

import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from models.tag import Tag
from schemas.tag import TagCreate, TagUpdate

logger = logging.getLogger(__name__)


class TagRepo:
    """Datenbankzugriff für Tags."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, name: str, color: Optional[str], now: str) -> Tag:
        """Erstellt einen neuen Tag."""
        tag = Tag(
            name=name,
            color=color,
            created_at=now,
        )
        self.db.add(tag)
        self.db.commit()
        self.db.refresh(tag)
        logger.info("Tag erstellt: id=%s name='%s'", tag.id, tag.name)
        return tag

    def get_all(self) -> List[Tag]:
        """Gibt alle Tags alphabetisch sortiert zurück."""
        return self.db.query(Tag).order_by(Tag.name).all()

    def get_by_id(self, tag_id: int) -> Optional[Tag]:
        """Gibt einen Tag anhand der ID zurück."""
        return self.db.query(Tag).filter(Tag.id == tag_id).first()

    def get_by_ids(self, tag_ids: List[int]) -> List[Tag]:
        """Gibt mehrere Tags anhand einer ID-Liste zurück."""
        return self.db.query(Tag).filter(Tag.id.in_(tag_ids)).all()

    def update(self, tag_id: int, data: TagUpdate) -> Optional[Tag]:
        """
        Aktualisiert einen Tag.
        Gibt None zurück wenn nicht gefunden.
        """
        tag = self.db.query(Tag).filter(Tag.id == tag_id).first()
        if tag is None:
            return None

        if data.name is not None:
            tag.name = data.name
        if data.color is not None:
            tag.color = data.color

        self.db.commit()
        self.db.refresh(tag)
        logger.info("Tag aktualisiert: id=%s", tag.id)
        return tag

    def delete(self, tag_id: int) -> bool:
        """
        Löscht einen Tag. TaskTag-Einträge werden via CASCADE gelöscht.
        Gibt True zurück wenn gelöscht, False wenn nicht gefunden.
        """
        tag = self.db.query(Tag).filter(Tag.id == tag_id).first()
        if tag is None:
            return False

        self.db.delete(tag)
        self.db.commit()
        logger.info("Tag gelöscht: id=%s", tag_id)
        return True

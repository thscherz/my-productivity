"""Repository für Projekte – kapselt alle Datenbankoperationen."""
from __future__ import annotations

import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from models.project import Project
from schemas.project import ProjectCreate, ProjectUpdate

logger = logging.getLogger(__name__)


class ProjectRepo:
    """Datenbankzugriff für Projekte."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: ProjectCreate, now: str) -> Project:
        """Erstellt ein neues Projekt."""
        project = Project(
            name=data.name,
            description=data.description,
            color=data.color,
            is_archived=0,
            created_at=now,
            updated_at=now,
        )
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        logger.info("Projekt erstellt: id=%s name='%s'", project.id, project.name)
        return project

    def get_all(self, include_archived: bool = False) -> List[Project]:
        """Gibt alle Projekte zurück. Archivierte werden standardmässig ausgeblendet."""
        query = self.db.query(Project)
        if not include_archived:
            query = query.filter(Project.is_archived == 0)
        return query.order_by(Project.name).all()

    def get_by_id(self, project_id: int) -> Optional[Project]:
        """Gibt ein Projekt anhand der ID zurück oder None."""
        return self.db.query(Project).filter(Project.id == project_id).first()

    def update(self, project_id: int, data: ProjectUpdate, now: str) -> Optional[Project]:
        """Aktualisiert ein Projekt. Gibt None zurück wenn nicht gefunden."""
        project = self.get_by_id(project_id)
        if project is None:
            return None

        # Nur gesetzte Felder überschreiben
        if data.name is not None:
            project.name = data.name
        if data.description is not None:
            project.description = data.description
        if data.color is not None:
            project.color = data.color
        if data.is_archived is not None:
            # bool → int für SQLite
            project.is_archived = 1 if data.is_archived else 0

        project.updated_at = now
        self.db.commit()
        self.db.refresh(project)
        logger.info("Projekt aktualisiert: id=%s", project.id)
        return project

    def delete(self, project_id: int) -> bool:
        """
        Löscht ein Projekt. Tasks des Projekts erhalten project_id = NULL (FK SET NULL).
        Gibt True zurück wenn gelöscht, False wenn nicht gefunden.
        """
        project = self.get_by_id(project_id)
        if project is None:
            return False

        self.db.delete(project)
        self.db.commit()
        logger.info("Projekt gelöscht: id=%s", project_id)
        return True

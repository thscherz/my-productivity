"""Service für Projekte – Timestamp-Verwaltung und Validierung."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session

from models.project import Project
from repositories.project_repo import ProjectRepo
from schemas.project import ProjectCreate, ProjectUpdate

logger = logging.getLogger(__name__)


def _now_utc() -> str:
    """Gibt den aktuellen UTC-Zeitstempel als ISO-String zurück."""
    return datetime.now(timezone.utc).isoformat()


class ProjectService:
    """Business-Logik für Projekte. Thin Wrapper um ProjectRepo."""

    def __init__(self, db: Session) -> None:
        self.repo = ProjectRepo(db)

    def create_project(self, data: ProjectCreate) -> Project:
        """Erstellt ein neues Projekt mit UTC-Timestamps."""
        now = _now_utc()
        return self.repo.create(data, now)

    def get_all(self, include_archived: bool = False) -> List[Project]:
        """Gibt alle (nicht archivierten) Projekte zurück."""
        return self.repo.get_all(include_archived=include_archived)

    def get_by_id(self, project_id: int) -> Optional[Project]:
        """Gibt ein Projekt anhand der ID zurück oder None."""
        return self.repo.get_by_id(project_id)

    def update_project(self, project_id: int, data: ProjectUpdate) -> Optional[Project]:
        """Aktualisiert ein Projekt. Gibt None zurück wenn nicht gefunden."""
        now = _now_utc()
        return self.repo.update(project_id, data, now)

    def delete_project(self, project_id: int) -> bool:
        """
        Löscht ein Projekt. Tasks des Projekts verlieren die Projektzuordnung (SET NULL).
        Gibt True zurück wenn gelöscht, False wenn nicht gefunden.
        """
        return self.repo.delete(project_id)

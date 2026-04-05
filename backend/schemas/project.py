"""Pydantic Schemas für Projekte."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    """Request-Body zum Erstellen eines Projekts."""
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Request-Body zum Aktualisieren eines Projekts (alle Felder optional)."""
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_archived: Optional[bool] = None


class ProjectResponse(BaseModel):
    """Response-Schema für ein Projekt."""
    id: int
    name: str
    description: Optional[str]
    color: Optional[str]
    # Als bool zurückgeben, obwohl intern Integer (SQLite)
    is_archived: bool
    created_at: str
    updated_at: str
    # Optionale Anzahl Tasks im Projekt (wird in get_by_id befüllt)
    task_count: Optional[int] = None

    model_config = {"from_attributes": True}

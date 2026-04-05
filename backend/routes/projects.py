"""
Projekt-Routen: CRUD für Projekte.
Prefix: /api/v1/projects
"""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from services.project_service import ProjectService
from schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    """Erstellt ein neues Projekt."""
    service = ProjectService(db)
    project = service.create_project(data)
    resp = ProjectResponse.model_validate(project)
    resp.is_archived = bool(project.is_archived)
    return resp


@router.get("", response_model=List[ProjectResponse])
def list_projects(include_archived: bool = False, db: Session = Depends(get_db)):
    """
    Gibt alle Projekte zurück.
    Mit include_archived=true werden archivierte Projekte ebenfalls zurückgegeben.
    """
    service = ProjectService(db)
    projects = service.get_all(include_archived=include_archived)
    result = []
    for p in projects:
        resp = ProjectResponse.model_validate(p)
        resp.is_archived = bool(p.is_archived)
        result.append(resp)
    return result


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Gibt ein einzelnes Projekt zurück inkl. Anzahl Tasks."""
    service = ProjectService(db)
    project = service.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden.")

    resp = ProjectResponse.model_validate(project)
    resp.is_archived = bool(project.is_archived)
    # Task-Count: alle zugeordneten Tasks zählen
    resp.task_count = len(project.tasks) if project.tasks else 0
    return resp


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    """Aktualisiert ein Projekt. Gibt 404 zurück wenn nicht gefunden."""
    service = ProjectService(db)
    project = service.update_project(project_id, data)
    if project is None:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden.")
    resp = ProjectResponse.model_validate(project)
    resp.is_archived = bool(project.is_archived)
    return resp


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """
    Löscht ein Projekt. Tasks des Projekts verlieren die Projektzuordnung (project_id = NULL).
    Gibt 404 zurück wenn nicht gefunden.
    """
    service = ProjectService(db)
    deleted = service.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden.")

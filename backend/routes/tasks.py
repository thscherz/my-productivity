"""
Task-Routen: CRUD, Kanban-Ansicht und Drag & Drop.
Prefix: /api/v1/tasks
"""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from services.task_service import TaskService
from schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskMoveRequest,
    TaskResponse,
    KanbanColumn,
    KanbanResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    """
    Erstellt einen neuen Task.
    Validierung im Service: Subtask-Regeln, Work Package-Regeln.
    """
    service = TaskService(db)
    task = service.create_task(data)
    return service.get_by_id(task.id)


@router.get("/kanban", response_model=KanbanResponse)
def get_kanban(
    status: Optional[str] = None,
    project_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Gibt das Kanban-Board zurück: Tasks gruppiert nach Zeithorizont.
    Optionale Filter: status, project_id, search (Freitext in Titel/Beschreibung).
    """
    service = TaskService(db)
    grouped = service.get_kanban(status=status, project_id=project_id, search=search)

    columns = {horizon: KanbanColumn(tasks=tasks) for horizon, tasks in grouped.items()}
    return KanbanResponse(columns=columns)


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    time_horizon: Optional[str] = None,
    status: Optional[str] = None,
    project_id: Optional[int] = None,
    parent_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Gibt Tasks zurück, optional gefiltert.
    Standardmässig werden nur Top-Level Tasks zurückgegeben (kein parent_id Filter).
    Mit parent_id werden Subtasks eines Work Package Tasks abgerufen.
    """
    service = TaskService(db)
    return service.get_all(
        time_horizon=time_horizon,
        status=status,
        project_id=project_id,
        parent_id=parent_id,
        search=search,
    )


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Gibt einen einzelnen Task zurück inkl. Subtasks und Projekt."""
    service = TaskService(db)
    return service.get_by_id(task_id)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    """
    Aktualisiert einen Task.
    Bei Status → 'done': completed_at wird gesetzt.
    Bei Work Package → 'done': alle offenen Subtasks werden kaskadiert erledigt.
    """
    service = TaskService(db)
    return service.update_task(task_id, data)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """
    Löscht einen Task. Subtasks werden via CASCADE mitgelöscht.
    Gibt 404 zurück wenn nicht gefunden.
    """
    service = TaskService(db)
    service.delete_task(task_id)


@router.patch("/{task_id}/move", response_model=TaskResponse)
def move_task(task_id: int, data: TaskMoveRequest, db: Session = Depends(get_db)):
    """
    Verschiebt einen Task via Drag & Drop.
    Erwartet: time_horizon (Ziel-Spalte) und position (absolute Zielposition).
    """
    service = TaskService(db)
    return service.move_task(task_id, data)

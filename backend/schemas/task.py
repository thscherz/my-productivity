"""Pydantic Schemas für Tasks."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel
from schemas.enums import TaskStatus, TimeHorizon, DurationTag
from schemas.project import ProjectResponse
from schemas.tag import TagResponse
from schemas.attachment import AttachmentResponse


class SubtaskSummary(BaseModel):
    """Zusammenfassung der Subtasks eines Work Packages."""
    total: int
    done: int


class TaskCreate(BaseModel):
    """Request-Body zum Erstellen eines Tasks."""
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.OPEN
    time_horizon: TimeHorizon = TimeHorizon.SOMEDAY_MAYBE
    duration_tag: Optional[DurationTag] = None
    is_work_package: bool = False
    parent_id: Optional[int] = None
    project_id: Optional[int] = None
    priority: Optional[str] = None
    waiting_for: Optional[str] = None
    due_date: Optional[str] = None
    tag_ids: Optional[list[int]] = None


class TaskUpdate(BaseModel):
    """Request-Body zum Aktualisieren eines Tasks (alle Felder optional)."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    time_horizon: Optional[TimeHorizon] = None
    duration_tag: Optional[DurationTag] = None
    project_id: Optional[int] = None
    priority: Optional[str] = None
    waiting_for: Optional[str] = None
    due_date: Optional[str] = None
    tag_ids: Optional[list[int]] = None


class TaskMoveRequest(BaseModel):
    """Request-Body für Drag & Drop: Task in einen anderen Zeithorizont verschieben."""
    time_horizon: TimeHorizon
    position: int


class TaskResponse(BaseModel):
    """Response-Schema für einen Task."""
    id: int
    title: str
    description: Optional[str]
    status: str
    time_horizon: str
    duration_tag: Optional[str]
    is_work_package: bool
    parent_id: Optional[int]
    parent_title: Optional[str] = None
    project_id: Optional[int]
    position: int
    horizon_set_at: Optional[str]
    created_at: str
    updated_at: str
    completed_at: Optional[str]
    priority: Optional[str] = None
    waiting_for: Optional[str] = None
    due_date: Optional[str] = None
    # Optionale Projekt-Details (eager loaded)
    project: Optional[ProjectResponse] = None
    # Optionale Subtask-Zusammenfassung (nur bei Work Packages)
    subtask_summary: Optional[SubtaskSummary] = None
    # Tags des Tasks
    tags: list[TagResponse] = []
    # Datei-Anhänge des Tasks
    attachments: list[AttachmentResponse] = []

    model_config = {"from_attributes": True}


class SubtaskResponse(BaseModel):
    """Response-Schema für einen Subtask (vereinfacht, ohne verschachtelte Subtasks)."""
    id: int
    title: str
    description: Optional[str]
    status: str
    duration_tag: Optional[str]
    position: int
    created_at: str
    updated_at: str
    completed_at: Optional[str]

    model_config = {"from_attributes": True}


class KanbanColumn(BaseModel):
    """Eine Spalte im Kanban-Board mit ihren Tasks."""
    tasks: list[TaskResponse]


class KanbanResponse(BaseModel):
    """Response-Schema für die Kanban-Ansicht: alle Spalten nach Zeithorizont."""
    columns: dict[str, KanbanColumn]

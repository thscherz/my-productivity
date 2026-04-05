"""Service für Tasks – Business-Logik, Validierung und Kaskadierung."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from models.task import Task
from repositories.task_repo import TaskRepo
from schemas.task import TaskCreate, TaskUpdate, TaskMoveRequest, TaskResponse, SubtaskSummary
from schemas.enums import TaskStatus

logger = logging.getLogger(__name__)


def _now_utc() -> str:
    """Gibt den aktuellen UTC-Zeitstempel als ISO-String zurück."""
    return datetime.now(timezone.utc).isoformat()


def _build_task_response(task: Task, repo: TaskRepo) -> TaskResponse:
    """
    Erstellt ein TaskResponse-Objekt aus einem Task-Model.
    Berechnet bei Work Packages die subtask_summary.
    """
    subtask_summary = None
    if task.is_work_package:
        subtasks = task.subtasks if task.subtasks is not None else repo.get_subtasks(task.id)
        total = len(subtasks)
        done = sum(1 for s in subtasks if s.status == TaskStatus.DONE.value)
        subtask_summary = SubtaskSummary(total=total, done=done)

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        time_horizon=task.time_horizon,
        duration_tag=task.duration_tag,
        is_work_package=bool(task.is_work_package),
        parent_id=task.parent_id,
        parent_title=task.parent.title if task.parent_id and hasattr(task, "parent") and task.parent else None,
        project_id=task.project_id,
        position=task.position,
        horizon_set_at=task.horizon_set_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
        priority=task.priority,
        waiting_for=task.waiting_for,
        due_date=task.due_date,
        project=task.project,
        subtask_summary=subtask_summary,
        tags=list(task.tags) if task.tags else [],
        attachments=list(task.attachments) if hasattr(task, "attachments") and task.attachments else [],
    )


class TaskService:
    """Business-Logik für Tasks."""

    def __init__(self, db: Session) -> None:
        self.repo = TaskRepo(db)
        self.db = db

    def create_task(self, data: TaskCreate) -> Task:
        """
        Erstellt einen neuen Task.
        Validierung:
        - Wenn parent_id gesetzt: Parent muss existieren und is_work_package=True sein.
        - Work Packages dürfen keinen Parent haben.
        Position wird automatisch als nächste freie Position gesetzt.
        """
        # Subtask-Validierung
        if data.parent_id is not None:
            parent = self.repo.get_by_id(data.parent_id)
            if parent is None:
                raise HTTPException(status_code=404, detail="Parent-Task nicht gefunden.")
            # Subtasks von Subtasks verhindern (nur eine Ebene)
            if parent.parent_id is not None:
                raise HTTPException(
                    status_code=400,
                    detail="Subtasks können nicht verschachtelt werden (nur eine Ebene).",
                )
            if data.is_work_package:
                raise HTTPException(
                    status_code=400,
                    detail="Work Packages können nicht als Subtask erstellt werden.",
                )
            # Auto-Promote: Parent wird automatisch zum Arbeitspaket
            if not parent.is_work_package:
                self.repo.update(parent.id, {"is_work_package": 1})
                logger.info("Task id=%s automatisch zum Arbeitspaket promotet.", parent.id)

            # Projekt vom Parent vererben (wenn Subtask kein eigenes hat)
            if data.project_id is None and parent.project_id is not None:
                data.project_id = parent.project_id
                logger.info("Projekt id=%s vom Parent vererbt.", parent.project_id)

        now = _now_utc()
        # Position innerhalb des Zeithorizonts berechnen
        horizon_value = data.time_horizon.value if data.time_horizon else "someday_maybe"
        position = self.repo.get_next_position(horizon_value)

        task = self.repo.create(data, now, position)

        # Tags zuordnen falls angegeben
        if data.tag_ids:
            self.repo.set_tags(task.id, data.tag_ids)
            # Task neu laden damit tags-Relationship befüllt ist
            task = self.repo.get_by_id(task.id)

        return task

    def get_all(
        self,
        time_horizon: Optional[str] = None,
        status: Optional[str] = None,
        project_id: Optional[int] = None,
        parent_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> List[TaskResponse]:
        """Gibt Tasks zurück, optional gefiltert. Baut TaskResponse-Objekte."""
        tasks = self.repo.get_all(
            time_horizon=time_horizon,
            status=status,
            project_id=project_id,
            parent_id=parent_id,
            search=search,
        )
        return [_build_task_response(t, self.repo) for t in tasks]

    def get_by_id(self, task_id: int) -> TaskResponse:
        """
        Gibt einen einzelnen Task zurück.
        HTTP 404 wenn nicht gefunden.
        """
        task = self.repo.get_by_id(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task nicht gefunden.")
        return _build_task_response(task, self.repo)

    def update_task(self, task_id: int, data: TaskUpdate) -> TaskResponse:
        """
        Aktualisiert einen Task.
        Besonderheiten:
        - Wenn time_horizon geändert: horizon_set_at wird aktualisiert.
        - Wenn status → "done": completed_at wird gesetzt.
        - Wenn Work Package status → "done": alle offenen Subtasks werden ebenfalls abgeschlossen.
        """
        existing = self.repo.get_by_id(task_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Task nicht gefunden.")

        now = _now_utc()
        updates: dict = {"updated_at": now}

        if data.title is not None:
            updates["title"] = data.title
        if data.description is not None:
            updates["description"] = data.description
        if data.duration_tag is not None:
            updates["duration_tag"] = data.duration_tag.value
        if data.project_id is not None:
            updates["project_id"] = data.project_id
        if data.priority is not None:
            updates["priority"] = data.priority
        if data.waiting_for is not None:
            updates["waiting_for"] = data.waiting_for
        if data.due_date is not None:
            updates["due_date"] = data.due_date

        # Zeithorizont-Änderung: horizon_set_at aktualisieren
        if data.time_horizon is not None:
            new_horizon = data.time_horizon.value
            if new_horizon != existing.time_horizon:
                updates["time_horizon"] = new_horizon
                updates["horizon_set_at"] = now
                # Bei Horizontwechsel an Ende der neuen Spalte einsortieren
                updates["position"] = self.repo.get_next_position(new_horizon)
            else:
                updates["time_horizon"] = new_horizon

        # Status-Änderung
        if data.status is not None:
            new_status = data.status.value
            updates["status"] = new_status

            # Task als erledigt markieren
            if new_status == TaskStatus.DONE.value and existing.completed_at is None:
                updates["completed_at"] = now

            # Wenn Work Package erledigt → alle offenen Subtasks kaskadiert abschliessen
            if new_status == TaskStatus.DONE.value and existing.is_work_package:
                subtasks = self.repo.get_subtasks(task_id)
                for subtask in subtasks:
                    if subtask.status not in (TaskStatus.DONE.value, TaskStatus.CANCELLED.value):
                        self.repo.update(subtask.id, {
                            "status": TaskStatus.DONE.value,
                            "completed_at": now,
                            "updated_at": now,
                        })
                logger.info(
                    "Work Package id=%s abgeschlossen: %s Subtasks kaskadiert erledigt.",
                    task_id, len(subtasks),
                )

            # Wenn Status von "waiting" auf etwas anderes wechselt: waiting_for zurücksetzen
            if (
                existing.status == TaskStatus.WAITING.value
                and new_status != TaskStatus.WAITING.value
            ):
                updates["waiting_for"] = None

        updated_task = self.repo.update(task_id, updates)
        if updated_task is None:
            raise HTTPException(status_code=404, detail="Task nicht gefunden.")

        # Tags aktualisieren falls angegeben
        if data.tag_ids is not None:
            self.repo.set_tags(task_id, data.tag_ids)

        # Task neu laden damit alle Relationships (inkl. tags) aktuell sind
        refreshed = self.repo.get_by_id(task_id)
        if refreshed is None:
            raise HTTPException(status_code=404, detail="Task nicht gefunden.")
        return _build_task_response(refreshed, self.repo)

    def delete_task(self, task_id: int) -> None:
        """
        Löscht einen Task. Subtasks werden via CASCADE mitgelöscht.
        HTTP 404 wenn nicht gefunden.
        """
        deleted = self.repo.delete(task_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Task nicht gefunden.")

    def move_task(self, task_id: int, request: TaskMoveRequest) -> TaskResponse:
        """
        Verschiebt einen Task via Drag & Drop in einen neuen Zeithorizont.
        Setzt die gewünschte Position direkt (Frontend liefert absolute Position).
        HTTP 404 wenn nicht gefunden.
        """
        now = _now_utc()
        task = self.repo.move(task_id, request.time_horizon.value, request.position, now)
        if task is None:
            raise HTTPException(status_code=404, detail="Task nicht gefunden.")
        # Task mit geladenen Relations neu holen
        return self.get_by_id(task_id)

    def get_kanban(
        self,
        status: Optional[str] = None,
        project_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> Dict[str, List[TaskResponse]]:
        """
        Gibt das Kanban-Board zurück: Tasks gruppiert nach Zeithorizont.
        Jede Spalte enthält TaskResponse-Objekte inkl. subtask_summary.
        """
        grouped = self.repo.get_kanban(
            status=status,
            project_id=project_id,
            search=search,
        )
        return {
            horizon: [_build_task_response(t, self.repo) for t in tasks]
            for horizon, tasks in grouped.items()
        }

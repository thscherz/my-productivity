"""Repository für Tasks – kapselt alle Datenbankoperationen."""
from __future__ import annotations

import logging
from typing import Dict, List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from models.task import Task
from models.task_tag import TaskTag
from models.tag import Tag
from schemas.task import TaskCreate, TaskUpdate
from schemas.enums import TimeHorizon, TaskStatus

logger = logging.getLogger(__name__)


class TaskRepo:
    """Datenbankzugriff für Tasks."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, data: TaskCreate, now: str, position: int) -> Task:
        """Erstellt einen neuen Task."""
        task = Task(
            title=data.title,
            description=data.description,
            status=data.status.value if data.status else "open",
            time_horizon=data.time_horizon.value if data.time_horizon else "someday_maybe",
            duration_tag=data.duration_tag.value if data.duration_tag else None,
            is_work_package=1 if data.is_work_package else 0,
            parent_id=data.parent_id,
            project_id=data.project_id,
            position=position,
            horizon_set_at=now,
            created_at=now,
            updated_at=now,
            priority=data.priority,
            waiting_for=data.waiting_for,
            due_date=data.due_date,
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        logger.info("Task erstellt: id=%s title='%s'", task.id, task.title)
        return task

    def set_tags(self, task_id: int, tag_ids: List[int]) -> None:
        """
        Ersetzt alle Tags eines Tasks.
        Bestehende TaskTag-Einträge werden gelöscht und neu gesetzt.
        """
        # Bestehende Verknüpfungen entfernen
        self.db.query(TaskTag).filter(TaskTag.task_id == task_id).delete()
        # Neue Verknüpfungen anlegen
        for tag_id in tag_ids:
            self.db.add(TaskTag(task_id=task_id, tag_id=tag_id))
        self.db.commit()
        logger.info("Tags für Task id=%s aktualisiert: %s", task_id, tag_ids)

    def get_all(
        self,
        time_horizon: Optional[str] = None,
        status: Optional[str] = None,
        project_id: Optional[int] = None,
        parent_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> List[Task]:
        """
        Gibt Tasks zurück, optional gefiltert nach Zeithorizont, Status,
        Projekt, Parent oder Suchbegriff (title/description).
        Nur Top-Level Tasks (parent_id IS NULL) werden standardmässig zurückgegeben,
        ausser parent_id ist explizit gesetzt.
        """
        query = self.db.query(Task).options(
            joinedload(Task.project),
        )

        # Standardmässig nur Top-Level Tasks
        if parent_id is not None:
            query = query.filter(Task.parent_id == parent_id)
        else:
            query = query.filter(Task.parent_id.is_(None))

        if time_horizon is not None:
            query = query.filter(Task.time_horizon == time_horizon)

        # Standard: Nur aktive Tasks (open, in_progress, waiting) — nicht done/cancelled
        if status is None:
            query = query.filter(Task.status.in_([
                TaskStatus.OPEN.value,
                TaskStatus.IN_PROGRESS.value,
                TaskStatus.WAITING.value,
            ]))
        else:
            query = query.filter(Task.status == status)
        if project_id is not None:
            query = query.filter(Task.project_id == project_id)
        if search is not None:
            term = f"%{search}%"
            query = query.filter(
                Task.title.ilike(term) | Task.description.ilike(term)
            )

        return query.order_by(Task.position, Task.created_at).all()

    def get_by_id(self, task_id: int) -> Optional[Task]:
        """
        Gibt einen Task anhand der ID zurück.
        Lädt Projekt, Subtasks und Tags explizit (kein lazy joined um Rekursion zu vermeiden).
        """
        return (
            self.db.query(Task)
            .options(
                joinedload(Task.project),
                joinedload(Task.subtasks),
                joinedload(Task.tags),
            )
            .filter(Task.id == task_id)
            .first()
        )

    def update(self, task_id: int, updates: dict) -> Optional[Task]:
        """
        Aktualisiert einen Task mit einem Dictionary von Feldern.
        Gibt None zurück wenn nicht gefunden.
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if task is None:
            return None

        for field, value in updates.items():
            setattr(task, field, value)

        self.db.commit()
        self.db.refresh(task)
        logger.info("Task aktualisiert: id=%s", task.id)
        return task

    def delete(self, task_id: int) -> bool:
        """
        Löscht einen Task. Subtasks werden via CASCADE gelöscht.
        Gibt True zurück wenn gelöscht, False wenn nicht gefunden.
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if task is None:
            return False

        self.db.delete(task)
        self.db.commit()
        logger.info("Task gelöscht: id=%s (inkl. Subtasks)", task_id)
        return True

    def get_kanban(
        self,
        status: Optional[str] = None,
        project_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> Dict[str, List[Task]]:
        """
        Gibt Tasks gruppiert nach Zeithorizont zurück.
        Gibt für jeden Zeithorizont eine Liste zurück (auch leere Listen).
        Zeigt Top-Level Tasks UND Subtasks (jeweils in ihrem eigenen Horizont).
        """
        query = self.db.query(Task).options(
            joinedload(Task.project),
            joinedload(Task.subtasks),
            joinedload(Task.tags),
            joinedload(Task.parent),
        )

        # Standard: Nur aktive Tasks (open, in_progress, waiting) — nicht done/cancelled
        if status is None:
            query = query.filter(Task.status.in_([
                TaskStatus.OPEN.value,
                TaskStatus.IN_PROGRESS.value,
                TaskStatus.WAITING.value,
            ]))
        else:
            query = query.filter(Task.status == status)
        if project_id is not None:
            query = query.filter(Task.project_id == project_id)
        if search is not None:
            term = f"%{search}%"
            query = query.filter(
                Task.title.ilike(term) | Task.description.ilike(term)
            )

        all_tasks = query.order_by(Task.position, Task.created_at).all()

        # Subtasks nachträglich filtern (nur active States behalten)
        active_statuses = {TaskStatus.OPEN.value, TaskStatus.IN_PROGRESS.value, TaskStatus.WAITING.value}
        for task in all_tasks:
            if task.subtasks:
                # Nur Subtasks mit aktiven Status behalten
                task.subtasks = [s for s in task.subtasks if s.status in active_statuses]

        # Alle Zeithorizonte initialisieren (auch leere)
        result: Dict[str, List[Task]] = {horizon.value: [] for horizon in TimeHorizon}
        for task in all_tasks:
            if task.time_horizon in result:
                result[task.time_horizon].append(task)

        return result

    def move(self, task_id: int, time_horizon: str, position: int, now: str) -> Optional[Task]:
        """
        Verschiebt einen Task in einen neuen Zeithorizont und setzt seine Position.
        Gibt None zurück wenn nicht gefunden.
        """
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if task is None:
            return None

        old_horizon = task.time_horizon
        task.time_horizon = time_horizon
        task.position = position
        task.updated_at = now

        # Zeithorizont-Timestamp nur setzen wenn sich der Horizont geändert hat
        if old_horizon != time_horizon:
            task.horizon_set_at = now

        self.db.commit()
        self.db.refresh(task)
        logger.info(
            "Task verschoben: id=%s horizon=%s position=%s",
            task_id, time_horizon, position,
        )
        return task

    def get_next_position(self, time_horizon: str) -> int:
        """
        Gibt die nächste freie Position für einen Zeithorizont zurück.
        Berechnung: max(position) + 1000, damit späteres Einsortieren möglich bleibt.
        """
        result = (
            self.db.query(func.max(Task.position))
            .filter(Task.time_horizon == time_horizon, Task.parent_id.is_(None))
            .scalar()
        )
        # Erster Task bekommt Position 1000
        return (result or 0) + 1000

    def get_subtasks(self, parent_id: int) -> List[Task]:
        """Gibt alle Subtasks eines Work Package Tasks zurück."""
        return (
            self.db.query(Task)
            .filter(Task.parent_id == parent_id)
            .order_by(Task.position, Task.created_at)
            .all()
        )

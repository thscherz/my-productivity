"""SQLAlchemy Model für Tasks (unified model mit Subtask-Unterstützung)."""
from __future__ import annotations

from typing import List, Optional
from sqlalchemy import Integer, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Task(Base):
    """
    Einheitliches Task-Model für alle Aufgabentypen.
    Unterstützt Subtasks via self-referencing FK (parent_id → tasks.id).
    Work Packages (is_work_package=1) können Subtasks haben, aber nicht selbst
    einem anderen Work Package untergeordnet sein.
    """

    __tablename__ = "tasks"

    __table_args__ = (
        # Erlaubte Status-Werte
        CheckConstraint(
            "status IN ('open', 'in_progress', 'waiting', 'done', 'cancelled')",
            name="ck_tasks_status",
        ),
        # Erlaubte Zeithorizonte (inkl. inbox und tomorrow)
        CheckConstraint(
            "time_horizon IN ('inbox', 'today', 'tomorrow', 'this_week', 'next_week', "
            "'this_month', 'next_month', 'this_quarter', 'next_quarter', 'this_year', "
            "'next_year', 'someday_maybe')",
            name="ck_tasks_time_horizon",
        ),
        # Erlaubte Dauer-Tags (oder NULL)
        CheckConstraint(
            "duration_tag IS NULL OR duration_tag IN "
            "('5min', '15min', '30min', '1h', '2h', '4h', '1d')",
            name="ck_tasks_duration_tag",
        ),
        # Erlaubte Prioritäten (oder NULL)
        CheckConstraint(
            "priority IS NULL OR priority IN ('high', 'medium', 'low')",
            name="ck_tasks_priority",
        ),
        # Work Packages dürfen keine Subtasks sein (keine verschachtelte Work Packages)
        CheckConstraint(
            "NOT (is_work_package = 1 AND parent_id IS NOT NULL)",
            name="ck_tasks_no_nested_work_packages",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    # Beschreibung / Notizen (unterstützt Markdown)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Status des Tasks
    status: Mapped[str] = mapped_column(Text, nullable=False, default="open")
    # Zeithorizont (Kanban-Spalte)
    time_horizon: Mapped[str] = mapped_column(Text, nullable=False, default="someday_maybe")
    # Optionale Zeitschätzung
    duration_tag: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Optionale Priorität (high, medium, low)
    priority: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Auf wen/was wird gewartet (nur relevant bei status=waiting)
    waiting_for: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Optionales Fälligkeitsdatum (ISO-Format YYYY-MM-DD)
    due_date: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Work Package: kann Subtasks haben
    is_work_package: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Self-referencing FK für Subtasks (nur für Nicht-Work-Packages erlaubt)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
    )
    # Optionale Projektzuordnung
    project_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Sortierreihenfolge innerhalb einer Zeithorizont-Spalte
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Zeitstempel: wann wurde der Zeithorizont zuletzt geändert
    horizon_set_at: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # ISO-Timestamps in UTC
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    # Wird gesetzt wenn status → "done"
    completed_at: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationship zum Parent-Task
    parent: Mapped[Optional["Task"]] = relationship(
        "Task",
        remote_side="Task.id",
        back_populates="subtasks",
        foreign_keys=[parent_id],
    )
    # Subtasks werden bei Delete des Parents kaskadiert gelöscht
    # KEIN lazy="joined" hier – würde rekursive Queries erzeugen!
    subtasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="parent",
        foreign_keys=[parent_id],
        cascade="all, delete-orphan",
    )

    # Relationship zum Projekt
    project: Mapped[Optional["Project"]] = relationship(  # type: ignore[name-defined]
        "Project",
        back_populates="tasks",
        foreign_keys=[project_id],
    )

    # Tags via Assoziationstabelle task_tags (Many-to-Many)
    tags = relationship("Tag", secondary="task_tags", backref="tasks")

    # Datei-Anhänge des Tasks – werden bei Task-Löschung kaskadiert gelöscht
    attachments = relationship("Attachment", backref="task", cascade="all, delete-orphan")

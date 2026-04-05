"""Enumerations für Tasks und Projekte."""

from enum import Enum


class TimeHorizon(str, Enum):
    """Zeithorizonte für Tasks (Kanban-Spalten)."""
    INBOX = "inbox"
    TODAY = "today"
    TOMORROW = "tomorrow"
    THIS_WEEK = "this_week"
    NEXT_WEEK = "next_week"
    THIS_MONTH = "this_month"
    NEXT_MONTH = "next_month"
    THIS_QUARTER = "this_quarter"
    NEXT_QUARTER = "next_quarter"
    THIS_YEAR = "this_year"
    NEXT_YEAR = "next_year"
    SOMEDAY_MAYBE = "someday_maybe"


class TaskStatus(str, Enum):
    """Mögliche Status-Werte eines Tasks."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    DONE = "done"
    CANCELLED = "cancelled"


class Priority(str, Enum):
    """Prioritätsstufen für Tasks."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DurationTag(str, Enum):
    """Zeitschätzungen für Tasks."""
    MIN_5 = "5min"
    MIN_15 = "15min"
    MIN_30 = "30min"
    HOUR_1 = "1h"
    HOUR_2 = "2h"
    HOUR_4 = "4h"
    DAY_1 = "1d"

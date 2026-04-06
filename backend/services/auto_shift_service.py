"""Service für den täglichen Horizont-Auto-Shift."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from sqlalchemy import update, or_
from sqlalchemy.orm import Session

from models.task import Task

logger = logging.getLogger(__name__)


class AutoShiftService:
    """Verschiebt relative Zeithorizonte täglich nach vorne."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def run_daily_shift(self) -> None:
        """
        Wird täglich um 04:00 Uhr Europe/Berlin aufgerufen.

        Schritt 1 — Relative Horizont-Shifts:
        - tomorrow → today (immer)
        - next_week → this_week (nur montags)
        - next_month → this_month (nur am 1. des Monats)
        - next_quarter → this_quarter (nur am Quartalsbeginn: Jan/Apr/Jul/Okt 1.)
        - next_year → this_year (nur am 1. Januar)

        Schritt 2 — Due-Date-basierter Shift:
        Tasks mit due_date = heute, die noch nicht im Horizont "today" sind,
        werden auf "today" gesetzt — sofern sie nicht done/cancelled sind.
        Ausnahme: Tasks im Horizont "someday_maybe" werden nicht automatisch
        verschoben (bewusst zurückgestellt).

        Nur Tasks mit status != done und != cancelled werden verschoben.
        horizon_set_at und updated_at werden auf jetzt gesetzt.
        """
        now = datetime.now(timezone.utc)
        today = now.date()
        today_iso = today.isoformat()
        now_iso = now.isoformat()

        # --- Schritt 1: Relative Horizonte verschieben ---
        shifts = [("tomorrow", "today")]

        # Montag (weekday 0): next_week → this_week
        if today.weekday() == 0:
            shifts.append(("next_week", "this_week"))

        # Monatserster: next_month → this_month
        if today.day == 1:
            shifts.append(("next_month", "this_month"))

        # Quartalsbeginn (Jan, Apr, Jul, Okt): next_quarter → this_quarter
        if today.day == 1 and today.month in (1, 4, 7, 10):
            shifts.append(("next_quarter", "this_quarter"))

        # 1. Januar: next_year → this_year
        if today.month == 1 and today.day == 1:
            shifts.append(("next_year", "this_year"))

        total_shifted = 0
        for from_horizon, to_horizon in shifts:
            result = self.db.execute(
                update(Task)
                .where(Task.time_horizon == from_horizon)
                .where(Task.status.notin_(["done", "cancelled"]))
                .values(
                    time_horizon=to_horizon,
                    horizon_set_at=now_iso,
                    updated_at=now_iso,
                )
            )
            count = result.rowcount
            total_shifted += count
            logger.info(
                "Auto-Shift (relativ): %s Tasks von '%s' → '%s' verschoben.",
                count, from_horizon, to_horizon,
            )

        # --- Schritt 2: Due-Date-basierter Shift → today ---
        # Tasks deren Fälligkeitsdatum heute ist (oder bereits überschritten) und
        # die noch nicht in "today" oder "someday_maybe" sind, werden auf "today" gesetzt.
        # Überfällige Tasks (due_date < heute) werden ebenfalls auf "today" gezogen,
        # damit sie nicht still im falschen Horizont versauern.
        due_result = self.db.execute(
            update(Task)
            .where(Task.due_date.isnot(None))
            .where(Task.due_date <= today_iso)
            .where(Task.status.notin_(["done", "cancelled"]))
            .where(Task.time_horizon.notin_(["today", "someday_maybe"]))
            .values(
                time_horizon="today",
                horizon_set_at=now_iso,
                updated_at=now_iso,
            )
        )
        due_count = due_result.rowcount
        total_shifted += due_count
        if due_count > 0:
            logger.info(
                "Auto-Shift (due_date): %s Tasks mit fälligem Due-Date → 'today' verschoben.",
                due_count,
            )

        self.db.commit()
        logger.info("Auto-Shift abgeschlossen. Total verschoben: %s Tasks.", total_shifted)

"""Service für den täglichen Horizont-Auto-Shift."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from sqlalchemy import update
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
        Verschiebt Zeithorizonte nach vorne:
        - tomorrow → today (immer)
        - next_week → this_week (nur montags)
        - next_month → this_month (nur am 1. des Monats)
        - next_year → this_year (nur am 1. Januar)

        Nur Tasks mit status != done und != cancelled werden verschoben.
        horizon_set_at und updated_at werden auf jetzt gesetzt.
        """
        now = datetime.now(timezone.utc)
        today = now.date()
        now_iso = now.isoformat()

        # Immer: tomorrow → today
        shifts = [("tomorrow", "today")]

        # Montag: next_week → this_week
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
                "Auto-Shift: %s Tasks von '%s' → '%s' verschoben.",
                count, from_horizon, to_horizon,
            )

        self.db.commit()
        logger.info("Auto-Shift abgeschlossen. Total verschoben: %s Tasks.", total_shifted)

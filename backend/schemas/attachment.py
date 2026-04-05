"""Pydantic Schemas für Datei-Anhänge."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class AttachmentResponse(BaseModel):
    """Response-Schema für einen Datei-Anhang."""

    id: int
    task_id: int
    # Originaler Dateiname für die Anzeige im Frontend
    filename: str
    content_type: Optional[str] = None
    file_size: Optional[int] = None
    created_at: str

    model_config = {"from_attributes": True}

"""Pydantic Schemas für Tags."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class TagCreate(BaseModel):
    """Request-Body zum Erstellen eines Tags."""
    name: str
    color: Optional[str] = None


class TagUpdate(BaseModel):
    """Request-Body zum Aktualisieren eines Tags (alle Felder optional)."""
    name: Optional[str] = None
    color: Optional[str] = None


class TagResponse(BaseModel):
    """Response-Schema für einen Tag."""
    id: int
    name: str
    color: Optional[str] = None

    model_config = {"from_attributes": True}

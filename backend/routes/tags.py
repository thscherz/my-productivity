"""API-Routen für Tag-Verwaltung."""
from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from services.tag_service import TagService
from schemas.tag import TagCreate, TagUpdate, TagResponse

router = APIRouter(prefix="/api/v1/tags", tags=["tags"])


@router.post("", response_model=TagResponse, status_code=201)
def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    """Erstellt einen neuen Tag."""
    service = TagService(db)
    return service.create_tag(data)


@router.get("", response_model=List[TagResponse])
def list_tags(db: Session = Depends(get_db)):
    """Gibt alle Tags zurück."""
    service = TagService(db)
    return service.get_all()


@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: int, data: TagUpdate, db: Session = Depends(get_db)):
    """Aktualisiert einen Tag."""
    service = TagService(db)
    return service.update_tag(tag_id, data)


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    """Löscht einen Tag und alle zugehörigen TaskTag-Verknüpfungen."""
    service = TagService(db)
    service.delete_tag(tag_id)

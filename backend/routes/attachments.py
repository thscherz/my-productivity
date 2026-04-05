"""
Attachment-Routen: Upload, Download, Auflistung und Löschen von Task-Anhängen.
Prefix: /api/v1/tasks/{task_id}/attachments
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models.attachment import Attachment
from models.task import Task
from schemas.attachment import AttachmentResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tasks/{task_id}/attachments", tags=["attachments"])

# Basis-Upload-Verzeichnis relativ zum routes/-Ordner: ../data/attachments/
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "attachments")

# Maximale Dateigrösse: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024


def _task_dir(task_id: int) -> str:
    """Gibt den Verzeichnispfad für die Anhänge eines Tasks zurück."""
    return os.path.join(UPLOAD_DIR, str(task_id))


def _now_utc() -> str:
    """Gibt den aktuellen UTC-Zeitstempel als ISO-String zurück."""
    return datetime.now(timezone.utc).isoformat()


def _get_task_or_404(task_id: int, db: Session) -> Task:
    """Lädt einen Task oder wirft HTTP 404."""
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task nicht gefunden.")
    return task


@router.post("", response_model=AttachmentResponse, status_code=201)
async def upload_attachment(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Lädt eine Datei als Anhang für den angegebenen Task hoch.
    Dateiformat: multipart/form-data, Feld 'file'.
    Maximale Grösse: 10 MB.
    """
    _get_task_or_404(task_id, db)

    # Dateiinhalt einlesen und Grösse prüfen
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Datei zu gross: {file_size} Bytes. Maximum: {MAX_FILE_SIZE} Bytes (10 MB).",
        )

    # Aufgaben-Verzeichnis erstellen falls noch nicht vorhanden
    task_upload_dir = _task_dir(task_id)
    os.makedirs(task_upload_dir, exist_ok=True)

    # Eindeutiger Dateiname mit UUID-Prefix verhindert Kollisionen bei gleichnamigen Dateien
    original_filename = file.filename or "upload"
    stored_filename = f"{uuid.uuid4()}_{original_filename}"
    file_path = os.path.join(task_upload_dir, stored_filename)

    # Datei auf Disk schreiben
    with open(file_path, "wb") as f:
        f.write(content)

    logger.info(
        "Anhang hochgeladen: task_id=%s, filename=%s, size=%s Bytes",
        task_id, original_filename, file_size,
    )

    # Datenbank-Eintrag erstellen
    attachment = Attachment(
        task_id=task_id,
        filename=original_filename,
        stored_filename=stored_filename,
        content_type=file.content_type,
        file_size=file_size,
        created_at=_now_utc(),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment


@router.get("", response_model=List[AttachmentResponse])
def list_attachments(task_id: int, db: Session = Depends(get_db)):
    """Gibt alle Anhänge eines Tasks zurück."""
    _get_task_or_404(task_id, db)

    attachments = (
        db.query(Attachment)
        .filter(Attachment.task_id == task_id)
        .order_by(Attachment.created_at)
        .all()
    )
    return attachments


@router.get("/{attachment_id}/download")
def download_attachment(task_id: int, attachment_id: int, db: Session = Depends(get_db)):
    """
    Gibt die Datei eines Anhangs zum Download zurück.
    Content-Disposition: attachment sorgt dafür, dass der Browser die Datei speichert.
    """
    _get_task_or_404(task_id, db)

    attachment = db.get(Attachment, attachment_id)
    if attachment is None or attachment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Anhang nicht gefunden.")

    file_path = os.path.join(_task_dir(task_id), attachment.stored_filename)

    if not os.path.isfile(file_path):
        logger.error(
            "Anhang-Datei nicht auf Disk: attachment_id=%s, path=%s",
            attachment_id, file_path,
        )
        raise HTTPException(
            status_code=404,
            detail="Anhang-Datei nicht auf Disk gefunden. Möglicherweise wurde sie manuell gelöscht.",
        )

    return FileResponse(
        path=file_path,
        filename=attachment.filename,
        media_type=attachment.content_type or "application/octet-stream",
    )


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(task_id: int, attachment_id: int, db: Session = Depends(get_db)):
    """
    Löscht einen Anhang aus der Datenbank und die zugehörige Datei von Disk.
    Gibt 404 zurück wenn Anhang nicht gefunden.
    """
    _get_task_or_404(task_id, db)

    attachment = db.get(Attachment, attachment_id)
    if attachment is None or attachment.task_id != task_id:
        raise HTTPException(status_code=404, detail="Anhang nicht gefunden.")

    # Datei von Disk löschen (Fehler werden geloggt aber nicht nach oben gegeben)
    file_path = os.path.join(_task_dir(task_id), attachment.stored_filename)
    if os.path.isfile(file_path):
        try:
            os.remove(file_path)
            logger.info("Anhang-Datei gelöscht: %s", file_path)
        except OSError as e:
            logger.error("Konnte Anhang-Datei nicht löschen: %s — %s", file_path, e)
    else:
        logger.warning("Anhang-Datei nicht auf Disk beim Löschen: %s", file_path)

    # Leeres Task-Verzeichnis aufräumen (optional, kein Fehler wenn nicht möglich)
    task_dir = _task_dir(task_id)
    try:
        if os.path.isdir(task_dir) and not os.listdir(task_dir):
            os.rmdir(task_dir)
    except OSError:
        pass

    # Datenbank-Eintrag löschen
    db.delete(attachment)
    db.commit()

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from supabase import Client

from app.core.auth import AuthUser, get_db_client, require_admin
from app.schemas.models import ImportResult
from app.services.csv_import import COMPETENCIA_DEFAULT, import_csv_bytes

router = APIRouter(prefix="/importacao", tags=["importacao"])


@router.post("/csv", response_model=ImportResult)
async def import_csv(
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
    file: UploadFile = File(...),
    competencia: date | None = None,
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv")
    content_type = (file.content_type or "").lower()
    if content_type and content_type not in {
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "application/octet-stream",
        "text/plain",
    }:
        raise HTTPException(status_code=400, detail="Content-Type inválido para CSV")
    content = await file.read()
    max_bytes = 10 * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail="CSV excede o limite de 10 MB")
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")
    try:
        result = import_csv_bytes(
            client, content, competencia=competencia or COMPETENCIA_DEFAULT
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return ImportResult(**result)

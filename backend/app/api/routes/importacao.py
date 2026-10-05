import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from supabase import Client

from app.core.auth import AuthUser, get_db_client, require_admin
from app.schemas.models import ImportResult
from app.services.csv_import import (
    build_import_template_xlsx,
    import_xlsx_bytes,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/importacao", tags=["importacao"])

# A Vercel recusa corpos acima de 4,5 MB antes de chegar na API.
MAX_UPLOAD_BYTES = 4 * 1024 * 1024


@router.get("/modelo.xlsx")
def download_modelo(_: Annotated[AuthUser, Depends(require_admin)]):
    return Response(
        content=build_import_template_xlsx(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="modelo_importacao.xlsx"',
        },
    )


@router.post("/xlsx", response_model=ImportResult)
def import_xlsx(
    user: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
    file: UploadFile = File(...),
    competencia: date | None = None,
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Envie um arquivo Excel (.xlsx)")
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo excede o limite de 4 MB")
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")
    try:
        result = import_xlsx_bytes(
            client,
            content,
            competencia=competencia,
            created_by=user.id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao importar Excel")
        raise HTTPException(status_code=400, detail="Falha ao importar Excel") from exc
    return ImportResult(**result)

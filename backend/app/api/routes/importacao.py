import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from supabase import Client

from app.core.auth import AuthUser, get_db_client, require_admin
from app.schemas.models import ImportResult
from app.services.csv_import import (
    COMPETENCIA_DEFAULT,
    build_import_template_xlsx,
    import_xlsx_bytes,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/importacao", tags=["importacao"])


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
async def import_xlsx(
    user: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
    file: UploadFile = File(...),
    competencia: date | None = None,
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Envie um arquivo Excel (.xlsx)")
    content = await file.read()
    max_bytes = 10 * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail="Arquivo excede o limite de 10 MB")
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio")
    try:
        result = import_xlsx_bytes(
            client,
            content,
            competencia=competencia or COMPETENCIA_DEFAULT,
            created_by=user.id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao importar Excel")
        raise HTTPException(status_code=400, detail="Falha ao importar Excel") from exc
    return ImportResult(**result)

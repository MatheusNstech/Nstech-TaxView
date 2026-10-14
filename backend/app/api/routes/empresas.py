from datetime import UTC, date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from supabase import Client

from app.core.auth import AuthUser, get_current_user, get_db_client, require_admin
from app.core.clock import today_br
from app.schemas.models import (
    CertidaoOut,
    CertificadoDigitalOut,
    EmpresaContatoOut,
    EmpresaContatosPut,
    EmpresaCreate,
    EmpresaGrupoOut,
    EmpresaOut,
    EmpresaUpdate,
)
from app.services import cartao_cnpj, certidoes, certificado_digital
from app.services.db import constraint_errors, fetch_all, reject_nulls
from app.services.empresas_painel import cnpj_raiz, montar_grupos, ordenar_grupo
from app.services.pdf_texto import MAX_BYTES, is_pdf, so_digitos, texto_do_pdf

router = APIRouter(prefix="/empresas", tags=["empresas"])

DUPLICADA = "Já existe uma empresa com esse CNPJ"


def _competencia_anterior(today: date) -> date:
    return date(today.year - 1, 12, 1) if today.month == 1 else date(today.year, today.month - 1, 1)


@router.get("", response_model=list[EmpresaOut])
def list_empresas(
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    return fetch_all(
        lambda: client.table("empresas").select("*").order("razao_social").order("id")
    )


@router.get("/painel", response_model=list[EmpresaGrupoOut])
def painel_empresas(
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    competencia: date | None = None,
):
    today = today_br()
    comp = (competencia or _competencia_anterior(today)).replace(day=1)
    empresas = fetch_all(
        lambda: client.table("empresas").select("*").eq("ativa", True).order("id")
    )
    contatos = fetch_all(lambda: client.table("empresa_contatos").select("*").order("id"))
    obrigacoes = fetch_all(
        lambda: client.table("obrigacoes")
        .select(
            "id,empresa_id,status,prazo_legal,prazo_fiscal,data_entrega,entrega_original,"
            "responsavel_id,responsaveis(id,nome),"
            "obrigacao_responsaveis(responsavel_id,responsaveis(id,nome))"
        )
        .eq("competencia", comp.isoformat())
        .order("id")
    )
    certidoes_rows = fetch_all(lambda: client.table("empresa_certidoes").select("*").order("id"))
    certificados = fetch_all(
        lambda: client.table("empresa_certificados").select("*").order("empresa_id")
    )
    return montar_grupos(empresas, contatos, obrigacoes, today, certidoes_rows, certificados)


@router.post("", response_model=EmpresaOut, status_code=status.HTTP_201_CREATED)
def create_empresa(
    payload: EmpresaCreate,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    with constraint_errors(duplicate=DUPLICADA):
        data = client.table("empresas").insert(payload.model_dump()).execute().data
    if not data:
        raise HTTPException(status_code=400, detail="Falha ao criar empresa")
    return data[0]


@router.patch("/{empresa_id}", response_model=EmpresaOut)
def update_empresa(
    empresa_id: UUID,
    payload: EmpresaUpdate,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    body = payload.model_dump(exclude_unset=True)
    reject_nulls(body, ("cnpj", "razao_social", "bu", "ativa"))
    if "nome_fantasia" in body:
        body["nome_fantasia"] = (body["nome_fantasia"] or "").strip() or None
    with constraint_errors(duplicate=DUPLICADA):
        data = client.table("empresas").update(body).eq("id", str(empresa_id)).execute().data
    if not data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    logo = {k: body[k] for k in ("logo_url", "logo_url_escuro") if k in body}
    if logo:
        _propagar_logo_no_grupo(client, data[0], logo)
    return data[0]


def _propagar_logo_no_grupo(client: Client, empresa: dict, logo: dict) -> None:
    """Matriz e filiais dividem o logo: Kanban e calendário mostram o de cada unidade."""
    raiz = cnpj_raiz(empresa)
    if raiz.startswith("id:"):
        return
    todas = fetch_all(lambda: client.table("empresas").select("id,cnpj").order("id"))
    irmas = [
        str(e["id"])
        for e in todas
        if str(e["id"]) != str(empresa["id"]) and cnpj_raiz(e) == raiz
    ]
    if irmas:
        client.table("empresas").update(logo).in_("id", irmas).execute()


@router.put("/{empresa_id}/contatos", response_model=list[EmpresaContatoOut])
def replace_contatos(
    empresa_id: UUID,
    payload: EmpresaContatosPut,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    existe = client.table("empresas").select("id").eq("id", str(empresa_id)).limit(1).execute().data
    if not existe:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    (
        client.table("empresa_contatos")
        .delete()
        .eq("empresa_id", str(empresa_id))
        .eq("area", payload.area)
        .execute()
    )
    if not payload.contatos:
        return []
    rows = [
        {
            "empresa_id": str(empresa_id),
            "area": payload.area,
            "nome": c.nome,
            "email": c.email,
            "ordem": i,
        }
        for i, c in enumerate(payload.contatos)
    ]
    return client.table("empresa_contatos").insert(rows).execute().data or []


def _ler_upload(file: UploadFile) -> bytes:
    content = file.file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo excede o limite de 4 MB")
    if not is_pdf(content):
        raise HTTPException(status_code=400, detail="Envie o arquivo em PDF")
    return content


def _pdf_response(content: bytes, filename: str, download: bool) -> Response:
    modo = "attachment" if download else "inline"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{modo}; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )


def _empresa_ou_404(client: Client, empresa_id: UUID) -> dict:
    data = (
        client.table("empresas")
        .select("id,cnpj,cartao_cnpj_path")
        .eq("id", str(empresa_id))
        .limit(1)
        .execute()
        .data
    )
    if not data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return data[0]


@router.get("/{empresa_id}/cartao-cnpj")
def baixar_cartao_cnpj(
    empresa_id: UUID,
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    download: bool = False,
):
    empresa = _empresa_ou_404(client, empresa_id)
    path = empresa.get("cartao_cnpj_path")
    if not path:
        raise HTTPException(status_code=404, detail="Empresa sem Cartão CNPJ")
    try:
        content = client.storage.from_(cartao_cnpj.BUCKET).download(path)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="Arquivo do Cartão CNPJ não encontrado") from exc
    return _pdf_response(content, cartao_cnpj.nome_arquivo(empresa["cnpj"]), download)


@router.post("/{empresa_id}/cartao-cnpj", response_model=EmpresaOut)
def enviar_cartao_cnpj(
    empresa_id: UUID,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
    file: UploadFile = File(...),
):
    empresa = _empresa_ou_404(client, empresa_id)
    content = _ler_upload(file)
    lido = cartao_cnpj.cnpj_do_pdf(content)
    if lido and so_digitos(lido) != so_digitos(empresa["cnpj"]):
        raise HTTPException(
            status_code=400,
            detail=f"Este cartão é do CNPJ {lido}, não de {empresa['cnpj']}",
        )
    path = cartao_cnpj.storage_path(str(empresa_id))
    client.storage.from_(cartao_cnpj.BUCKET).upload(
        path, content, {"content-type": "application/pdf", "upsert": "true"}
    )
    data = (
        client.table("empresas")
        .update(
            {
                "cartao_cnpj_path": path,
                "cartao_cnpj_atualizado_em": datetime.now(UTC).isoformat(),
            }
        )
        .eq("id", str(empresa_id))
        .execute()
        .data
    )
    if not data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return data[0]


@router.delete("/{empresa_id}/cartao-cnpj", status_code=status.HTTP_204_NO_CONTENT)
def remover_cartao_cnpj(
    empresa_id: UUID,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    empresa = _empresa_ou_404(client, empresa_id)
    if empresa.get("cartao_cnpj_path"):
        client.storage.from_(cartao_cnpj.BUCKET).remove([empresa["cartao_cnpj_path"]])
    (
        client.table("empresas")
        .update({"cartao_cnpj_path": None, "cartao_cnpj_atualizado_em": None})
        .eq("id", str(empresa_id))
        .execute()
    )


def _matriz_do_grupo(client: Client, empresa: dict) -> dict:
    """A CND federal vale para o grupo: fica na mesma matriz que o painel mostra."""
    raiz = cnpj_raiz(empresa)
    if raiz.startswith("id:"):
        return empresa
    ativas = fetch_all(
        lambda: client.table("empresas").select("id,cnpj,razao_social").eq("ativa", True).order("id")
    )
    membros = [e for e in ativas if cnpj_raiz(e) == raiz] or [empresa]
    return ordenar_grupo(membros)[0]


def _certidao(client: Client, empresa_id: str, esfera: str) -> dict | None:
    data = (
        client.table("empresa_certidoes")
        .select("*")
        .eq("empresa_id", empresa_id)
        .eq("esfera", esfera)
        .limit(1)
        .execute()
        .data
    )
    return data[0] if data else None


@router.get("/{empresa_id}/certidoes/{esfera}")
def baixar_certidao(
    empresa_id: UUID,
    esfera: certidoes.EsferaSuportada,
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
    download: bool = False,
):
    matriz = _matriz_do_grupo(client, _empresa_ou_404(client, empresa_id))
    row = _certidao(client, str(matriz["id"]), esfera)
    if not row:
        raise HTTPException(status_code=404, detail="Empresa sem CND cadastrada")
    try:
        content = client.storage.from_(certidoes.BUCKET).download(row["path"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="Arquivo da CND não encontrado") from exc
    return _pdf_response(content, certidoes.nome_arquivo(esfera, matriz["cnpj"]), download)


@router.post("/{empresa_id}/certidoes/{esfera}", response_model=CertidaoOut)
def enviar_certidao(
    empresa_id: UUID,
    esfera: certidoes.EsferaSuportada,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
    file: UploadFile = File(...),
):
    empresa = _empresa_ou_404(client, empresa_id)
    content = _ler_upload(file)
    dados = certidoes.ler_cnd_federal(texto_do_pdf(content))
    lido = dados.pop("cnpj")
    if lido and so_digitos(lido)[:8] != so_digitos(empresa["cnpj"])[:8]:
        raise HTTPException(
            status_code=400,
            detail=f"Esta CND é do CNPJ {lido}, não do grupo de {empresa['cnpj']}",
        )
    matriz = _matriz_do_grupo(client, empresa)
    path = certidoes.storage_path(str(matriz["id"]), esfera)
    client.storage.from_(certidoes.BUCKET).upload(
        path, content, {"content-type": "application/pdf", "upsert": "true"}
    )
    row = {
        "empresa_id": str(matriz["id"]),
        "esfera": esfera,
        "path": path,
        "situacao": dados["situacao"],
        "emitida_em": dados["emitida_em"].isoformat() if dados["emitida_em"] else None,
        "valida_ate": dados["valida_ate"].isoformat() if dados["valida_ate"] else None,
        "codigo_controle": dados["codigo_controle"],
        "atualizado_em": datetime.now(UTC).isoformat(),
    }
    data = (
        client.table("empresa_certidoes")
        .upsert(row, on_conflict="empresa_id,esfera")
        .execute()
        .data
    )
    return data[0] if data else row


@router.delete("/{empresa_id}/certidoes/{esfera}", status_code=status.HTTP_204_NO_CONTENT)
def remover_certidao(
    empresa_id: UUID,
    esfera: certidoes.EsferaSuportada,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    matriz = _matriz_do_grupo(client, _empresa_ou_404(client, empresa_id))
    row = _certidao(client, str(matriz["id"]), esfera)
    if not row:
        return
    client.storage.from_(certidoes.BUCKET).remove([row["path"]])
    (
        client.table("empresa_certidoes")
        .delete()
        .eq("empresa_id", str(matriz["id"]))
        .eq("esfera", esfera)
        .execute()
    )


def _formata_cnpj(d: str) -> str:
    return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}" if len(d) == 14 else d


def _certificado(client: Client, empresa_id: UUID) -> dict | None:
    data = (
        client.table("empresa_certificados")
        .select("*")
        .eq("empresa_id", str(empresa_id))
        .limit(1)
        .execute()
        .data
    )
    return data[0] if data else None


@router.get("/{empresa_id}/certificado")
def baixar_certificado(
    empresa_id: UUID,
    _: Annotated[AuthUser, Depends(get_current_user)],
    client: Annotated[Client, Depends(get_db_client)],
):
    empresa = _empresa_ou_404(client, empresa_id)
    row = _certificado(client, empresa_id)
    if not row:
        raise HTTPException(status_code=404, detail="Empresa sem certificado digital")
    try:
        content = client.storage.from_(certificado_digital.BUCKET).download(row["path"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail="Arquivo do certificado não encontrado") from exc
    return Response(
        content=content,
        media_type=certificado_digital.CONTENT_TYPE,
        headers={
            "Content-Disposition": f'attachment; filename="{certificado_digital.nome_arquivo(empresa["cnpj"])}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.post("/{empresa_id}/certificado", response_model=CertificadoDigitalOut)
def enviar_certificado(
    empresa_id: UUID,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
    file: UploadFile = File(...),
    senha: str = Form(...),
):
    empresa = _empresa_ou_404(client, empresa_id)
    content = file.file.read(certificado_digital.MAX_BYTES + 1)
    if len(content) > certificado_digital.MAX_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo excede o limite de 1 MB")
    try:
        dados = certificado_digital.ler_pfx(content, senha)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    lido = dados["cnpj"]
    if not lido:
        raise HTTPException(status_code=400, detail="Não foi possível ler o CNPJ do certificado")
    if lido != so_digitos(empresa["cnpj"]):
        raise HTTPException(
            status_code=400,
            detail=f"Este certificado é do CNPJ {_formata_cnpj(lido)}, não de {empresa['cnpj']}",
        )
    path = certificado_digital.storage_path(str(empresa_id))
    client.storage.from_(certificado_digital.BUCKET).upload(
        path, content, {"content-type": certificado_digital.CONTENT_TYPE, "upsert": "true"}
    )
    row = {
        "empresa_id": str(empresa_id),
        "path": path,
        "titular": dados["titular"],
        "cnpj": lido,
        "emissor": dados["emissor"],
        "numero_serie": dados["numero_serie"],
        "valido_de": dados["valido_de"].isoformat(),
        "valido_ate": dados["valido_ate"].isoformat(),
        "atualizado_em": datetime.now(UTC).isoformat(),
    }
    data = client.table("empresa_certificados").upsert(row, on_conflict="empresa_id").execute().data
    return data[0] if data else row


@router.delete("/{empresa_id}/certificado", status_code=status.HTTP_204_NO_CONTENT)
def remover_certificado(
    empresa_id: UUID,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    row = _certificado(client, empresa_id)
    if not row:
        return
    client.storage.from_(certificado_digital.BUCKET).remove([row["path"]])
    client.table("empresa_certificados").delete().eq("empresa_id", str(empresa_id)).execute()


@router.delete("/{empresa_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_empresa(
    empresa_id: UUID,
    _: Annotated[AuthUser, Depends(require_admin)],
    client: Annotated[Client, Depends(get_db_client)],
):
    # obrigacoes.empresa_id é ON DELETE CASCADE: excluir levaria obrigações,
    # comentários e auditoria junto.
    vinculadas = (
        client.table("obrigacoes")
        .select("id")
        .eq("empresa_id", str(empresa_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if vinculadas:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Empresa possui obrigações; desative-a em vez de excluir",
        )
    certidoes_paths = [
        c["path"]
        for c in client.table("empresa_certidoes").select("path").eq("empresa_id", str(empresa_id)).execute().data
        or []
    ]
    certificado = _certificado(client, empresa_id)
    deleted = client.table("empresas").delete().eq("id", str(empresa_id)).execute().data or []
    if deleted and certidoes_paths:
        client.storage.from_(certidoes.BUCKET).remove(certidoes_paths)
    if deleted and certificado:
        client.storage.from_(certificado_digital.BUCKET).remove([certificado["path"]])
    caminhos = [e["cartao_cnpj_path"] for e in deleted if e.get("cartao_cnpj_path")]
    if caminhos:
        client.storage.from_(cartao_cnpj.BUCKET).remove(caminhos)

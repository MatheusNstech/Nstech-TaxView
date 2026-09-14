"""Smoke: responsável (user) salva prazo/horário e status da própria tarefa.

Fluxo:
  1) PATCH prazo + horas
  2) Re-ler no banco
  3) PATCH só status → prazo intacto
  4) ENTREGUE com prazo passado sem motivo → 400

Uso:
  cd backend
  ..\\.venv\\Scripts\\python.exe -m scripts.smoke_tarefa_owner_save
"""

from __future__ import annotations

import sys
from datetime import date, time, timedelta
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi import HTTPException  # noqa: E402

from app.api.routes.tarefas import update_tarefa  # noqa: E402
from app.core.auth import AuthUser, get_admin_client  # noqa: E402
from app.schemas.models import TarefaUpdate  # noqa: E402
from app.services.scope import assert_tarefa_in_scope  # noqa: E402

TITULO = "Linha do Tempo Contencioso"
TARGET_PRAZO = date(2026, 9, 30)
TARGET_INICIO = time(10, 0)
TARGET_FIM = time(12, 0)
MATHEUS_RESP_ID = "1ceb33b2-3fc1-42ff-a0ab-d2baf6642689"
MATHEUS_AUTH_ID = "40a57797-53c7-46c9-ab62-c74fb49423d5"


def _hhmm(value: object) -> str:
    text = str(value or "")
    return text[:5] if text else ""


def _fail(msg: str) -> None:
    print(f"SMOKE_FAIL: {msg}")
    raise SystemExit(1)


def main() -> None:
    client = get_admin_client()
    rows = (
        client.table("tarefas")
        .select(
            "id,titulo,prazo,hora_inicio,hora_fim,status,responsavel_id,competencia"
        )
        .eq("titulo", TITULO)
        .eq("responsavel_id", MATHEUS_RESP_ID)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        _fail(f"tarefa {TITULO!r} não encontrada para responsavel {MATHEUS_RESP_ID}")

    tarefa = rows[0]
    tarefa_id = UUID(str(tarefa["id"]))
    print(f"tarefa id={tarefa_id} prazo_atual={tarefa.get('prazo')} status={tarefa.get('status')}")

    resp_rows = (
        client.table("responsaveis")
        .select("id,auth_user_id")
        .eq("id", MATHEUS_RESP_ID)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not resp_rows:
        _fail("responsável Matheus não encontrado")
    auth_user_id = str(resp_rows[0].get("auth_user_id") or MATHEUS_AUTH_ID)

    user = AuthUser(
        id=auth_user_id,
        email="matheus.silva-oliveira@nstech.com.br",
        access_token="smoke",
        role="user",
    )

    # Escopo real (mesmo assert da rota)
    assert_tarefa_in_scope(user, client, str(tarefa_id))

    # 1) prazo + horas
    body = TarefaUpdate(
        prazo=TARGET_PRAZO,
        hora_inicio=TARGET_INICIO,
        hora_fim=TARGET_FIM,
        status="PENDENTE",  # type: ignore[arg-type]
        titulo=TITULO,
    )
    out = update_tarefa(tarefa_id, body, user, client)
    if str(out.get("prazo") or "")[:10] != TARGET_PRAZO.isoformat():
        _fail(f"resposta prazo={out.get('prazo')!r} esperado {TARGET_PRAZO}")
    if _hhmm(out.get("hora_inicio")) != "10:00" or _hhmm(out.get("hora_fim")) != "12:00":
        _fail(f"resposta horas={out.get('hora_inicio')!r}-{out.get('hora_fim')!r}")

    again = (
        client.table("tarefas")
        .select("prazo,hora_inicio,hora_fim,status")
        .eq("id", str(tarefa_id))
        .single()
        .execute()
        .data
    )
    if str(again.get("prazo") or "")[:10] != TARGET_PRAZO.isoformat():
        _fail(f"DB prazo={again.get('prazo')!r} após patch")
    if _hhmm(again.get("hora_inicio")) != "10:00" or _hhmm(again.get("hora_fim")) != "12:00":
        _fail(f"DB horas={again.get('hora_inicio')!r}-{again.get('hora_fim')!r}")
    print("ok: prazo+horas gravados")

    # 2) só status
    body2 = TarefaUpdate(status="EM_REVISAO")  # type: ignore[arg-type]
    out2 = update_tarefa(tarefa_id, body2, user, client)
    if out2.get("status") != "EM_REVISAO":
        _fail(f"status resposta={out2.get('status')!r}")
    if str(out2.get("prazo") or "")[:10] != TARGET_PRAZO.isoformat():
        _fail("prazo perdido no patch só-status")
    if _hhmm(out2.get("hora_inicio")) != "10:00" or _hhmm(out2.get("hora_fim")) != "12:00":
        _fail("horas perdidas no patch só-status")
    print("ok: status-only preserva prazo/horas")

    # 3) entrega atrasada sem motivo (novo prazo no passado)
    past = date.today() - timedelta(days=2)
    body3 = TarefaUpdate(
        status="ENTREGUE",  # type: ignore[arg-type]
        prazo=past,
    )
    try:
        update_tarefa(tarefa_id, body3, user, client)
        _fail("esperava 400 em entrega atrasada sem motivo")
    except HTTPException as exc:
        if exc.status_code != 400:
            _fail(f"status={exc.status_code} detail={exc.detail!r}")
        if "motivo" not in str(exc.detail).lower():
            _fail(f"detail inesperado: {exc.detail!r}")
    print("ok: late entrega exige motivo")

    # Restaura PENDENTE + prazo alvo (estado estável pós-smoke)
    restore = TarefaUpdate(
        status="PENDENTE",  # type: ignore[arg-type]
        prazo=TARGET_PRAZO,
        hora_inicio=TARGET_INICIO,
        hora_fim=TARGET_FIM,
    )
    update_tarefa(tarefa_id, restore, user, client)
    print("SMOKE_OK (direct update_tarefa)")

    # 4) Contrato HTTP (mesmo JSON que o TarefaDrawer consome)
    from fastapi.testclient import TestClient

    from app.core.auth import get_current_user, get_db_client, require_not_viewer
    from app.main import app

    async def _override_user():
        return user

    def _override_db():
        return client

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[require_not_viewer] = _override_user
    app.dependency_overrides[get_db_client] = _override_db
    try:
        tc = TestClient(app)
        alt_prazo = "2026-09-29"
        r = tc.patch(
            f"/api/tarefas/{tarefa_id}",
            json={
                "titulo": TITULO,
                "status": "PENDENTE",
                "prazo": alt_prazo,
                "hora_inicio": "11:00",
                "hora_fim": "13:00",
                "descricao": None,
            },
        )
        if r.status_code != 200:
            _fail(f"HTTP PATCH status={r.status_code} body={r.text[:300]}")
        data = r.json()
        if str(data.get("prazo") or "")[:10] != alt_prazo:
            _fail(f"HTTP prazo={data.get('prazo')!r}")
        if _hhmm(data.get("hora_inicio")) != "11:00" or _hhmm(data.get("hora_fim")) != "13:00":
            _fail(f"HTTP horas={data.get('hora_inicio')!r}-{data.get('hora_fim')!r}")

        g = tc.get("/api/tarefas", params={"competencia": "2026-08-01"})
        if g.status_code != 200:
            _fail(f"HTTP GET list status={g.status_code}")
        row = next((x for x in g.json() if x.get("id") == str(tarefa_id)), None)
        if not row:
            _fail("HTTP GET list não retornou a tarefa (filtro competencia?)")
        if str(row.get("prazo") or "")[:10] != alt_prazo:
            _fail(f"HTTP list prazo={row.get('prazo')!r} (silent-load regressão)")

        # volta ao alvo do aceite (30/09 10-12)
        r2 = tc.patch(
            f"/api/tarefas/{tarefa_id}",
            json={
                "titulo": TITULO,
                "status": "PENDENTE",
                "prazo": TARGET_PRAZO.isoformat(),
                "hora_inicio": "10:00",
                "hora_fim": "12:00",
            },
        )
        if r2.status_code != 200:
            _fail(f"HTTP restore status={r2.status_code}")
        print("ok: HTTP PATCH+GET contrato drawer")
    finally:
        app.dependency_overrides.clear()

    print("SMOKE_OK")


if __name__ == "__main__":
    main()

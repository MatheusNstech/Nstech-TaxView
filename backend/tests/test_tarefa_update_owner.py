"""PATCH /tarefas: responsável pode alterar prazo/horário da própria tarefa."""
from __future__ import annotations

from datetime import date, time, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes.tarefas import update_tarefa
from app.core.auth import AuthUser, require_not_viewer
from app.schemas.models import TarefaUpdate


OWNER_RESP = str(uuid4())
TAREFA_ID = uuid4()
OTHER_RESP = str(uuid4())


def _user(*, role: str = "user", is_viewer: bool = False) -> AuthUser:
    return AuthUser(
        id=str(uuid4()),
        email="owner@example.com",
        access_token="tok",
        role=role,  # type: ignore[arg-type]
        is_viewer=is_viewer,
    )


def _current_row(**overrides):
    base = {
        "id": str(TAREFA_ID),
        "responsavel_id": OWNER_RESP,
        "created_by": str(uuid4()),
        "status": "PENDENTE",
        "prazo": "2026-09-18",
        "hora_inicio": "09:00",
        "hora_fim": "10:00",
        "motivo_atraso": None,
        "entregue_em": None,
        "titulo": "Linha do Tempo Contencioso",
    }
    base.update(overrides)
    return base


class _Chain:
    """Encadeamento mínimo estilo PostgREST (table().update().eq().execute())."""

    def __init__(self, store: dict, table_name: str):
        self.store = store
        self.table_name = table_name
        self._op = None
        self._payload = None
        self._eq = {}
        self._select = "*"
        self._single = False

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def eq(self, key, value):
        self._eq[key] = value
        return self

    def limit(self, *_a, **_k):
        return self

    def single(self):
        self._single = True
        return self

    def execute(self):
        rows = self.store.setdefault(self.table_name, {})
        if self._op == "update":
            key = str(self._eq.get("id"))
            if key not in rows:
                return SimpleNamespace(data=[])
            rows[key].update(self._payload)
            return SimpleNamespace(data=[dict(rows[key])])
        # select
        key = str(self._eq.get("id"))
        row = rows.get(key)
        if self._single:
            return SimpleNamespace(data=dict(row) if row else None)
        return SimpleNamespace(data=[dict(row)] if row else [])


class FakeClient:
    def __init__(self, tarefa: dict):
        self.store = {"tarefas": {str(tarefa["id"]): dict(tarefa)}}

    def table(self, name: str):
        return _Chain(self.store, name)


@pytest.mark.asyncio
async def test_viewer_and_diretor_blocked():
    for user in (
        _user(role="diretor"),
        _user(role="user", is_viewer=True),
    ):
        with pytest.raises(HTTPException) as exc:
            await require_not_viewer(user)
        assert exc.value.status_code == 403


def test_owner_can_patch_prazo_and_horas():
    user = _user()
    current = _current_row()
    client = FakeClient(current)
    body = TarefaUpdate(
        prazo=date(2026, 9, 30),
        hora_inicio=time(10, 0),
        hora_fim=time(12, 0),
    )

    with patch(
        "app.api.routes.tarefas.assert_tarefa_in_scope",
        return_value=current,
    ), patch(
        "app.api.routes.tarefas.effective_responsavel_id",
        return_value=None,
    ):
        # org_wide False path unused when responsavel_id not in patch
        out = update_tarefa(TAREFA_ID, body, user, client)  # type: ignore[arg-type]

    assert out["prazo"] == "2026-09-30"
    assert out["hora_inicio"] == "10:00"
    assert out["hora_fim"] == "12:00"
    saved = client.store["tarefas"][str(TAREFA_ID)]
    assert saved["prazo"] == "2026-09-30"
    assert saved["hora_inicio"] == "10:00"
    assert saved["hora_fim"] == "12:00"


def test_owner_status_only_keeps_prazo():
    user = _user()
    current = _current_row(prazo="2026-09-30", hora_inicio="10:00", hora_fim="12:00")
    client = FakeClient(current)
    body = TarefaUpdate(status="EM_REVISAO")  # type: ignore[arg-type]

    with patch(
        "app.api.routes.tarefas.assert_tarefa_in_scope",
        return_value=current,
    ):
        out = update_tarefa(TAREFA_ID, body, user, client)  # type: ignore[arg-type]

    assert out["status"] == "EM_REVISAO"
    assert out["prazo"] == "2026-09-30"
    assert out["hora_inicio"] == "10:00"
    assert out["hora_fim"] == "12:00"


def test_out_of_scope_returns_403():
    user = _user()
    current = _current_row(responsavel_id=OTHER_RESP)
    client = FakeClient(current)

    with patch(
        "app.services.scope.effective_responsavel_id",
        return_value=__import__("uuid").UUID(OWNER_RESP),
    ):
        from app.services.scope import assert_tarefa_in_scope

        with pytest.raises(HTTPException) as exc:
            assert_tarefa_in_scope(user, client, str(TAREFA_ID))  # type: ignore[arg-type]
        assert exc.value.status_code == 403


def test_late_entrega_uses_new_prazo_from_body():
    """Prazo antigo atrasado + novo prazo futuro → sem exigir motivo."""
    user = _user()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    future = date.today() + timedelta(days=10)
    current = _current_row(prazo=yesterday, status="PENDENTE")
    client = FakeClient(current)
    body = TarefaUpdate(
        status="ENTREGUE",  # type: ignore[arg-type]
        prazo=future,
    )

    with patch(
        "app.api.routes.tarefas.assert_tarefa_in_scope",
        return_value=current,
    ):
        out = update_tarefa(TAREFA_ID, body, user, client)  # type: ignore[arg-type]

    assert out["status"] == "ENTREGUE"
    assert out["prazo"] == future.isoformat()
    assert not out.get("motivo_atraso")


def test_late_entrega_requires_motivo_with_new_past_prazo():
    user = _user()
    old_future = (date.today() + timedelta(days=5)).isoformat()
    new_past = date.today() - timedelta(days=2)
    current = _current_row(prazo=old_future, status="PENDENTE")
    client = FakeClient(current)
    body = TarefaUpdate(
        status="ENTREGUE",  # type: ignore[arg-type]
        prazo=new_past,
    )

    with patch(
        "app.api.routes.tarefas.assert_tarefa_in_scope",
        return_value=current,
    ):
        with pytest.raises(HTTPException) as exc:
            update_tarefa(TAREFA_ID, body, user, client)  # type: ignore[arg-type]
        assert exc.value.status_code == 400
        assert "motivo do atraso" in str(exc.value.detail).lower()


def test_update_empty_result_fails():
    user = _user()
    current = _current_row()
    client = FakeClient(current)
    # Quebra o update para retornar data vazia
    body = TarefaUpdate(prazo=date(2026, 9, 30))

    broken = MagicMock()
    broken.table.return_value.update.return_value.eq.return_value.execute.return_value = (
        SimpleNamespace(data=[])
    )

    with patch(
        "app.api.routes.tarefas.assert_tarefa_in_scope",
        return_value=current,
    ):
        with pytest.raises(HTTPException) as exc:
            update_tarefa(TAREFA_ID, body, user, broken)  # type: ignore[arg-type]
        assert exc.value.status_code == 400
        assert "Não foi possível salvar" in str(exc.value.detail)

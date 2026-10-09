"""Copiar tarefa/obrigação para outras empresas."""
from __future__ import annotations

from collections import defaultdict
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.routes import obrigacoes, tarefas
from app.core.auth import AuthUser, get_current_user, get_db_client
from app.main import app
from app.services.copia import trocar_nome_empresa

ORIGEM, NOVA, DUPLICADA, INEXISTENTE, ATIVIDADE = (str(uuid4()) for _ in range(5))
ADMIN = AuthUser(id="a", email="a@x.com", access_token="t", role="admin")


class _Query:
    def __init__(self, client: "_Client", table: str):
        self.client, self.table, self.payload = client, table, None

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def in_(self, *_a, **_k):
        return self

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        if self.payload is None:
            return SimpleNamespace(data=self.client.rows.get(self.table, []))
        linhas = self.payload if isinstance(self.payload, list) else [self.payload]
        self.client.inserted[self.table].extend(linhas)
        return SimpleNamespace(data=[{"id": str(uuid4()), **l} for l in linhas])


class _Client:
    def __init__(self, rows: dict[str, list[dict]]):
        self.rows = rows
        self.inserted: dict[str, list[dict]] = defaultdict(list)

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _empresas():
    return [
        {"id": NOVA, "razao_social": "KMM Logística", "nome_fantasia": "KMM", "ativa": True},
        {"id": DUPLICADA, "razao_social": "ACME", "ativa": True},
    ]


def _post(user: AuthUser, client: object, url: str, body: dict):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db_client] = lambda: client
    try:
        return TestClient(app).post(url, json=body)
    finally:
        app.dependency_overrides.clear()


def test_troca_nome_da_empresa_no_titulo():
    origem = {"razao_social": "BRK Tecnologia Ltda", "nome_fantasia": "BRK"}
    destino = {"razao_social": "KMM Logística", "nome_fantasia": "KMM"}
    assert trocar_nome_empresa("Fechamento brk tecnologia ltda", origem, destino) == "Fechamento KMM Logística"
    assert trocar_nome_empresa("Conciliação BRK - out", origem, destino) == "Conciliação KMM - out"
    assert trocar_nome_empresa("Reunião geral", origem, destino) == "Reunião geral"
    assert trocar_nome_empresa("Reunião BRK", None, destino) == "Reunião BRK"


def test_viewer_nao_copia_tarefa():
    viewer = AuthUser(id="v", email="v@x.com", access_token="t", role="user", is_viewer=True)
    resp = _post(viewer, object(), f"/api/tarefas/{uuid4()}/copiar", {"empresa_ids": [NOVA]})
    assert resp.status_code == 403


@pytest.mark.parametrize("role", ["user", "diretor"])
def test_so_admin_copia_obrigacao(role: str):
    user = AuthUser(id="u", email="u@x.com", access_token="t", role=role)
    resp = _post(user, object(), f"/api/obrigacoes/{uuid4()}/copiar", {"empresa_ids": [NOVA]})
    assert resp.status_code == 403


def test_copia_obrigacao_ignora_origem_duplicada_e_inexistente(monkeypatch):
    resp_id = str(uuid4())
    origem = {
        "id": str(uuid4()),
        "empresa_id": ORIGEM,
        "atividade_id": str(uuid4()),
        "competencia": "2026-09-01",
        "prazo_legal": "2026-10-20",
        "prazo_fiscal": "2026-10-15",
        "categoria": "fechamento",
        "responsavel_id": resp_id,
        "responsaveis": [{"id": resp_id}],
        "status": "ENTREGUE",
    }
    vinculos: list[tuple] = []
    monkeypatch.setattr(obrigacoes, "_fetch_full", lambda _c, _id: origem)
    monkeypatch.setattr(obrigacoes, "set_responsaveis", lambda *a: vinculos.append(a))
    monkeypatch.setattr(obrigacoes, "write_audit", lambda *a, **k: None)
    monkeypatch.setattr(obrigacoes, "notify_responsavel_of_obrigacao", lambda *a, **k: None)
    client = _Client({"empresas": _empresas(), "obrigacoes": [{"empresa_id": DUPLICADA}]})

    resp = _post(
        ADMIN,
        client,
        f"/api/obrigacoes/{origem['id']}/copiar",
        {"empresa_ids": [ORIGEM, NOVA, DUPLICADA, INEXISTENTE]},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["criadas"] == 1
    assert {i["empresa_id"] for i in body["ignoradas"]} == {ORIGEM, DUPLICADA, INEXISTENTE}
    [nova] = client.inserted["obrigacoes"]
    assert nova["empresa_id"] == NOVA
    assert nova["status"] == "PENDENTE"
    assert (nova["prazo_fiscal"], nova["responsavel_id"]) == ("2026-10-15", resp_id)
    assert len(vinculos) == 1


def test_copia_tarefa_troca_titulo_e_volta_para_pendente(monkeypatch):
    resp_id = str(uuid4())
    origem = {
        "id": str(uuid4()),
        "titulo": "Fechamento ACME - outubro",
        "solicitante_nome": "Danilo",
        "descricao": "Conferir notas",
        "categoria": "fechamento",
        "status": "ENTREGUE",
        "competencia": "2026-09-01",
        "prazo": "2026-10-10",
        "hora_inicio": "09:00:00",
        "hora_fim": "10:00:00",
        "empresa_id": ORIGEM,
        "empresa": {"id": ORIGEM, "razao_social": "ACME"},
        "atividade_id": ATIVIDADE,
        "responsavel_id": resp_id,
        "entregue_em": "2026-10-09T12:00:00+00:00",
        "motivo_atraso": "x" * 30,
    }
    monkeypatch.setattr(tarefas, "assert_tarefa_in_scope", lambda *a: origem)
    monkeypatch.setattr(tarefas, "_fetch_full", lambda _c, _id: origem)
    monkeypatch.setattr(tarefas, "_notify_assignee", lambda *a, **k: None)
    client = _Client(
        {
            "empresas": _empresas(),
            "tarefas": [{"empresa_id": DUPLICADA, "titulo": "Fechamento ACME - outubro"}],
        }
    )

    resp = _post(
        ADMIN, client, f"/api/tarefas/{origem['id']}/copiar", {"empresa_ids": [NOVA, DUPLICADA]}
    )

    assert resp.status_code == 200
    assert resp.json()["criadas"] == 1
    [nova] = client.inserted["tarefas"]
    assert nova["titulo"] == "Fechamento KMM Logística - outubro"
    assert nova["status"] == "PENDENTE"
    assert nova["empresa_id"] == NOVA
    assert nova["atividade_id"] == ATIVIDADE
    assert "entregue_em" not in nova and "motivo_atraso" not in nova


def test_titulo_manual_so_com_uma_empresa(monkeypatch):
    monkeypatch.setattr(tarefas, "assert_tarefa_in_scope", lambda *a: {})
    monkeypatch.setattr(
        tarefas,
        "_fetch_full",
        lambda _c, _id: {"titulo": "X", "empresa_id": None, "responsavel_id": "r"},
    )
    client = _Client({"empresas": _empresas()})
    resp = _post(
        ADMIN,
        client,
        f"/api/tarefas/{uuid4()}/copiar",
        {"empresa_ids": [NOVA, DUPLICADA], "titulo": "Outro"},
    )
    assert resp.status_code == 400

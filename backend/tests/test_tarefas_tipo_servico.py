"""Tipo de serviço (atividade) na criação de tarefas."""
from __future__ import annotations

from collections import defaultdict
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import tarefas
from app.core.auth import AuthUser, get_current_user, get_db_client
from app.main import app

ADMIN = AuthUser(id=str(uuid4()), email="a@x.com", access_token="t", role="admin")
ATIVIDADE, RESPONSAVEL = str(uuid4()), str(uuid4())


class _Query:
    def __init__(self, client: "_Client", table: str):
        self.client, self.table, self.payload = client, table, None

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        if self.payload is None:
            return SimpleNamespace(data=self.client.rows.get(self.table, []))
        self.client.inserted[self.table].append(self.payload)
        return SimpleNamespace(data=[{"id": str(uuid4()), **self.payload}])


class _Client:
    def __init__(self, rows: dict[str, list[dict]]):
        self.rows = rows
        self.inserted: dict[str, list[dict]] = defaultdict(list)

    def table(self, name: str) -> _Query:
        return _Query(self, name)


def _criar(client: _Client, monkeypatch, **extra):
    monkeypatch.setattr(
        tarefas, "_fetch_full", lambda _c, _id: {"id": _id, **client.inserted["tarefas"][-1]}
    )
    monkeypatch.setattr(tarefas, "_notify_assignee", lambda *a, **k: None)
    body = {
        "titulo": "Conferir apuração",
        "solicitante_nome": "Danilo",
        "prazo": "2099-10-20",
        "hora_inicio": "09:00",
        "hora_fim": "10:00",
        "responsavel_id": RESPONSAVEL,
        **extra,
    }
    app.dependency_overrides[get_current_user] = lambda: ADMIN
    app.dependency_overrides[get_db_client] = lambda: client
    try:
        return TestClient(app).post("/api/tarefas", json=body)
    finally:
        app.dependency_overrides.clear()


def test_cria_tarefa_com_tipo_de_servico(monkeypatch):
    client = _Client({"atividades_modelo": [{"id": ATIVIDADE}]})
    resp = _criar(client, monkeypatch, atividade_id=ATIVIDADE)
    assert resp.status_code == 201
    [nova] = client.inserted["tarefas"]
    assert nova["atividade_id"] == ATIVIDADE


def test_tipo_de_servico_e_opcional(monkeypatch):
    client = _Client({})
    resp = _criar(client, monkeypatch)
    assert resp.status_code == 201
    [nova] = client.inserted["tarefas"]
    assert nova["atividade_id"] is None


def test_tipo_de_servico_inexistente_da_404(monkeypatch):
    client = _Client({"atividades_modelo": []})
    resp = _criar(client, monkeypatch, atividade_id=str(uuid4()))
    assert resp.status_code == 404
    assert client.inserted["tarefas"] == []

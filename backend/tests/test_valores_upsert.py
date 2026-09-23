"""Testes de /api/valores (upsert-on-diff) e restrição de /api/auth/token."""
from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes.auth_token import TokenRequest, login_token
from app.api.routes.valores import (
    ValorIngest,
    _canonical_payload,
    _payloads_equal,
    ingest_valor,
    list_valores,
)
from app.core.auth import AuthUser
from app.core.config import Settings


def _user(*, role: str = "diretor") -> AuthUser:
    return AuthUser(
        id=str(uuid4()),
        email="desktop@nstech.com.br",
        access_token="tok",
        role=role,  # type: ignore[arg-type]
    )


class _FakeTable:
    def __init__(self, store: list[dict]):
        self.store = store
        self._op = "select"
        self._payload: dict | None = None
        self._filters: dict = {}
        self._limit = 100
        self._order: list[tuple[str, bool]] = []

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = dict(payload)
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = dict(payload)
        return self

    def eq(self, key, value):
        self._filters[key] = value
        return self

    def order(self, key, desc: bool = False):
        self._order.append((key, desc))
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        if self._op == "insert":
            assert self._payload is not None
            row = {
                "id": str(uuid4()),
                "created_at": "2026-07-01T12:00:00+00:00",
                **self._payload,
            }
            self.store.append(row)
            return SimpleNamespace(data=[row])

        matched = [
            row
            for row in self.store
            if all(str(row.get(k)) == str(v) for k, v in self._filters.items())
        ]

        if self._op == "update":
            assert self._payload is not None
            if not matched:
                return SimpleNamespace(data=[])
            for row in matched:
                row.update(self._payload)
            return SimpleNamespace(data=list(matched))

        # select
        rows = list(matched) if self._filters else list(self.store)
        for key, desc in reversed(self._order):
            rows.sort(key=lambda r: r.get(key) or "", reverse=desc)
        return SimpleNamespace(data=rows[: self._limit])


class _FakeClient:
    def __init__(self, store: list[dict] | None = None):
        self.store = store if store is not None else []

    def table(self, _name: str):
        return _FakeTable(self.store)


def test_canonical_rounds_floats():
    left = {"a": 1.239, "b": 2}
    right = {"b": 2, "a": 1.241}
    assert _payloads_equal(left, right)
    assert _canonical_payload(left)["a"] == 1.24


def test_ingest_creates_iss():
    client = _FakeClient()
    body = ValorIngest(
        competencia=date(2026, 7, 15),
        tipo="iss",
        empresa_cnpj="21.244.758/0001-45",
        empresa_alias="CT6",
        empresa_razao="CT6 TECNOLOGIA LTDA",
        valores={"iss_a_recolher": 18992.39, "erp_valor": 949622.04},
    )
    response = MagicMock()
    out = ingest_valor(body, response, _user(), client)
    assert out.action == "created"
    assert out.changed is True
    assert out.empresa_cnpj == "21244758000145"
    assert out.competencia == date(2026, 7, 1)
    assert out.tipo == "iss"
    assert response.status_code == 201
    assert len(client.store) == 1


def test_ingest_unchanged_when_same_payload():
    client = _FakeClient()
    body = ValorIngest(
        competencia=date(2026, 7, 1),
        tipo="iss",
        empresa_cnpj="21244758000145",
        empresa_alias="CT6",
        valores={"iss_a_recolher": 100.0},
    )
    response = MagicMock()
    first = ingest_valor(body, response, _user(), client)
    second = ingest_valor(body, response, _user(), client)
    assert first.action == "created"
    assert second.action == "unchanged"
    assert second.changed is False
    assert len(client.store) == 1
    assert response.status_code == 200


def test_ingest_updates_when_payload_differs():
    client = _FakeClient()
    response = MagicMock()
    base = ValorIngest(
        competencia=date(2026, 7, 1),
        tipo="iss",
        empresa_cnpj="21244758000145",
        empresa_alias="CT6",
        valores={"iss_a_recolher": 100.0},
    )
    ingest_valor(base, response, _user(), client)
    changed = base.model_copy(update={"valores": {"iss_a_recolher": 150.0}})
    out = ingest_valor(changed, response, _user(), client)
    assert out.action == "updated"
    assert out.changed is True
    assert out.payload["iss_a_recolher"] == 150.0
    assert len(client.store) == 1


def test_pis_cofins_independent_of_iss():
    client = _FakeClient()
    response = MagicMock()
    iss = ValorIngest(
        competencia=date(2026, 7, 1),
        tipo="iss",
        empresa_cnpj="21244758000145",
        empresa_alias="CT6",
        valores={"iss_a_recolher": 10},
    )
    pis = ValorIngest(
        competencia=date(2026, 7, 1),
        tipo="pis_cofins",
        empresa_cnpj="21244758000145",
        empresa_alias="CT6",
        valores={"pis_debito": 1.0, "cofins_debito": 3.0},
    )
    ingest_valor(iss, response, _user(), client)
    out = ingest_valor(pis, response, _user(), client)
    assert out.tipo == "pis_cofins"
    assert len(client.store) == 2


def test_list_filters_by_tipo_and_cnpj():
    client = _FakeClient()
    response = MagicMock()
    ingest_valor(
        ValorIngest(
            competencia=date(2026, 7, 1),
            tipo="iss",
            empresa_cnpj="21244758000145",
            empresa_alias="CT6",
            valores={"x": 1},
        ),
        response,
        _user(),
        client,
    )
    ingest_valor(
        ValorIngest(
            competencia=date(2026, 7, 1),
            tipo="pis_cofins",
            empresa_cnpj="21244758000145",
            empresa_alias="CT6",
            valores={"y": 2},
        ),
        response,
        _user(),
        client,
    )
    rows = list_valores(
        _user(),
        client,
        limit=50,
        competencia=date(2026, 7, 1),
        tipo="iss",
        empresa_cnpj="21.244.758/0001-45",
    )
    assert len(rows) == 1
    assert rows[0].tipo == "iss"


def test_user_role_forbidden():
    client = _FakeClient()
    body = ValorIngest(
        competencia=date(2026, 7, 1),
        tipo="iss",
        empresa_cnpj="21244758000145",
        valores={},
    )
    with pytest.raises(HTTPException) as exc:
        ingest_valor(body, MagicMock(), _user(role="user"), client)
    assert exc.value.status_code == 403


def test_auth_token_rejects_user_role():
    """Garante que /api/auth/token bloqueia contas sem admin/diretor."""
    fake_session = SimpleNamespace(
        access_token="abc",
        refresh_token="r",
        expires_in=3600,
    )
    fake_user = SimpleNamespace(
        id=str(uuid4()),
        email="user@nstech.com.br",
        app_metadata={"role": "user"},
    )
    fake_result = SimpleNamespace(session=fake_session, user=fake_user)
    fake_auth = MagicMock()
    fake_auth.sign_in_with_password.return_value = fake_result
    fake_client = MagicMock()
    fake_client.auth = fake_auth

    with patch("app.api.routes.auth_token.get_anon_client", return_value=fake_client):
        settings = Settings(
            supabase_url="https://example.supabase.co",
            supabase_anon_key="anon",
        )
        with pytest.raises(HTTPException) as exc:
            login_token(
                TokenRequest(email="user@nstech.com.br", password="SenhaForte@1"),
                settings,
            )
        assert exc.value.status_code == 403
        fake_auth.sign_out.assert_called()

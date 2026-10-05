"""Testes do acompanhamento PER/DCOMP: permissões, prazos e resumo."""
from __future__ import annotations

import asyncio
from datetime import date, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes.perdcomp import (
    PerdcompCreate,
    build_summary,
    create_processo,
    list_processos,
    prazo_situacao,
)
from app.core.auth import AuthUser, require_perdcomp_editor, require_perdcomp_reader

TODAY = date(2026, 9, 24)

# Espelha a planilha "Acompanhamento PERDCOMP" (9 processos).
PLANILHA = [
    ("OPEN TECH", 97578.51, "", None),
    ("TRIZY", 97960.10, "Intimação/Pendência", "2026-10-17"),
    ("KMM", 58001.64, "Intimação/Pendência", "2026-10-17"),
    ("OPEN TECH", 95529.77, "Indeferido", "2026-09-02"),
    ("OPEN TECH", 102312.06, "Indeferido", "2026-09-02"),
    ("OPEN TECH", 97208.20, "Indeferido", "2026-09-02"),
    ("OPEN TECH", 98785.43, "Indeferido", "2026-09-02"),
    ("KMM", 181951.03, "Indeferido", "2026-09-09"),
    ("NSTECH GR", 220994.75, "Indeferido", "2026-09-09"),
]


def _rows() -> list[dict]:
    return [
        {
            "id": str(uuid4()),
            "perdcomp": f"PD-{i}",
            "empresa": empresa,
            "valor_pedido": valor,
            "status": status,
            "data_limite": limite,
        }
        for i, (empresa, valor, status, limite) in enumerate(PLANILHA)
    ]


def _user(*, role: str = "user", editor: bool = False) -> AuthUser:
    return AuthUser(
        id=str(uuid4()),
        email="x@nstech.com.br",
        access_token="tok",
        role=role,  # type: ignore[arg-type]
        painel_fiscal_editor=editor,
    )


class _FakeTable:
    def __init__(self, store: list[dict]):
        self.store = store
        self._op = "select"
        self._payload: dict | None = None
        self._filters: dict = {}

    def select(self, *_a, **_k):
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = dict(payload)
        return self

    def eq(self, key, value):
        self._filters[key] = value
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, _n):
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def execute(self):
        if self._op == "insert":
            row = {"id": str(uuid4()), **(self._payload or {})}
            self.store.append(row)
            return SimpleNamespace(data=[row])
        rows = [
            r
            for r in self.store
            if all(str(r.get(k)) == str(v) for k, v in self._filters.items())
        ]
        start, end = getattr(self, "_range", (0, len(rows)))
        return SimpleNamespace(data=rows[start : end + 1])


class _FakeClient:
    def __init__(self, store: list[dict]):
        self.store = store

    def table(self, _name: str):
        return _FakeTable(self.store)


def test_summary_bate_com_a_planilha():
    s = build_summary(_rows(), TODAY)
    assert s.total_processos == 9
    assert s.valor_total == pytest.approx(1050321.49)
    assert s.valor_indeferido == pytest.approx(796781.24)

    por_status = {a.status: (a.quantidade, a.valor) for a in s.por_status}
    assert por_status["Indeferido"] == (6, pytest.approx(796781.24))
    assert por_status["Intimação/Pendência"] == (2, pytest.approx(155961.74))
    assert por_status["Sem status"] == (1, pytest.approx(97578.51))

    por_empresa = {e.empresa: e.quantidade for e in s.por_empresa}
    assert por_empresa == {"OPEN TECH": 5, "KMM": 2, "TRIZY": 1, "NSTECH GR": 1}

    assert s.prazos.vencidos == 6
    assert s.prazos.vence_7d == 0
    assert s.prazos.vence_30d == 2
    assert s.prazos.sem_prazo == 1


def test_prazo_situacao():
    assert prazo_situacao(None, TODAY) == "sem_prazo"
    assert prazo_situacao(TODAY - timedelta(days=1), TODAY) == "vencido"
    assert prazo_situacao(TODAY, TODAY) == "vence_7d"
    assert prazo_situacao(TODAY + timedelta(days=7), TODAY) == "vence_7d"
    assert prazo_situacao(TODAY + timedelta(days=8), TODAY) == "no_prazo"


def test_list_filtra_status_e_empresa():
    client = _FakeClient(_rows())
    indeferidos = list_processos(_user(role="diretor"), client, status_filtro="indeferido")
    assert len(indeferidos) == 6
    kmm = list_processos(_user(role="diretor"), client, empresa="kmm")
    assert {p.empresa for p in kmm} == {"KMM"}
    sem_status = list_processos(_user(role="diretor"), client, status_filtro="Sem status")
    assert len(sem_status) == 1


def test_create_rejeita_perdcomp_duplicado():
    client = _FakeClient(_rows())
    with pytest.raises(HTTPException) as exc:
        create_processo(
            PerdcompCreate(perdcomp="PD-0", empresa="OPEN TECH"),
            _user(editor=True),
            client,
        )
    assert exc.value.status_code == 409


def test_diretor_le_mas_nao_edita():
    diretor = _user(role="diretor")
    assert asyncio.run(require_perdcomp_reader(diretor)) is diretor
    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_perdcomp_editor(diretor))
    assert exc.value.status_code == 403


def test_danilo_e_admin_editam():
    danilo = _user(editor=True)
    glaucia = _user(role="admin")
    assert asyncio.run(require_perdcomp_editor(danilo)) is danilo
    assert asyncio.run(require_perdcomp_editor(glaucia)) is glaucia


def test_usuario_comum_bloqueado():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_perdcomp_reader(_user()))
    assert exc.value.status_code == 403

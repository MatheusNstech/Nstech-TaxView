"""Tela Empresas: agrupamento por raiz do CNPJ e escrita restrita ao admin."""
from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import AuthUser, get_current_user, get_db_client
from app.main import app
from app.services.empresas_painel import montar_grupos

HOJE = date(2026, 10, 8)
MATRIZ, FILIAL, OUTRA = str(uuid4()), str(uuid4()), str(uuid4())
SOLANGE, FLAVIA = str(uuid4()), str(uuid4())


def _empresas() -> list[dict]:
    return [
        {"id": FILIAL, "cnpj": "35.929.201/0002-33", "razao_social": "NSTECH GR LTDA", "bu": "Embarcador"},
        {
            "id": MATRIZ,
            "cnpj": "35.929.201/0001-52",
            "razao_social": "NSTECH GR LTDA",
            "bu": "Corporativo",
            "nome_fantasia": "Nstech GR",
            "porte": "Grande",
            "logo_url": "/logos/nstech.png",
            "logo_url_escuro": "/logos/nstech-escuro.png",
        },
        {"id": OUTRA, "cnpj": "LRI190208D94", "razao_social": "Log Risk", "bu": "V&RM"},
    ]


def _contato(empresa_id: str, area: str, ordem: int, nome=None, email=None) -> dict:
    return {
        "id": str(uuid4()),
        "empresa_id": empresa_id,
        "area": area,
        "nome": nome,
        "email": email,
        "ordem": ordem,
    }


def _obrigacao(empresa_id: str, status: str, prazo: str, resp: dict) -> dict:
    return {
        "id": str(uuid4()),
        "empresa_id": empresa_id,
        "status": status,
        "prazo_legal": prazo,
        "responsavel_id": resp["id"],
        "responsaveis": resp,
        "obrigacao_responsaveis": [{"responsavel_id": resp["id"], "responsaveis": resp}],
    }


def test_agrupa_matriz_e_filial_pela_raiz_do_cnpj():
    contatos = [
        _contato(MATRIZ, "contabil", 0, nome="Camila"),
        _contato(MATRIZ, "contas_pagar", 1, email="b@x.com"),
        _contato(MATRIZ, "contas_pagar", 0, email="a@x.com"),
        _contato(FILIAL, "contas_pagar", 0, email="filial@x.com"),
    ]
    sol = {"id": SOLANGE, "nome": "Solange"}
    fla = {"id": FLAVIA, "nome": "Flávia"}
    obrigacoes = [
        _obrigacao(MATRIZ, "PENDENTE", "2026-10-14", sol),
        _obrigacao(MATRIZ, "EM_REVISAO", "2026-10-01", fla),
        _obrigacao(FILIAL, "ENTREGUE", "2026-10-01", fla),
    ]

    grupos = montar_grupos(_empresas(), contatos, obrigacoes, HOJE)

    assert [g["nome"] for g in grupos] == ["Log Risk", "Nstech GR"]
    gr = grupos[1]
    assert gr["raiz"] == "35929201"
    assert gr["matriz"]["id"] == MATRIZ
    assert [f["id"] for f in gr["filiais"]] == [FILIAL]
    assert gr["bus"] == ["Corporativo", "Embarcador"]
    assert gr["porte"] == "Grande"
    assert (gr["logo_url"], gr["logo_url_escuro"]) == ("/logos/nstech.png", "/logos/nstech-escuro.png")
    assert [c["email"] for c in gr["contatos"]["contas_pagar"]] == ["a@x.com", "b@x.com"]
    assert [c["nome"] for c in gr["contatos"]["contabil"]] == ["Camila"]
    assert gr["filiais"][0]["contatos_diferentes"] is True
    assert gr["matriz"]["contatos_diferentes"] is False
    assert (gr["obrigacoes_total"], gr["obrigacoes_entregues"], gr["obrigacoes_atrasadas"]) == (3, 1, 1)
    assert [(r["nome"], r["total"]) for r in gr["responsaveis_fiscais"]] == [("Flávia", 2), ("Solange", 1)]

    log_risk = grupos[0]
    assert log_risk["raiz"] == f"id:{OUTRA}"
    assert log_risk["filiais"] == []
    assert (log_risk["logo_url"], log_risk["logo_url_escuro"]) == (None, None)
    assert log_risk["contatos"] == {"contabil": [], "contas_pagar": []}


def test_filial_sem_contato_proprio_herda_da_matriz():
    contatos = [_contato(MATRIZ, "contabil", 0, nome="Camila")]
    gr = montar_grupos(_empresas()[:2], contatos, [], HOJE)[0]
    assert gr["filiais"][0]["contatos"] == []
    assert gr["filiais"][0]["contatos_diferentes"] is False
    assert [c["nome"] for c in gr["contatos"]["contabil"]] == ["Camila"]


@pytest.mark.parametrize(
    "user",
    [
        AuthUser(id="u", email="v@x.com", access_token="t", role="user", is_viewer=True),
        AuthUser(id="d", email="d@x.com", access_token="t", role="diretor"),
        AuthUser(id="c", email="c@x.com", access_token="t", role="user"),
    ],
)
def test_so_admin_altera_empresa_e_contatos(user: AuthUser):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db_client] = lambda: object()
    try:
        client = TestClient(app)
        put = client.put(
            f"/api/empresas/{MATRIZ}/contatos",
            json={"area": "contabil", "contatos": [{"nome": "Mari"}]},
        )
        patch = client.patch(f"/api/empresas/{MATRIZ}", json={"porte": "Médio"})
    finally:
        app.dependency_overrides.clear()
    assert put.status_code == 403
    assert patch.status_code == 403

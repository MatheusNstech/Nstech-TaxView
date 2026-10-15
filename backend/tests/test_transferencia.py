"""Pegar/enviar tarefas e obrigações entre colegas da equipe compartilhada."""
from __future__ import annotations

import asyncio
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.api.routes.obrigacoes import transferir as transferir_obrigacao_route
from app.api.routes.tarefas import transferir as transferir_tarefa_route
from app.core.auth import AuthUser, require_not_viewer
from app.schemas.models import TransferirRequest
from app.services.transferencia import (
    frase_transferencia,
    transferir_obrigacao,
    transferir_tarefa,
)
from tests.test_producao import _FakeDB

FLAVIA, FELIPE, GLAUCIA, MATHEUS, INATIVO = (str(uuid4()) for _ in range(5))
FLAVIA_AUTH, FELIPE_AUTH, GLAUCIA_AUTH = (str(uuid4()) for _ in range(3))


def _responsaveis() -> list[dict]:
    return [
        {"id": FLAVIA, "nome": "Flávia", "ativo": True, "equipe_compartilhada": True, "auth_user_id": FLAVIA_AUTH},
        {"id": FELIPE, "nome": "Felipe", "ativo": True, "equipe_compartilhada": True, "auth_user_id": FELIPE_AUTH},
        {"id": GLAUCIA, "nome": "Glaucia", "ativo": True, "equipe_compartilhada": True, "auth_user_id": GLAUCIA_AUTH},
        {"id": MATHEUS, "nome": "Matheus", "ativo": True, "equipe_compartilhada": False},
        {"id": INATIVO, "nome": "Antigo", "ativo": False, "equipe_compartilhada": True},
    ]


def _db(**extra: list[dict]) -> _FakeDB:
    return _FakeDB(
        responsaveis=_responsaveis(),
        tarefa_audit_log=[],
        obrigacao_audit_log=[],
        notificacoes=[],
        empresas=[{"id": "e-1", "razao_social": "ACME"}],
        atividades_modelo=[{"id": "a-1", "nome": "Apuração ICMS"}],
        **extra,
    )


def _user(auth_id: str | None = None, role: str = "user") -> AuthUser:
    return AuthUser(id=auth_id or str(uuid4()), email="u@x.com", access_token="t", role=role)


def _como(responsavel_id: str):
    """O usuário logado é `responsavel_id` (escopo e nome do ator)."""
    resp = next(r for r in _responsaveis() if r["id"] == responsavel_id)
    return (
        patch("app.services.scope.effective_responsavel_id", return_value=UUID(responsavel_id)),
        patch("app.services.transferencia.resolve_responsavel", return_value=resp),
    )


def _tarefa(responsavel_id: str = FELIPE, status: str = "PENDENTE") -> dict:
    return {
        "id": "t-1",
        "titulo": "Conferir guias",
        "status": status,
        "responsavel_id": responsavel_id,
        "empresa_id": "e-1",
    }


def test_frase_transferencia():
    flavia, felipe, matheus = {"id": FLAVIA, "nome": "Flávia"}, {"id": FELIPE, "nome": "Felipe"}, {"id": MATHEUS, "nome": "Matheus"}
    assert frase_transferencia(flavia, felipe, flavia, "tarefa") == "Flávia pegou a tarefa de Felipe"
    assert frase_transferencia(felipe, felipe, flavia, "obrigação") == "Felipe enviou a obrigação para Flávia"
    assert frase_transferencia(matheus, felipe, flavia, "tarefa") == "Matheus passou a tarefa de Felipe para Flávia"


def test_colega_pega_tarefa_do_outro():
    fake = _db(tarefas=[_tarefa()])
    escopo, ator = _como(FLAVIA)
    with escopo, ator:
        frase = transferir_tarefa(fake, _user(FLAVIA_AUTH), _tarefa(), FLAVIA, "Felipe de férias")  # type: ignore[arg-type]

    assert frase == "Flávia pegou a tarefa de Felipe"
    assert fake.db["tarefas"][0]["responsavel_id"] == FLAVIA
    [log] = fake.db["tarefa_audit_log"]
    assert log["acao"] == "Flávia pegou a tarefa de Felipe · Motivo: Felipe de férias"
    # Quem pegou não é avisado; o antigo dono é.
    [aviso] = fake.db["notificacoes"]
    assert aviso["user_id"] == FELIPE_AUTH
    assert aviso["tipo"] == "ATRIBUICAO"
    assert aviso["corpo"] == "Conferir guias · ACME · Motivo: Felipe de férias"


def test_terceiro_passa_tarefa_e_avisa_os_dois():
    fake = _db(tarefas=[_tarefa()])
    escopo, ator = _como(GLAUCIA)
    with escopo, ator:
        frase = transferir_tarefa(fake, _user(GLAUCIA_AUTH), _tarefa(), FLAVIA, None)  # type: ignore[arg-type]

    assert frase == "Glaucia passou a tarefa de Felipe para Flávia"
    assert {n["user_id"] for n in fake.db["notificacoes"]} == {FELIPE_AUTH, FLAVIA_AUTH}


def test_dono_envia_tarefa_para_colega():
    fake = _db(tarefas=[_tarefa()])
    escopo, ator = _como(FELIPE)
    with escopo, ator:
        frase = transferir_tarefa(fake, _user(FELIPE_AUTH), _tarefa(), FLAVIA, None)  # type: ignore[arg-type]

    assert frase == "Felipe enviou a tarefa para Flávia"
    [aviso] = fake.db["notificacoes"]
    assert aviso["user_id"] == FLAVIA_AUTH


@pytest.mark.parametrize(
    ("destino", "status", "esperado"),
    [
        (MATHEUS, "PENDENTE", 403),  # fora da equipe
        (FELIPE, "PENDENTE", 400),  # já é o dono
        (INATIVO, "PENDENTE", 400),  # inativo
        (FLAVIA, "ENTREGUE", 400),
        (FLAVIA, "ENTREGA_PARCIAL", 400),
    ],
)
def test_transferencia_de_tarefa_bloqueada(destino, status, esperado):
    fake = _db(tarefas=[_tarefa(status=status)])
    escopo, ator = _como(FLAVIA)
    with escopo, ator, pytest.raises(HTTPException) as exc:
        transferir_tarefa(fake, _user(FLAVIA_AUTH), _tarefa(status=status), destino, None)  # type: ignore[arg-type]
    assert exc.value.status_code == esperado
    assert fake.db["tarefas"][0]["responsavel_id"] == FELIPE


def test_quem_esta_fora_da_equipe_nao_pega():
    fake = _db(tarefas=[_tarefa()])
    escopo, ator = _como(MATHEUS)
    body = TransferirRequest(responsavel_id=UUID(MATHEUS))
    with escopo, ator, pytest.raises(HTTPException) as exc:
        transferir_tarefa_route(UUID(int=1), body, _user(), fake)  # type: ignore[arg-type]
    # Escopo: id inexistente → 404; com o id real fora da equipe → 403.
    assert exc.value.status_code == 404

    fake.db["tarefas"][0]["id"] = str(UUID(int=1))
    with escopo, ator, pytest.raises(HTTPException) as exc:
        transferir_tarefa_route(UUID(int=1), body, _user(), fake)  # type: ignore[arg-type]
    assert exc.value.status_code == 403


def test_admin_transfere_para_qualquer_responsavel_ativo():
    fake = _db(tarefas=[_tarefa()])
    admin = _user(role="admin")
    with patch("app.services.transferencia.resolve_responsavel", return_value=None):
        frase = transferir_tarefa(fake, admin, _tarefa(), MATHEUS, None)  # type: ignore[arg-type]
    assert frase == "u@x.com passou a tarefa de Felipe para Matheus"
    assert fake.db["tarefas"][0]["responsavel_id"] == MATHEUS


def _obrigacao(status: str = "PENDENTE", data_entrega: str | None = None) -> dict:
    return {
        "id": "o-1",
        "status": status,
        "data_entrega": data_entrega,
        "responsavel_id": FELIPE,
        "atividade_id": "a-1",
        "empresa_id": "e-1",
    }


def _vinculos(*ids: str) -> list[dict]:
    return [{"id": str(uuid4()), "obrigacao_id": "o-1", "responsavel_id": r} for r in ids]


def test_pegar_obrigacao_troca_o_principal_e_mantem_co_responsaveis():
    fake = _db(obrigacoes=[_obrigacao()], obrigacao_responsaveis=_vinculos(FELIPE, GLAUCIA))
    escopo, ator = _como(FLAVIA)
    with escopo, ator:
        frase = transferir_obrigacao(fake, _user(FLAVIA_AUTH), "o-1", FLAVIA, None)  # type: ignore[arg-type]

    assert frase == "Flávia pegou a obrigação de Felipe"
    obrigacao = fake.db["obrigacoes"][0]
    assert obrigacao["responsavel_id"] == FLAVIA
    assert obrigacao["updated_by"] == FLAVIA_AUTH
    assert {v["responsavel_id"] for v in fake.db["obrigacao_responsaveis"]} == {FLAVIA, GLAUCIA}
    [log] = fake.db["obrigacao_audit_log"]
    assert (log["acao"], log["campo"], log["valor_anterior"], log["valor_novo"]) == (
        frase,
        "responsavel_id",
        "Felipe",
        "Flávia",
    )
    [aviso] = fake.db["notificacoes"]
    assert aviso["user_id"] == FELIPE_AUTH
    assert aviso["obrigacao_id"] == "o-1"
    assert aviso["corpo"] == "Apuração ICMS · ACME"


@pytest.mark.parametrize(("status", "data_entrega"), [("ENTREGUE", None), ("PENDENTE", "2026-10-01")])
def test_obrigacao_entregue_nao_transfere(status, data_entrega):
    fake = _db(obrigacoes=[_obrigacao(status, data_entrega)], obrigacao_responsaveis=_vinculos(FELIPE))
    escopo, ator = _como(FLAVIA)
    with escopo, ator, pytest.raises(HTTPException) as exc:
        transferir_obrigacao(fake, _user(FLAVIA_AUTH), "o-1", FLAVIA, None)  # type: ignore[arg-type]
    assert exc.value.status_code == 400


@pytest.mark.parametrize(
    "user",
    [
        AuthUser(id="d", email="d@x.com", access_token="t", role="diretor"),
        AuthUser(id="v", email="v@x.com", access_token="t", role="user", is_viewer=True),
    ],
)
def test_somente_leitura_nao_transfere(user):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_not_viewer(user))
    assert exc.value.status_code == 403


def test_rota_de_obrigacao_devolve_item_atualizado():
    oid = uuid4()
    fake = _db(
        obrigacoes=[{**_obrigacao(), "id": str(oid)}],
        obrigacao_responsaveis=[{**v, "obrigacao_id": str(oid)} for v in _vinculos(FELIPE)],
    )
    escopo, ator = _como(FELIPE)
    body = TransferirRequest(responsavel_id=UUID(FLAVIA), motivo="Fechamento")
    with (
        escopo,
        ator,
        patch("app.api.routes.obrigacoes.assert_obrigacao_in_scope"),
        patch("app.api.routes.obrigacoes._fetch_full", side_effect=lambda _c, oid: {"id": oid}),
    ):
        out = transferir_obrigacao_route(oid, body, _user(FELIPE_AUTH), fake)  # type: ignore[arg-type]
    assert out == {"id": str(oid)}
    assert fake.db["obrigacoes"][0]["responsavel_id"] == FLAVIA
    assert fake.db["obrigacao_audit_log"][0]["acao"] == (
        "Felipe enviou a obrigação para Flávia · Motivo: Fechamento"
    )

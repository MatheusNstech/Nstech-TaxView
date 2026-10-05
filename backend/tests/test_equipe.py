"""Equipe compartilhada: colegas veem e operam itens uns dos outros, com registro."""
from __future__ import annotations

from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.api.routes.obrigacoes import update_obrigacao
from app.core.auth import AuthUser
from app.schemas.models import ObrigacaoUpdate
from app.services.equipe import (
    frase_acao_equipe,
    registrar_acao_equipe_obrigacao,
    registrar_acao_equipe_tarefa,
)
from app.services.scope import (
    assert_obrigacao_in_scope,
    assert_tarefa_in_scope,
    list_scope_ids,
    team_responsavel_ids,
)
from tests.test_producao import _FakeDB

FLAVIA, FELIPE, MATHEUS = str(uuid4()), str(uuid4()), str(uuid4())
FELIPE_AUTH = str(uuid4())


def _responsaveis() -> list[dict]:
    return [
        {"id": FLAVIA, "nome": "Flávia", "ativo": True, "equipe_compartilhada": True},
        {
            "id": FELIPE,
            "nome": "Felipe",
            "ativo": True,
            "equipe_compartilhada": True,
            "auth_user_id": FELIPE_AUTH,
        },
        {"id": MATHEUS, "nome": "Matheus", "ativo": True, "equipe_compartilhada": False},
    ]


def _user() -> AuthUser:
    return AuthUser(id=str(uuid4()), email="u@x.com", access_token="t", role="user")


def _como(responsavel_id: str):
    return patch(
        "app.services.scope.effective_responsavel_id", return_value=UUID(responsavel_id)
    )


def test_membro_da_equipe_ve_colegas_mas_nao_quem_esta_fora():
    fake = _FakeDB(
        responsaveis=_responsaveis(),
        tarefas=[
            {"id": "t-felipe", "responsavel_id": FELIPE},
            {"id": "t-matheus", "responsavel_id": MATHEUS},
        ],
        obrigacoes=[
            {"id": "o-felipe", "responsavel_id": FELIPE},
            {"id": "o-matheus", "responsavel_id": MATHEUS},
        ],
        obrigacao_responsaveis=[],
    )
    user = _user()

    with _como(FLAVIA):
        assert team_responsavel_ids(user, fake) == {FLAVIA, FELIPE}  # type: ignore[arg-type]
        assert assert_tarefa_in_scope(user, fake, "t-felipe")["id"] == "t-felipe"  # type: ignore[arg-type]
        assert assert_obrigacao_in_scope(user, fake, "o-felipe")["id"] == "o-felipe"  # type: ignore[arg-type]
        for check, item in (
            (assert_tarefa_in_scope, "t-matheus"),
            (assert_obrigacao_in_scope, "o-matheus"),
        ):
            with pytest.raises(HTTPException) as exc:
                check(user, fake, item)  # type: ignore[arg-type]
            assert exc.value.status_code == 403

    with _como(MATHEUS):
        assert team_responsavel_ids(user, fake) == {MATHEUS}  # type: ignore[arg-type]
        with pytest.raises(HTTPException):
            assert_tarefa_in_scope(user, fake, "t-felipe")  # type: ignore[arg-type]


def test_listagem_padrao_e_so_o_proprio_e_equipe_traz_todos():
    fake = _FakeDB(responsaveis=_responsaveis())
    user = _user()

    with _como(FLAVIA):
        assert list_scope_ids(user, fake, None) == [FLAVIA]  # type: ignore[arg-type]
        assert list_scope_ids(user, fake, None, equipe=True) == sorted([FLAVIA, FELIPE])  # type: ignore[arg-type]
        assert list_scope_ids(user, fake, UUID(FELIPE)) == [FELIPE]  # type: ignore[arg-type]
        assert list_scope_ids(user, fake, UUID(MATHEUS)) == [FLAVIA]  # type: ignore[arg-type]

    with _como(MATHEUS):
        assert list_scope_ids(user, fake, None, equipe=True) == [MATHEUS]  # type: ignore[arg-type]

    admin = AuthUser(id=str(uuid4()), email="a@x.com", access_token="t", role="admin")
    assert list_scope_ids(admin, fake, None, equipe=True) is None  # type: ignore[arg-type]


def test_frase_da_acao():
    assert frase_acao_equipe("Flávia", ["Felipe"], "PENDENTE", "ENTREGUE") == (
        "Flávia entregou a tarefa de Felipe"
    )
    assert frase_acao_equipe("Flávia", ["Felipe", "Glaucia"], "PENDENTE", "EM_REVISAO") == (
        "Flávia moveu a tarefa de Felipe / Glaucia para Em revisão"
    )
    assert frase_acao_equipe("Flávia", ["Felipe"], "PENDENTE", "PENDENTE") == (
        "Flávia alterou a tarefa de Felipe"
    )


def test_entregar_obrigacao_do_colega_registra_e_avisa_o_dono():
    fake = _FakeDB()
    user = _user()
    obrigacao = {
        "id": "o-1",
        "status": "ENTREGUE",
        "responsaveis": [{"id": FELIPE, "nome": "Felipe"}],
        "atividade": {"nome": "Apuração ICMS"},
        "empresa": {"razao_social": "ACME"},
    }
    ator = {"id": FLAVIA, "nome": "Flávia"}

    with (
        patch("app.services.equipe.resolve_responsavel", return_value=ator),
        patch("app.services.equipe.write_audit") as audit,
        patch("app.services.equipe.notify_responsavel_of_obrigacao") as notify,
    ):
        frase = registrar_acao_equipe_obrigacao(fake, user, obrigacao, status_antes="PENDENTE")  # type: ignore[arg-type]

    assert frase == "Flávia entregou a tarefa de Felipe"
    assert audit.call_args.kwargs["acao"] == frase
    kwargs = notify.call_args.kwargs
    assert kwargs["tipo"] == "EQUIPE"
    assert kwargs["titulo"] == frase
    assert kwargs["exclude_user_id"] == user.id
    assert kwargs["corpo"] == "Apuração ICMS · ACME"

    with (
        patch("app.services.equipe.resolve_responsavel", return_value={"id": FELIPE}),
        patch("app.services.equipe.write_audit") as audit,
        patch("app.services.equipe.notify_responsavel_of_obrigacao") as notify,
    ):
        assert registrar_acao_equipe_obrigacao(fake, user, obrigacao, status_antes="PENDENTE") is None  # type: ignore[arg-type]
    audit.assert_not_called()
    notify.assert_not_called()


def test_entregar_tarefa_do_colega_grava_historico_e_notifica_so_o_dono():
    fake = _FakeDB(tarefa_audit_log=[])
    user = _user()
    tarefa = {
        "id": "t-1",
        "titulo": "Conferir guias",
        "status": "ENTREGUE",
        "responsavel": {"id": FELIPE, "nome": "Felipe", "auth_user_id": FELIPE_AUTH},
        "empresa": {"razao_social": "ACME"},
    }

    with (
        patch("app.services.equipe.resolve_responsavel", return_value={"id": FLAVIA, "nome": "Flávia"}),
        patch("app.services.equipe.create_notification") as notify,
    ):
        registrar_acao_equipe_tarefa(fake, user, tarefa, status_antes="EM_ANDAMENTO")  # type: ignore[arg-type]

    [log] = fake.db["tarefa_audit_log"]
    assert log["acao"] == "Flávia entregou a tarefa de Felipe"
    assert log["tarefa_id"] == "t-1" and log["user_id"] == user.id
    assert notify.call_count == 1
    assert notify.call_args.kwargs["user_id"] == FELIPE_AUTH
    assert notify.call_args.kwargs["tipo"] == "EQUIPE"


def test_update_obrigacao_dispara_registro_da_equipe():
    oid = uuid4()
    fake = _FakeDB(
        obrigacoes=[
            {
                "id": str(oid),
                "status": "PENDENTE",
                "responsavel_id": FELIPE,
                "prazo_legal": "2099-01-20",
                "prazo_fiscal": "2099-01-15",
            }
        ],
        obrigacao_audit_log=[],
    )
    body = ObrigacaoUpdate(status="EM_ANDAMENTO")  # type: ignore[arg-type]

    with (
        patch("app.api.routes.obrigacoes.assert_obrigacao_in_scope"),
        patch("app.api.routes.obrigacoes.registrar_acao_equipe_obrigacao") as registrar,
    ):
        update_obrigacao(oid, body, _user(), fake)  # type: ignore[arg-type]

    assert registrar.call_args.kwargs["status_antes"] == "PENDENTE"
    assert registrar.call_args.args[2]["status"] == "EM_ANDAMENTO"

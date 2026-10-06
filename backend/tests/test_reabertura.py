"""Reabrir item entregue sem virar atraso e coluna Entrega parcial."""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes.obrigacoes import update_obrigacao
from app.api.routes.tarefas import update_tarefa
from app.core.auth import AuthUser
from app.core.clock import today_br
from app.schemas.models import ObrigacaoUpdate, TarefaUpdate
from app.services.equipe import frase_acao_equipe
from app.services.status_engine import normalize_status, urgencia_label
from tests.test_producao import _FakeDB
from tests.test_tarefa_update_owner import TAREFA_ID, FakeClient, _current_row

HOJE = today_br()
PRAZO_VENCIDO = HOJE - timedelta(days=5)


def _user() -> AuthUser:
    return AuthUser(id=str(uuid4()), email="u@x.com", access_token="t", role="user")


def _obrigacao_db(**campos) -> tuple[_FakeDB, str]:
    oid = str(uuid4())
    row = {
        "id": oid,
        "status": "PENDENTE",
        "prazo_legal": PRAZO_VENCIDO.isoformat(),
        "prazo_fiscal": None,
        "data_entrega": None,
        "entrega_original": None,
        "motivo_atraso": None,
        **campos,
    }
    return _FakeDB(obrigacoes=[row], obrigacao_audit_log=[]), oid


def _patch_obrigacao(fake: _FakeDB, oid: str, **campos):
    body = ObrigacaoUpdate(**campos)  # type: ignore[arg-type]
    with patch("app.api.routes.obrigacoes.assert_obrigacao_in_scope"):
        return update_obrigacao(oid, body, _user(), fake)  # type: ignore[arg-type]


def test_status_engine_mede_reaberta_pela_entrega_original():
    no_prazo = PRAZO_VENCIDO - timedelta(days=1)
    assert urgencia_label("EM_REVISAO", PRAZO_VENCIDO, None, entrega_original=no_prazo) == "ok"
    assert normalize_status(
        "PENDENTE", PRAZO_VENCIDO, None, None, entrega_original=no_prazo
    ) == "PENDENTE"
    atrasada = PRAZO_VENCIDO + timedelta(days=1)
    assert urgencia_label("EM_REVISAO", PRAZO_VENCIDO, None, entrega_original=atrasada) == "atrasado"
    assert urgencia_label("EM_REVISAO", PRAZO_VENCIDO, None) == "atrasado"
    assert normalize_status("ENTREGA_PARCIAL", PRAZO_VENCIDO, None, HOJE) == "ENTREGA_PARCIAL"
    assert urgencia_label("ENTREGA_PARCIAL", PRAZO_VENCIDO, None) == "ok"


def test_reabrir_obrigacao_entregue_no_prazo_nao_atrasa_e_reentrega_mantem_data():
    entregue_em = PRAZO_VENCIDO - timedelta(days=1)
    fake, oid = _obrigacao_db(status="ENTREGUE", data_entrega=entregue_em.isoformat())

    out = _patch_obrigacao(fake, oid, status="EM_REVISAO")
    row = fake.db["obrigacoes"][0]
    assert out["status"] == "EM_REVISAO"
    assert out["urgencia"] == "ok"
    assert row["data_entrega"] is None
    assert row["entrega_original"] == entregue_em.isoformat()

    out = _patch_obrigacao(fake, oid, status="ENTREGUE")
    assert out["status"] == "ENTREGUE"
    assert row["data_entrega"] == entregue_em.isoformat()
    assert row["entrega_original"] is None
    assert not row.get("motivo_atraso")


def test_reabrir_obrigacao_entregue_atrasada_continua_atrasada():
    entregue_em = PRAZO_VENCIDO + timedelta(days=2)
    motivo = "Cliente enviou os documentos com atraso"
    fake, oid = _obrigacao_db(
        status="ENTREGUE", data_entrega=entregue_em.isoformat(), motivo_atraso=motivo
    )

    out = _patch_obrigacao(fake, oid, status="EM_ANDAMENTO")
    assert out["urgencia"] == "atrasado"

    out = _patch_obrigacao(fake, oid, status="ENTREGUE")
    assert out["status"] == "ENTREGUE"
    assert fake.db["obrigacoes"][0]["motivo_atraso"] == motivo


def test_entrega_parcial_grava_data_pede_motivo_se_vencida_e_nao_atrasa():
    fake, oid = _obrigacao_db(status="EM_ANDAMENTO")
    with pytest.raises(HTTPException) as exc:
        _patch_obrigacao(fake, oid, status="ENTREGA_PARCIAL")
    assert exc.value.status_code == 400

    futuro = HOJE + timedelta(days=3)
    fake, oid = _obrigacao_db(status="EM_ANDAMENTO", prazo_legal=futuro.isoformat())
    out = _patch_obrigacao(fake, oid, status="ENTREGA_PARCIAL")
    row = fake.db["obrigacoes"][0]
    assert out["status"] == "ENTREGA_PARCIAL"
    assert out["urgencia"] == "ok"
    assert row["data_entrega"] == HOJE.isoformat()

    # Confirmação chega depois do prazo: vale a data da parcial, sem motivo.
    row["prazo_legal"] = PRAZO_VENCIDO.isoformat()
    row["data_entrega"] = (PRAZO_VENCIDO - timedelta(days=1)).isoformat()
    out = _patch_obrigacao(fake, oid, status="ENTREGUE")
    assert out["status"] == "ENTREGUE"
    assert row["data_entrega"] == (PRAZO_VENCIDO - timedelta(days=1)).isoformat()


def test_reabrir_tarefa_entregue_no_prazo_e_reentregar():
    entregue_em = f"{(PRAZO_VENCIDO - timedelta(days=1)).isoformat()}T15:00:00+00:00"
    current = _current_row(
        prazo=PRAZO_VENCIDO.isoformat(), status="ENTREGUE", entregue_em=entregue_em
    )
    client = FakeClient(current)
    saved = client.store["tarefas"][str(TAREFA_ID)]

    with patch("app.api.routes.tarefas.assert_tarefa_in_scope", side_effect=lambda *a: dict(saved)):
        out = update_tarefa(TAREFA_ID, TarefaUpdate(status="EM_ANDAMENTO"), _user(), client)  # type: ignore[arg-type]
        assert out["urgencia"] == "ok"
        assert saved["entregue_em"] is None
        assert saved["entrega_original"] == entregue_em

        out = update_tarefa(TAREFA_ID, TarefaUpdate(status="ENTREGUE"), _user(), client)  # type: ignore[arg-type]
    assert out["status"] == "ENTREGUE"
    assert saved["entregue_em"] == entregue_em
    assert saved["entrega_original"] is None
    assert not saved.get("motivo_atraso")


def test_frases_de_parcial_e_reabertura():
    assert frase_acao_equipe("Flávia", ["Felipe"], "EM_ANDAMENTO", "ENTREGA_PARCIAL") == (
        "Flávia fez entrega parcial da tarefa de Felipe"
    )
    assert frase_acao_equipe("Flávia", ["Felipe"], "ENTREGUE", "EM_REVISAO") == (
        "Flávia reabriu a tarefa de Felipe"
    )

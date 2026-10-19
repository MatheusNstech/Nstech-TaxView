"""Entrega de pendências RFB/PGFN e processos PER/DCOMP."""
from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes.perdcomp import build_summary, prazo_situacao
from app.core.auth import AuthUser
from app.core.clock import today_br
from app.services.fiscal_entrega import (
    EntregarBody,
    ReabrirBody,
    acao_edicao,
    payload_entrega,
    payload_reabertura,
)

TODAY = date(2026, 10, 19)


def _user() -> AuthUser:
    return AuthUser(id=str(uuid4()), email="x@nstech.com.br", access_token="tok")


def _row(valor: float, status: str = "", limite: str | None = None, entregue: str | None = None):
    return {
        "id": str(uuid4()),
        "perdcomp": str(uuid4()),
        "empresa": "OPEN TECH",
        "valor_pedido": valor,
        "status": status,
        "data_limite": limite,
        "entregue_em": entregue,
    }


def test_entregue_sai_do_valor_em_aberto():
    rows = [
        _row(100.0, "Indeferido", "2026-10-01"),
        _row(250.0, "Indeferido", "2026-10-01", entregue="2026-10-18"),
        _row(50.0, "Em análise", "2026-10-22"),
    ]
    s = build_summary(rows, TODAY)
    assert s.valor_total == 400.0
    assert s.valor_entregue == 250.0
    assert s.valor_aberto == 150.0
    assert (s.processos_abertos, s.processos_entregues) == (2, 1)
    # Indeferido e prazos só contam o que segue em aberto.
    assert s.valor_indeferido == 100.0
    assert s.prazos.vencidos == 1
    assert s.prazos.vence_7d == 1


def test_prazo_situacao_entregue_ignora_vencimento():
    assert prazo_situacao(TODAY - timedelta(days=30), TODAY, TODAY) == "entregue"
    assert prazo_situacao(TODAY - timedelta(days=30), TODAY) == "vencido"


def test_entrega_padrao_hoje_com_observacao():
    user = _user()
    data, acao = payload_entrega(EntregarBody(observacao="  DARF pago  "), user)
    hoje = today_br()
    assert data == {"entregue_em": hoje.isoformat(), "entregue_por": user.id, "entrega_obs": "DARF pago"}
    assert acao == f"Marcado como entregue em {hoje:%d/%m/%Y}: DARF pago"


def test_entrega_no_futuro_e_recusada():
    with pytest.raises(HTTPException) as exc:
        payload_entrega(EntregarBody(data=today_br() + timedelta(days=1)), _user())
    assert exc.value.status_code == 400


def test_reabrir_limpa_entrega_e_exige_item_entregue():
    data, acao = payload_reabertura({"entregue_em": "2026-10-18"}, ReabrirBody(motivo="Valor errado"))
    assert data == {"entregue_em": None, "entregue_por": None, "entrega_obs": ""}
    assert acao == "Reaberto: Valor errado"
    with pytest.raises(HTTPException):
        payload_reabertura({"entregue_em": None}, ReabrirBody())


def test_acao_edicao_lista_so_o_que_mudou():
    rotulos = {"status": "Status", "data_limite": "Data limite", "valor_pedido": "Valor"}
    antes = {"status": "Em análise", "data_limite": "2026-10-01", "valor_pedido": 10.5}
    assert acao_edicao(rotulos, antes, dict(antes)) is None
    assert acao_edicao(rotulos, antes, {**antes, "status": "Deferido"}) == "Editou Status"
    assert (
        acao_edicao(rotulos, antes, {**antes, "status": "Deferido", "data_limite": None})
        == "Editou Status e Data limite"
    )

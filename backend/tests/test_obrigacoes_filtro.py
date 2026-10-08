from __future__ import annotations

from typing import Any

from app.api.routes import obrigacoes
from app.core.auth import AuthUser
from app.schemas.models import StatusObrigacao


class _Query:
    def __init__(self, chamadas: list[tuple[str, Any]]):
        self.chamadas = chamadas

    def __getattr__(self, nome: str):
        def metodo(*args: Any, **kwargs: Any) -> "_Query":
            self.chamadas.append((nome, args))
            return self

        return metodo


class _Client:
    def __init__(self) -> None:
        self.chamadas: list[tuple[str, Any]] = []

    def table(self, _nome: str) -> _Query:
        return _Query(self.chamadas)


def _row(id_: str, status: str, prazo: str, data_entrega: str | None = None) -> dict[str, Any]:
    return {
        "id": id_,
        "status": status,
        "competencia": "2020-01-01",
        "prazo_legal": prazo,
        "prazo_fiscal": None,
        "data_entrega": data_entrega,
        "empresas": {"razao_social": "KMM", "cnpj": "02.355.037/0001-00", "bu": "TMS"},
    }


def test_filtro_atrasado_inclui_pendente_com_prazo_vencido(monkeypatch) -> None:
    rows = [
        _row("pendente-vencida", "PENDENTE", "2020-01-10"),
        _row("atrasado-gravado", "ATRASADO", "2020-01-10"),
        _row("pendente-futura", "PENDENTE", "2099-01-10"),
        _row("entregue", "ENTREGUE", "2020-01-10", "2020-01-05"),
    ]
    monkeypatch.setattr(obrigacoes, "list_scope_ids", lambda *a, **k: None)
    monkeypatch.setattr(obrigacoes, "fetch_all", lambda build: (build(), rows)[1])
    client = _Client()
    user = AuthUser(id="u", email="admin@x.com", access_token="t", role="admin")

    out = obrigacoes.query_obrigacoes(
        user, client, status_filter=StatusObrigacao.ATRASADO, q="02.355.037"
    )

    assert sorted(r["id"] for r in out) == ["atrasado-gravado", "pendente-vencida"]
    assert not any(nome == "in_" for nome, _ in client.chamadas)

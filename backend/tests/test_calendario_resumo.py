from datetime import date
from uuid import uuid4

from app.services.calendario import resumo_dia

DIA = date(2026, 10, 15)


def _empresa(nome: str, logo: str | None = None, bu: str = "Logística"):
    return {"id": str(uuid4()), "razao_social": nome, "logo_url": logo, "bu": bu}


def test_conta_sinais_e_tarefas():
    brk = _empresa("BRK", "/logos/brk.png")
    obrigacoes = [
        {"status": "ATRASADO", "urgencia": "atrasado", "empresa": brk},
        {"status": "PENDENTE", "urgencia": "urgente", "empresa": brk},
        {"status": "EM_ANDAMENTO", "urgencia": "ok", "entrega_original": "2026-10-01", "empresa": brk},
        {"status": "ENTREGUE", "urgencia": "ok", "entrega_original": "2026-10-01", "empresa": brk},
    ]
    tarefas = [{"status": "EM_REVISAO", "urgencia": "atrasado", "empresa": None}]

    dia = resumo_dia(DIA, obrigacoes, tarefas)

    assert dia.total == 5
    assert dia.tarefas == 1
    assert dia.atrasadas == 2
    assert dia.reabertas == 1
    assert dia.por_status["ENTREGUE"] == 1


def test_top3_empresas_agrupa_logo_e_conta_restantes():
    brk_a = _empresa("BRK A", "/logos/brk.png")
    brk_b = _empresa("BRK B", "/logos/brk.png")
    kmm = _empresa("KMM", "/logos/kmm.png")
    buonny = _empresa("Buonny", "/logos/buonny.png")
    sem_logo_1 = _empresa("Alfa")
    sem_logo_2 = _empresa("Beta")
    itens = [
        {"status": "PENDENTE", "empresa": e}
        for e in [brk_a, brk_b, brk_a, kmm, kmm, buonny, sem_logo_1, sem_logo_2]
    ]

    dia = resumo_dia(DIA, itens, [])

    assert [e.nome for e in dia.empresas] == ["BRK A", "KMM", "Alfa"]
    assert dia.empresas[0].logo_url == "/logos/brk.png"
    assert dia.mais_empresas == 2


def test_dia_sem_empresa():
    dia = resumo_dia(DIA, [], [{"status": "PENDENTE", "empresa": None}])
    assert dia.empresas == []
    assert dia.mais_empresas == 0
    assert dia.total == 1

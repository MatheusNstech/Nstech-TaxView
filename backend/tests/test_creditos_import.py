"""Parser multi-empresa — variantes CNPJ (H1/I1) e N abas."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from app.services.creditos_import import parse_creditos_path

CREDITOS = Path(__file__).resolve().parents[2] / "Creditos"
FIXTURE_XLSX = Path(__file__).resolve().parent / "fixtures" / "creditos_gbm.xlsx"


@pytest.mark.skipif(not FIXTURE_XLSX.is_file(), reason="fixture xlsx ausente")
def test_parse_xlsx_gbm_cnpj_col_i():
    p = parse_creditos_path(FIXTURE_XLSX)
    assert p.cnpj == "29044316000167"
    assert 1 in p.na_consolidada
    assert any(c.codigo_interno == 1 and c.credito_original_inicial > 0 for c in p.creditos)


@pytest.mark.skipif(not (CREDITOS / "Controle Créditos GBM.xlsb").is_file(), reason="Creditos/ ausente")
def test_parse_xlsb_gbm():
    p = parse_creditos_path(CREDITOS / "Controle Créditos GBM.xlsb")
    assert p.cnpj == "29044316000167"
    assert p.na_consolidada == {1, 2, 3}
    c1 = next(c for c in p.creditos if c.codigo_interno == 1)
    assert c1.credito_original_inicial == Decimal("714507.36")
    assert len(c1.eventos) >= 20
    assert len(p.selic) > 100


@pytest.mark.skipif(not (CREDITOS / "Controle Créditos KMM.xlsb").is_file(), reason="Creditos/ ausente")
def test_parse_xlsb_kmm_cnpj_col_h_e_4_creditos():
    p = parse_creditos_path(CREDITOS / "Controle Créditos KMM.xlsb")
    assert p.cnpj == "02355037000168"
    assert p.na_consolidada == {1, 2, 3, 4}
    codes = {c.codigo_interno for c in p.creditos}
    assert codes == {1, 2, 3, 4}
    assert all(c.credito_original_inicial > 0 for c in p.creditos)


@pytest.mark.skipif(not (CREDITOS / "Controle Créditos Trizy.xlsb").is_file(), reason="Creditos/ ausente")
def test_parse_xlsb_trizy_so_aba_1():
    p = parse_creditos_path(CREDITOS / "Controle Créditos Trizy.xlsb")
    assert p.cnpj == "28556723000190"
    assert [c.codigo_interno for c in p.creditos] == [1]
    assert 1 in p.na_consolidada

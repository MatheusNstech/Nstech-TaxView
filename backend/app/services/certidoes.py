"""Certidões (CND) das empresas: leitura dos dados do PDF e nomes de arquivo."""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Literal

from app.services.pdf_texto import primeiro_cnpj, so_digitos

BUCKET = "certidoes"
# A tabela aceita estadual e municipal; a leitura e as rotas ainda só tratam a federal.
EsferaSuportada = Literal["federal"]
ROTULO_ESFERA = {"federal": "Federal", "estadual": "Estadual", "municipal": "Municipal"}

_EMITIDA_RE = re.compile(r"Emitida [^.]*?do dia (\d{2}/\d{2}/\d{4})", re.IGNORECASE)
_VALIDA_RE = re.compile(r"V[aá]lida at[eé] (\d{2}/\d{2}/\d{4})", re.IGNORECASE)
_CODIGO_RE = re.compile(r"C[oó]digo de controle da certid[aã]o: ?([0-9A-F]{4}(?:\.[0-9A-F]{4}){3})", re.IGNORECASE)


def storage_path(empresa_id: str, esfera: str) -> str:
    return f"{empresa_id}/{esfera}.pdf"


def nome_arquivo(esfera: str, cnpj: str) -> str:
    digitos = so_digitos(cnpj)
    alvo = f"{digitos[:2]}.{digitos[2:5]}.{digitos[5:8]}" if esfera == "federal" and len(digitos) == 14 else cnpj
    return f"CND {ROTULO_ESFERA.get(esfera, esfera)} - {alvo.replace('/', '-')}.pdf"


def _data(texto: str, regex: re.Pattern[str]) -> date | None:
    achado = regex.search(texto)
    if not achado:
        return None
    try:
        return datetime.strptime(achado.group(1), "%d/%m/%Y").date()
    except ValueError:
        return None


def _situacao(texto: str) -> str | None:
    t = texto.upper()
    if "POSITIVA COM EFEITOS DE NEGATIVA" in t:
        return "positiva_efeitos_negativa"
    if "CERTIDÃO NEGATIVA" in t or "CERTIDAO NEGATIVA" in t:
        return "negativa"
    if "CERTIDÃO POSITIVA" in t or "CERTIDAO POSITIVA" in t:
        return "positiva"
    return None


def ler_cnd_federal(texto: str) -> dict[str, Any]:
    codigo = _CODIGO_RE.search(texto)
    return {
        "cnpj": primeiro_cnpj(texto),
        "situacao": _situacao(texto),
        "emitida_em": _data(texto, _EMITIDA_RE),
        "valida_ate": _data(texto, _VALIDA_RE),
        "codigo_controle": codigo.group(1).upper() if codigo else None,
    }

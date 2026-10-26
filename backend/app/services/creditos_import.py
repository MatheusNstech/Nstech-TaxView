"""Importação do Controle de Créditos (.xlsx / .xlsb)."""

from __future__ import annotations

import io
import re
import tempfile
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from openpyxl import Workbook, load_workbook

from app.services.creditos_engine import money

MESES_PT = {
    "jan": 1,
    "janeiro": 1,
    "fev": 2,
    "fevereiro": 2,
    "mar": 3,
    "marco": 3,
    "março": 3,
    "abr": 4,
    "abril": 4,
    "mai": 5,
    "maio": 5,
    "jun": 6,
    "junho": 6,
    "jul": 7,
    "julho": 7,
    "ago": 8,
    "agosto": 8,
    "set": 9,
    "setembro": 9,
    "out": 10,
    "outubro": 10,
    "nov": 11,
    "novembro": 11,
    "dez": 12,
    "dezembro": 12,
}

EXCEL_EPOCH = date(1899, 12, 30)


@dataclass
class CreditoParsed:
    codigo_interno: int
    tipo_credito: str = ""
    tributo: str = ""
    ano_calendario: int | None = None
    credito_original_inicial: Decimal = Decimal("0")
    data_inicio_atualizacao: date | None = None
    observacao: str = ""
    excel_saldo_jul: Decimal | None = None
    excel_total_comp: Decimal | None = None
    excel_remanescente: Decimal | None = None
    eventos: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ImportParsed:
    cnpj: str = ""
    razao_social: str = ""
    conta_contabil: str = ""
    descricao_conta: str = "Saldo Negativo de Anos Anteriores"
    competencia_ref: date | None = None
    na_consolidada: set[int] = field(default_factory=set)
    selic: dict[date, Decimal] = field(default_factory=dict)
    creditos: list[CreditoParsed] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class SheetGrid:
    """Grade 1-based (row, col) — compatível com openpyxl e pyxlsb."""

    name: str
    cells: dict[tuple[int, int], Any]
    max_row: int
    max_col: int

    def cell(self, row: int, col: int) -> Any:
        return self.cells.get((row, col))


@dataclass
class WorkbookGrid:
    sheets: dict[str, SheetGrid]  # nome original -> grid

    @property
    def sheetnames(self) -> list[str]:
        return list(self.sheets.keys())

    def get(self, *names: str) -> SheetGrid | None:
        lower = {n.lower(): n for n in self.sheets}
        for name in names:
            key = name.lower()
            if key in lower:
                return self.sheets[lower[key]]
            for sn, orig in lower.items():
                if key in sn:
                    return self.sheets[orig]
        return None


def _digits(cnpj: str | None) -> str:
    return re.sub(r"\D", "", cnpj or "")


def so_digitos_cnpj(cnpj: str) -> str:
    return _digits(cnpj)


def _to_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date().replace(day=1)
    if isinstance(value, date):
        return value.replace(day=1)
    if isinstance(value, (int, float)):
        if value > 20000:
            return (EXCEL_EPOCH + timedelta(days=int(value))).replace(day=1)
        return None
    text = str(value).strip().lower()
    # jul/26, jul-26, julho-26, julho/2026
    m = re.match(r"([a-zç]+)[/\-\s]+(\d{2,4})", text)
    if m:
        token = m.group(1)
        mes = MESES_PT.get(token) or MESES_PT.get(token[:3])
        ano = int(m.group(2))
        if ano < 100:
            ano += 2000
        if mes:
            return date(ano, mes, 1)
    try:
        return date.fromisoformat(text[:10]).replace(day=1)
    except ValueError:
        return None


def _to_day(value: Any) -> date | None:
    """Data com o dia (as datas de compensação da col U); None se não houver dia."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)) and value > 20000:
        return EXCEL_EPOCH + timedelta(days=int(value))
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip()[:10])
        except ValueError:
            return None
    return None


def _texto(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def _to_decimal(value: Any) -> Decimal | None:
    if value is None or value == "" or value == "-":
        return None
    if isinstance(value, Decimal):
        return money(value)
    if isinstance(value, (int, float)):
        return money(value)
    text = str(value).strip().replace("%", "").replace(" ", "")
    if not text or text in {"-", "—"}:
        return None
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return money(text)
    except Exception:  # noqa: BLE001
        return None


def _infer_tributo(tipo: str) -> str:
    t = (tipo or "").upper()
    if "CSLL" in t:
        return "CSLL"
    if "IRPJ" in t or "IR " in t or t.endswith("IR"):
        return "IRPJ"
    return ""


def _detect_format(content: bytes, filename: str | None = None) -> str:
    name = (filename or "").lower()
    if name.endswith(".xlsb") or content[:2] == b"PK" and name.endswith(".xlsb"):
        # xlsb is OLE/CFB, often starts with D0 CF
        pass
    if name.endswith(".xlsb") or content[:4] == b"\xd0\xcf\x11\xe0":
        # CFB compound → xlsb (or xls); we only support xlsb via pyxlsb
        if name.endswith(".xlsb") or name.endswith(".xls"):
            return "xlsb"
        # zip/xlsx starts with PK
    if content[:2] == b"PK" or name.endswith(".xlsx"):
        return "xlsx"
    if name.endswith(".xlsb"):
        return "xlsb"
    if content[:4] == b"\xd0\xcf\x11\xe0":
        return "xlsb"
    return "xlsx"


def _load_xlsx_grid(content: bytes) -> WorkbookGrid:
    wb = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    sheets: dict[str, SheetGrid] = {}
    try:
        for name in wb.sheetnames:
            ws = wb[name]
            cells: dict[tuple[int, int], Any] = {}
            max_r = 0
            max_c = 0
            for row in ws.iter_rows():
                for cell in row:
                    if cell.value is None:
                        continue
                    r, c = cell.row, cell.column
                    cells[(r, c)] = cell.value
                    max_r = max(max_r, r)
                    max_c = max(max_c, c)
            sheets[name] = SheetGrid(name=name, cells=cells, max_row=max_r, max_col=max_c)
    finally:
        wb.close()
    return WorkbookGrid(sheets=sheets)


def _load_xlsb_grid(content: bytes) -> WorkbookGrid:
    try:
        from pyxlsb import open_workbook
    except ImportError as exc:
        raise ValueError(
            "Suporte a .xlsb requer o pacote pyxlsb. Instale com: pip install pyxlsb"
        ) from exc

    sheets: dict[str, SheetGrid] = {}
    with tempfile.NamedTemporaryFile(suffix=".xlsb", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        with open_workbook(tmp_path) as wb:
            for name in wb.sheets:
                cells: dict[tuple[int, int], Any] = {}
                max_r = 0
                max_c = 0
                with wb.get_sheet(name) as sh:
                    for ridx, row in enumerate(sh.rows(), start=1):
                        for c in row:
                            if c.v is None:
                                continue
                            # pyxlsb col is 0-based
                            col = c.c + 1
                            cells[(ridx, col)] = c.v
                            max_r = max(max_r, ridx)
                            max_c = max(max_c, col)
                sheets[name] = SheetGrid(name=name, cells=cells, max_row=max_r, max_col=max_c)
    finally:
        Path(tmp_path).unlink(missing_ok=True)
    return WorkbookGrid(sheets=sheets)


def load_workbook_grid(content: bytes, filename: str | None = None) -> WorkbookGrid:
    fmt = _detect_format(content, filename)
    try:
        if fmt == "xlsb":
            return _load_xlsb_grid(content)
        return _load_xlsx_grid(content)
    except ValueError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            "Não foi possível ler o Excel. Use .xlsx ou .xlsb no formato Controle de Créditos."
        ) from exc


def _extract_header(ws: SheetGrid) -> tuple[str, str]:
    """Razão social + CNPJ na linha 1 (layouts H1 ou I1)."""
    razao = ""
    cnpj = ""
    row1 = [(c, ws.cell(1, c)) for c in range(1, max(ws.max_col, 12) + 1)]
    for col, val in row1:
        if val is None:
            continue
        text = str(val).strip()
        digits = _digits(text)
        if len(digits) == 14 and not cnpj:
            cnpj = digits
        label = text.casefold().replace(" ", "")
        if label.startswith("cnpj"):
            # valor na próxima coluna não vazia
            for c2 in range(col + 1, col + 4):
                v2 = ws.cell(1, c2)
                if v2 is None:
                    continue
                d2 = _digits(str(v2))
                if len(d2) == 14:
                    cnpj = d2
                    break
        if isinstance(val, str) and len(text) > 8 and "cnpj" not in label and not razao:
            # candidato a razão (col E tipicamente)
            if col <= 6:
                razao = text
    if not razao:
        for col in (5, 4, 3):
            v = ws.cell(1, col)
            if isinstance(v, str) and len(v.strip()) > 3:
                razao = v.strip()
                break
    return razao, cnpj


def parse_creditos_bytes(content: bytes, filename: str | None = None) -> ImportParsed:
    wb = load_workbook_grid(content, filename)
    return _parse_grid(wb)


def parse_creditos_xlsx(content: bytes) -> ImportParsed:
    """Compat: alias do parse genérico."""
    return parse_creditos_bytes(content, "file.xlsx")


def parse_creditos_path(path: Path | str) -> ImportParsed:
    p = Path(path)
    return parse_creditos_bytes(p.read_bytes(), p.name)


def _parse_grid(wb: WorkbookGrid) -> ImportParsed:
    out = ImportParsed()

    for sheet_name in ("1", "Posição_Consolidada", "Posicao_Consolidada", "SELIC"):
        ws = wb.get(sheet_name)
        if not ws:
            continue
        razao, cnpj = _extract_header(ws)
        if razao and not out.razao_social:
            out.razao_social = razao
        if cnpj and not out.cnpj:
            out.cnpj = cnpj
        if out.cnpj:
            break

    cons = wb.get("Posição_Consolidada", "Posicao_Consolidada")
    if cons:
        conta = cons.cell(10, 4)
        desc = cons.cell(10, 5)
        if conta is not None and str(conta).strip():
            # pode ser float 113359.0
            if isinstance(conta, float) and conta.is_integer():
                out.conta_contabil = str(int(conta))
            else:
                out.conta_contabil = str(conta).strip()
        else:
            out.warnings.append("Conta contábil não encontrada na consolidada (D10).")
        if desc:
            out.descricao_conta = str(desc).strip()
        # Título "…_2026_07" / "…_2026_06" é a competência do arquivo (mais confiável que D8/E8)
        for col in (11, 10, 9):
            titulo = cons.cell(4, col)
            if isinstance(titulo, str):
                m = re.search(r"(20\d{2})[_/\-](\d{2})", titulo)
                if m:
                    out.competencia_ref = date(int(m.group(1)), int(m.group(2)), 1)
                    break
        if not out.competencia_ref:
            # E8 costuma ser o mês de referência (serial); D8 às vezes é o início do período
            out.competencia_ref = _to_date(cons.cell(8, 5)) or _to_date(cons.cell(8, 4))
        if not out.competencia_ref:
            out.warnings.append("Competência de referência não encontrada na consolidada.")
        for row in range(12, 21):
            codigo = cons.cell(row, 3)
            if isinstance(codigo, (int, float)) and 1 <= int(codigo) <= 20:
                out.na_consolidada.add(int(codigo))

    selic_ws = wb.get("SELIC")
    if selic_ws:
        out.selic = _parse_selic_matrix(selic_ws)
    else:
        out.warnings.append("Aba SELIC não encontrada — taxas não importadas.")

    # todas as abas cujo nome é só dígitos 1..20
    digit_sheets: list[tuple[int, SheetGrid]] = []
    for name, grid in wb.sheets.items():
        if name.strip().isdigit():
            codigo = int(name.strip())
            if 1 <= codigo <= 20:
                digit_sheets.append((codigo, grid))
    digit_sheets.sort(key=lambda x: x[0])

    if not digit_sheets:
        out.warnings.append("Nenhuma aba de crédito (1, 2, …) encontrada.")

    for codigo, ws in digit_sheets:
        out.creditos.append(_parse_ledger_sheet(ws, codigo, out.competencia_ref))

    if not out.na_consolidada and out.creditos:
        for c in out.creditos:
            if c.credito_original_inicial > 0:
                out.na_consolidada.add(c.codigo_interno)
        if not out.na_consolidada and out.creditos:
            out.na_consolidada.add(out.creditos[0].codigo_interno)

    return out


def _parse_selic_matrix(ws: SheetGrid) -> dict[date, Decimal]:
    result: dict[date, Decimal] = {}
    year_by_col: dict[int, int] = {}
    for col in range(3, min(ws.max_col, 80) + 1):
        y = ws.cell(8, col)
        if isinstance(y, (int, float)) and 1900 <= int(y) <= 2100:
            year_by_col[col] = int(y)
    for row in range(9, 21):
        mes = ws.cell(row, 2)
        if not isinstance(mes, (int, float)) or not (1 <= int(mes) <= 12):
            nome = str(ws.cell(row, 3) or "").strip().lower()[:3]
            mes_n = MESES_PT.get(nome)
            if not mes_n:
                continue
            mes = mes_n
        mes = int(mes)
        for col, year in year_by_col.items():
            raw = ws.cell(row, col)
            if raw is None or raw == "":
                continue
            d = Decimal(str(raw))
            if d >= 1:
                d = d / Decimal("100")
            result[date(year, mes, 1)] = d
    return result


def _parse_ledger_sheet(
    ws: SheetGrid,
    codigo: int,
    competencia_ref: date | None = None,
) -> CreditoParsed:
    titulo = str(ws.cell(5, 3) or "")
    tipo = str(ws.cell(7, 4) or "") or titulo
    ano = ws.cell(7, 6)
    ano_i = int(ano) if isinstance(ano, (int, float)) else None
    observacao = ""
    for r in range(20, min(ws.max_row, 60) + 1):
        val = ws.cell(r, 4) or ws.cell(r, 3)
        if isinstance(val, str) and len(val) > 20 and "saldo" in val.lower():
            observacao = val.strip()
            break

    original = Decimal("0")
    data_inicio: date | None = None
    excel_by_comp: dict[date, dict[str, Decimal]] = {}
    for row in range(7, min(ws.max_row, 200) + 1):
        data_cell = ws.cell(row, 7)
        comp = _to_date(data_cell)
        if not comp:
            orig_cell = _to_decimal(ws.cell(row, 9))
            if orig_cell and orig_cell > 0 and original == 0:
                original = orig_cell
            continue
        orig_cell = _to_decimal(ws.cell(row, 9))
        if orig_cell is not None and original == 0 and orig_cell > 0:
            original = orig_cell
            data_inicio = comp
        if data_inicio is None:
            data_inicio = comp
        saldo = _to_decimal(ws.cell(row, 12))
        tot = _to_decimal(ws.cell(row, 15))
        rem = _to_decimal(ws.cell(row, 16))
        if any(v is not None for v in (saldo, tot, rem)):
            excel_by_comp[comp] = {
                "saldo": saldo or Decimal("0"),
                "comp": tot or Decimal("0"),
                "rem": rem or Decimal("0"),
            }

    eventos: list[dict[str, Any]] = []
    for row in range(7, min(ws.max_row, 500) + 1):
        data_u = ws.cell(row, 21)
        principal = _to_decimal(ws.cell(row, 22))
        multa = _to_decimal(ws.cell(row, 23)) or Decimal("0")
        juros = _to_decimal(ws.cell(row, 24)) or Decimal("0")
        if principal is None or principal == 0:
            continue
        comp = _to_date(data_u)
        if not comp:
            continue
        eventos.append(
            {
                "competencia": comp.isoformat(),
                "data_compensacao": (_to_day(data_u) or comp).isoformat(),
                "valor": float(principal),
                "multa": float(multa),
                "juros_evento": float(juros),
                # Y = Total (derivado); Z = Nº Dcomp, AA = Cód Receita, AB = Débito Compensado
                "numero_dcomp": _texto(ws.cell(row, 26)),
                "cod_receita": _texto(ws.cell(row, 27)),
                "debito_compensado": _texto(ws.cell(row, 28)),
            }
        )

    ref_comp = max(excel_by_comp) if excel_by_comp else None
    snap_key = competencia_ref if competencia_ref in excel_by_comp else ref_comp
    snap = excel_by_comp.get(snap_key) if snap_key else None

    return CreditoParsed(
        codigo_interno=codigo,
        tipo_credito=tipo.strip(),
        tributo=_infer_tributo(tipo + " " + titulo),
        ano_calendario=ano_i,
        credito_original_inicial=original,
        data_inicio_atualizacao=data_inicio,
        observacao=observacao,
        excel_saldo_jul=snap["saldo"] if snap else None,
        excel_total_comp=snap["comp"] if snap else None,
        excel_remanescente=snap["rem"] if snap else None,
        eventos=eventos,
    )


def build_modelo_xlsx() -> bytes:
    wb = Workbook()
    cons = wb.active
    cons.title = "Posição_Consolidada"
    cons["E1"] = "EMPRESA EXEMPLO LTDA"
    cons["H1"] = "CNPJ:"
    cons["I1"] = "00.000.000/0001-00"
    cons["E8"] = "jul/26"
    cons["D10"] = "113359"
    cons["E10"] = "Saldo Negativo de Anos Anteriores"
    cons["C11"] = "Id"
    cons["C12"] = 1
    cons["C13"] = 2
    cons["C14"] = 3

    for codigo in range(1, 5):
        ws = wb.create_sheet(str(codigo))
        ws["E1"] = "EMPRESA EXEMPLO LTDA"
        ws["H1"] = "CNPJ:"
        ws["I1"] = "00.000.000/0001-00"
        ws["C5"] = (
            "Saldo Negativo IRPJ Ano calendário 2025"
            if codigo == 1
            else "Saldo Negativo CSLL Ano calendário 2025"
        )
        ws["C6"] = "Id"
        ws["D6"] = "Tipo Crédito"
        ws["F6"] = "Ano Calendário"
        ws["G6"] = "Data Atualização"
        ws["I6"] = "Crédito Original"
        ws["C7"] = codigo if codigo <= 2 else 2
        ws["D7"] = "Saldo Negativo IRPJ" if codigo == 1 else "Saldo Negativo CSLL"
        ws["F7"] = 2025
        ws["G7"] = "jan/26" if codigo <= 2 else "jan/25"
        ws["I7"] = 1000.00 if codigo == 1 else (0 if codigo < 4 else 500.00)
        ws["U6"] = "Data Compensação"
        ws["V6"] = "Principal"
        ws["W6"] = "Multa"
        ws["X6"] = "Juros"
        ws["Y6"] = "Total"

    selic = wb.create_sheet("SELIC")
    selic["C4"] = "Juros SELIC"
    selic["C8"] = "Mês/Ano"
    for i, year in enumerate(range(2024, 2027)):
        selic.cell(row=8, column=4 + i, value=year)
    nomes_mes = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
    ]
    for m in range(1, 13):
        selic.cell(row=8 + m, column=2, value=m)
        selic.cell(row=8 + m, column=3, value=nomes_mes[m - 1])
        for i in range(3):
            selic.cell(row=8 + m, column=4 + i, value=0.01)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()

from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime, time, timezone
from typing import Any

from supabase import Client

from app.services.status_engine import compute_prazo

COMPETENCIA_DEFAULT = date(2026, 8, 1)
COMPETENCIA_SUFFIX_RE = re.compile(r"\s*\((\d{2})/(\d{4})\)\s*$")
VALID_STATUS = {"PENDENTE", "EM_ANDAMENTO", "EM_REVISAO", "ENTREGUE", "ATRASADO"}

IMPORT_HEADERS = [
    "Tipo",
    "CNPJ",
    "Razão Social",
    "BU",
    "Apuração",
    "Atividade",
    "Título",
    "Responsável",
    "E-mail responsável",
    "Solicitante",
    "Descrição",
    "Categoria",
    "Recorrência",
    "Dia prazo legal",
    "Dia prazo fiscal",
    "Competência",
    "Prazo legal",
    "Prazo fiscal",
    "Hora início",
    "Hora fim",
    "Data entrega",
    "Número recibo",
    "Observação",
    "Motivo atraso",
    "Status",
]


_EXAMPLE_OBRIGACAO = [
    "Obrigação",
    "00.000.000/0001-00",
    "Empresa Exemplo LTDA",
    "BU Exemplo",
    "VERDADEIRO",
    "Apuração ISS Prestados",
    "",
    "Nome do responsável",
    "responsavel@empresa.com.br",
    "",
    "",
    "fechamento",
    "mensal",
    "20",
    "15",
    "2026-08-01",
    "2026-09-20",
    "2026-09-15",
    "",
    "",
    "",
    "",
    "",
    "",
    "PENDENTE",
]

_EXAMPLE_TAREFA = [
    "Tarefa",
    "00.000.000/0001-00",
    "Empresa Exemplo LTDA",
    "BU Exemplo",
    "",
    "",
    "Conferir guias do cliente",
    "Nome do responsável",
    "responsavel@empresa.com.br",
    "Maria Solicitante",
    "Follow-up pedido pelo cliente",
    "outras",
    "",
    "",
    "",
    "2026-08-01",
    "",
    "2026-09-15",
    "09:00",
    "12:00",
    "",
    "",
    "",
    "",
    "PENDENTE",
]


def build_import_template_xlsx() -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter
    from openpyxl.worksheet.datavalidation import DataValidation

    wb = Workbook()
    ws = wb.active
    ws.title = "Importação"
    ws.append(IMPORT_HEADERS)
    ws.append(_EXAMPLE_OBRIGACAO)
    ws.append(_EXAMPLE_TAREFA)
    cnpj_col = IMPORT_HEADERS.index("CNPJ") + 1
    for row_idx in range(2, 501):
        ws.cell(row_idx, cnpj_col).number_format = "@"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="FF3D03")
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill

    for col in range(1, len(IMPORT_HEADERS) + 1):
        letter = get_column_letter(col)
        ws.column_dimensions[letter].width = max(18, len(str(ws.cell(1, col).value)) + 2)

    def col_range(name: str) -> str:
        letter = get_column_letter(IMPORT_HEADERS.index(name) + 1)
        return f"{letter}2:{letter}500"

    last_col = get_column_letter(len(IMPORT_HEADERS))
    status_validation = DataValidation(
        type="list",
        formula1='"PENDENTE,EM_ANDAMENTO,EM_REVISAO,ENTREGUE,ATRASADO"',
        allow_blank=True,
    )
    apuracao_validation = DataValidation(
        type="list",
        formula1='"VERDADEIRO,FALSO"',
        allow_blank=True,
    )
    tipo_validation = DataValidation(
        type="list",
        formula1='"Obrigação,Tarefa"',
        allow_blank=True,
    )
    categoria_validation = DataValidation(
        type="list",
        formula1='"fechamento,outras"',
        allow_blank=True,
    )
    ws.add_data_validation(status_validation)
    ws.add_data_validation(apuracao_validation)
    ws.add_data_validation(tipo_validation)
    ws.add_data_validation(categoria_validation)
    status_validation.add(col_range("Status"))
    apuracao_validation.add(col_range("Apuração"))
    tipo_validation.add(col_range("Tipo"))
    categoria_validation.add(col_range("Categoria"))
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{last_col}1"

    notes = wb.create_sheet("Como preencher")
    notes["A1"] = "Como preencher"
    notes["A1"].font = Font(bold=True, size=14)
    notes["A3"] = "Apague as duas linhas de exemplo antes de importar."
    notes["A4"] = "Tipo Obrigação: CNPJ e Atividade são obrigatórios. Solicitante e horário não se aplicam."
    notes["A5"] = "Tipo Tarefa: Título, Solicitante, Responsável, Prazo fiscal (ou Prazo legal), Hora início e Hora fim."
    notes["A6"] = "Tarefa pode ficar sem CNPJ. Competência vazia usa o mês escolhido na tela."
    notes["A7"] = "Categoria: fechamento ou outras. Horário no formato HH:MM. Datas AAAA-MM-DD."
    notes["A8"] = "Status: PENDENTE, EM_ANDAMENTO, EM_REVISAO, ENTREGUE ou ATRASADO."
    notes["A9"] = "Data entrega, número do recibo, observação e motivo do atraso são opcionais (úteis no legado)."
    notes.column_dimensions["A"].width = 110

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def _cell_text(value: Any, header: str = "") -> str:
    if value is None:
        return ""
    header_l = header.lower()
    is_time_col = "hora" in header_l
    if isinstance(value, datetime):
        if is_time_col or value.year <= 1900:
            return value.strftime("%H:%M")
        return value.date().isoformat()
    if isinstance(value, time):
        return value.strftime("%H:%M")
    if isinstance(value, date):
        return value.isoformat()
    if is_time_col and isinstance(value, (int, float)):
        seconds = int(round(float(value) * 86400)) % 86400
        hours, rem = divmod(seconds, 3600)
        minutes = rem // 60
        return f"{hours:02d}:{minutes:02d}"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, bool):
        return "VERDADEIRO" if value else "FALSO"
    return str(value).strip()


def rows_from_xlsx(content: bytes) -> list[dict[str, str]]:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    ws = wb["Importação"] if "Importação" in wb.sheetnames else wb.active
    raw_rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not raw_rows:
        raise ValueError("Planilha sem cabeçalho")
    headers = [_cell_text(cell) for cell in raw_rows[0]]
    if not any(headers):
        raise ValueError("Planilha sem cabeçalho")
    out: list[dict[str, str]] = []
    for raw in raw_rows[1:]:
        if raw is None or all(_cell_text(cell) == "" for cell in raw):
            continue
        row: dict[str, str] = {}
        for idx, header in enumerate(headers):
            if not header:
                continue
            value = raw[idx] if idx < len(raw) else None
            row[header] = _cell_text(value, header)
        out.append(row)
    return out


def build_import_template_csv() -> bytes:
    """Modelo com cabeçalho e uma linha de exemplo. Separador ; para o Excel."""
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";", lineterminator="\r\n")
    writer.writerow(IMPORT_HEADERS)
    writer.writerow(_EXAMPLE_OBRIGACAO)
    writer.writerow(_EXAMPLE_TAREFA)
    return ("\ufeff" + buf.getvalue()).encode("utf-8")


def _decode_csv(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("cp1252", errors="replace")


def _parse_iso_date(value: str) -> date | None:
    text = value.strip()
    if not text:
        return None
    if re.fullmatch(r"\d{4}-\d{2}", text):
        return date.fromisoformat(f"{text}-01")
    if re.fullmatch(r"\d{2}/\d{2}/\d{4}", text):
        day, month, year = text.split("/")
        return date(int(year), int(month), int(day))
    if re.fullmatch(r"\d{2}/\d{4}", text):
        month, year = text.split("/")
        return date(int(year), int(month), 1)
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _parse_day(value: str) -> int | None:
    text = value.strip()
    if not text:
        return None
    try:
        day = int(text)
    except ValueError:
        return None
    if 1 <= day <= 31:
        return day
    return None


def _parse_status(value: str) -> str:
    text = value.strip().upper().replace(" ", "_")
    aliases = {
        "EM ANDAMENTO": "EM_ANDAMENTO",
        "EM REVISAO": "EM_REVISAO",
        "EM REVISÃO": "EM_REVISAO",
    }
    text = aliases.get(text, text)
    return text if text in VALID_STATUS else "PENDENTE"


def _parse_tipo(value: str) -> str:
    text = value.strip().lower().replace("ã", "a").replace("ç", "c")
    return "tarefa" if text == "tarefa" else "obrigacao"


def _parse_categoria(value: str) -> str | None:
    text = value.strip().lower()
    aliases = {"fechamento": "fechamento", "outras": "outras", "outra": "outras"}
    return aliases.get(text)


def _parse_time(value: str) -> str | None:
    text = value.strip().replace(".", ":")
    if not text:
        return None
    match = re.fullmatch(r"(\d{1,2}):(\d{2})(?::\d{2})?", text)
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    if 0 <= hour <= 23 and 0 <= minute <= 59:
        return f"{hour:02d}:{minute:02d}:00"
    return None


def normalize_atividade_nome(raw: str) -> tuple[str, date | None]:
    text = " ".join(raw.split())
    match = COMPETENCIA_SUFFIX_RE.search(text)
    competencia: date | None = None
    if match:
        month = int(match.group(1))
        year = int(match.group(2))
        competencia = date(year, month, 1)
        text = COMPETENCIA_SUFFIX_RE.sub("", text).strip()
    return text, competencia


def parse_bool_pt(value: str) -> bool:
    return value.strip().upper() in {"VERDADEIRO", "TRUE", "1", "SIM"}


def _upsert_map(
    client: Client,
    table: str,
    key_field: str,
    rows: list[dict[str, Any]],
) -> dict[str, str]:
    result: dict[str, str] = {}
    if not rows:
        return result
    # fetch existing
    existing = client.table(table).select(f"id,{key_field}").execute().data or []
    for item in existing:
        result[str(item[key_field])] = item["id"]

    to_insert = [r for r in rows if r[key_field] not in result]
    if to_insert:
        inserted = client.table(table).upsert(to_insert, on_conflict=key_field).execute().data or []
        for item in inserted:
            result[str(item[key_field])] = item["id"]
        # refresh if upsert didn't return
        if len(result) < len(rows):
            existing = client.table(table).select(f"id,{key_field}").execute().data or []
            for item in existing:
                result[str(item[key_field])] = item["id"]
    return result


def import_csv_bytes(
    client: Client,
    content: bytes,
    competencia: date | None = None,
) -> dict[str, Any]:
    text = _decode_csv(content)
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    if reader.fieldnames is None:
        raise ValueError("CSV sem cabeçalho")
    return _import_table_rows(client, list(reader), competencia)


def import_xlsx_bytes(
    client: Client,
    content: bytes,
    competencia: date | None = None,
    created_by: str | None = None,
) -> dict[str, Any]:
    return _import_table_rows(
        client,
        rows_from_xlsx(content),
        competencia,
        created_by=created_by,
    )


def _import_table_rows(
    client: Client,
    rows: list[dict[str, str]],
    competencia: date | None = None,
    created_by: str | None = None,
) -> dict[str, Any]:
    fieldnames: list[str] = []
    seen_headers: set[str] = set()
    for row in rows:
        for key in row:
            if key not in seen_headers:
                seen_headers.add(key)
                fieldnames.append(key)
    if not fieldnames:
        raise ValueError("Planilha sem cabeçalho")

    field_map = {h: h for h in fieldnames}

    def get(row: dict[str, str], *candidates: str) -> str:
        for key in candidates:
            for actual in field_map:
                if actual.lower().replace("ã", "a").replace("ç", "c") == key.lower().replace(
                    "ã", "a"
                ).replace("ç", "c"):
                    return (row.get(actual) or "").strip()
            if key in row:
                return (row.get(key) or "").strip()
        # fuzzy contains
        for actual, value in row.items():
            for key in candidates:
                if key.lower()[:5] in (actual or "").lower():
                    return (value or "").strip()
        return ""

    empresas_rows: dict[str, dict[str, Any]] = {}
    atividades_rows: dict[str, dict[str, Any]] = {}
    responsaveis_rows: dict[str, dict[str, Any]] = {}
    obrigacao_specs: list[dict[str, Any]] = []
    tarefa_specs: list[dict[str, Any]] = []

    default_comp = competencia or COMPETENCIA_DEFAULT

    for row in rows:
        tipo = _parse_tipo(get(row, "Tipo"))
        cnpj = get(row, "CNPJ")
        razao = get(row, "Razão Social", "Razao Social")
        bu = get(row, "BU") or "N/A"
        apuracao = parse_bool_pt(get(row, "Apuração", "Apuracao") or "VERDADEIRO")
        atividade_raw = get(row, "Atividade")
        titulo = get(row, "Título", "Titulo") or atividade_raw
        responsavel = get(row, "Responsável", "Responsavel")
        email = get(row, "E-mail responsável", "Email responsavel", "E-mail")
        solicitante = get(row, "Solicitante")
        descricao = get(row, "Descrição", "Descricao")
        categoria = _parse_categoria(get(row, "Categoria"))
        recorrencia = get(row, "Recorrência", "Recorrencia") or "mensal"
        dia_legal = _parse_day(get(row, "Dia prazo legal")) or 20
        dia_fiscal = _parse_day(get(row, "Dia prazo fiscal")) or 15
        comp = _parse_iso_date(get(row, "Competência", "Competencia")) or default_comp
        prazo_legal = _parse_iso_date(get(row, "Prazo legal"))
        prazo_fiscal = _parse_iso_date(get(row, "Prazo fiscal"))
        hora_inicio = _parse_time(get(row, "Hora início", "Hora inicio"))
        hora_fim = _parse_time(get(row, "Hora fim"))
        data_entrega = _parse_iso_date(get(row, "Data entrega"))
        recibo_numero = get(row, "Número recibo", "Numero recibo")
        observacao = get(row, "Observação", "Observacao")
        motivo_atraso = get(row, "Motivo atraso")
        status_value = _parse_status(get(row, "Status"))

        if tipo == "tarefa":
            prazo = prazo_fiscal or prazo_legal
            if not titulo or not responsavel or not solicitante or not prazo:
                continue
            if not hora_inicio or not hora_fim or hora_fim <= hora_inicio:
                continue
            if cnpj:
                empresas_rows[cnpj] = {
                    "cnpj": cnpj,
                    "razao_social": razao or cnpj,
                    "bu": bu,
                    "ativa": True,
                }
            row_resp = {"nome": responsavel, "ativo": True}
            if email:
                row_resp["email"] = email
            responsaveis_rows[responsavel] = row_resp
            tarefa_specs.append(
                {
                    "cnpj": cnpj or None,
                    "titulo": titulo[:200],
                    "solicitante": solicitante[:120],
                    "descricao": descricao or None,
                    "categoria": categoria or "fechamento",
                    "responsavel": responsavel,
                    "competencia": comp.isoformat(),
                    "prazo": prazo.isoformat(),
                    "hora_inicio": hora_inicio,
                    "hora_fim": hora_fim,
                    "status": status_value,
                    "motivo_atraso": motivo_atraso[:2000] if motivo_atraso else None,
                    "entregue": status_value == "ENTREGUE",
                }
            )
            continue

        if not cnpj or not atividade_raw:
            continue

        nome_atividade, _comp_from_name = normalize_atividade_nome(atividade_raw)

        empresas_rows[cnpj] = {
            "cnpj": cnpj,
            "razao_social": razao or cnpj,
            "bu": bu,
            "ativa": True,
        }
        atividades_rows[nome_atividade] = {
            "nome": nome_atividade,
            "requer_apuracao": apuracao,
            "recorrencia": recorrencia,
            "ativa": True,
            "dia_prazo_legal": dia_legal,
            "dia_prazo_fiscal": dia_fiscal,
        }
        if responsavel:
            row_resp = {"nome": responsavel, "ativo": True}
            if email:
                row_resp["email"] = email
            responsaveis_rows[responsavel] = row_resp

        obrigacao_specs.append(
            {
                "cnpj": cnpj,
                "atividade": nome_atividade,
                "responsavel": responsavel or None,
                "competencia": comp.isoformat(),
                "prazo_legal": prazo_legal.isoformat() if prazo_legal else None,
                "prazo_fiscal": prazo_fiscal.isoformat() if prazo_fiscal else None,
                "status": status_value,
                "categoria": categoria,
                "data_entrega": data_entrega.isoformat() if data_entrega else None,
                "recibo_numero": recibo_numero or None,
                "observacao": observacao or None,
                "motivo_atraso": motivo_atraso[:2000] if motivo_atraso else None,
            }
        )

    empresa_ids = _upsert_map(client, "empresas", "cnpj", list(empresas_rows.values()))
    atividade_ids = _upsert_map(
        client, "atividades_modelo", "nome", list(atividades_rows.values())
    )
    responsavel_ids = _upsert_map(
        client, "responsaveis", "nome", list(responsaveis_rows.values())
    )

    # load atividade prazo days
    atividades_db = {
        a["id"]: a
        for a in (client.table("atividades_modelo").select("*").execute().data or [])
    }

    payload: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for spec in obrigacao_specs:
        empresa_id = empresa_ids[spec["cnpj"]]
        atividade_id = atividade_ids[spec["atividade"]]
        key = (empresa_id, atividade_id, spec["competencia"])
        if key in seen:
            continue
        seen.add(key)
        atividade = atividades_db.get(atividade_id, {})
        comp_date = date.fromisoformat(spec["competencia"])
        prazo_legal = spec.get("prazo_legal")
        prazo_fiscal = spec.get("prazo_fiscal")
        if not prazo_legal and atividade.get("dia_prazo_legal"):
            computed = compute_prazo(comp_date, atividade.get("dia_prazo_legal"))
            prazo_legal = computed.isoformat() if computed else None
        if not prazo_fiscal and atividade.get("dia_prazo_fiscal"):
            computed = compute_prazo(comp_date, atividade.get("dia_prazo_fiscal"))
            prazo_fiscal = computed.isoformat() if computed else None
        item: dict[str, Any] = {
            "empresa_id": empresa_id,
            "atividade_id": atividade_id,
            "responsavel_id": responsavel_ids.get(spec["responsavel"])
            if spec["responsavel"]
            else None,
            "competencia": spec["competencia"],
            "prazo_legal": prazo_legal,
            "prazo_fiscal": prazo_fiscal,
            "status": spec.get("status") or "PENDENTE",
        }
        if spec.get("categoria"):
            item["categoria"] = spec["categoria"]
        if spec.get("data_entrega"):
            item["data_entrega"] = spec["data_entrega"]
        if spec.get("recibo_numero"):
            item["recibo_numero"] = spec["recibo_numero"]
        if spec.get("observacao"):
            item["observacao"] = spec["observacao"]
        if spec.get("motivo_atraso"):
            item["motivo_atraso"] = spec["motivo_atraso"]
        payload.append(item)

    created = 0
    if payload:
        # upsert in chunks
        chunk_size = 100
        for i in range(0, len(payload), chunk_size):
            chunk = payload[i : i + chunk_size]
            client.table("obrigacoes").upsert(
                chunk,
                on_conflict="empresa_id,atividade_id,competencia",
            ).execute()
            created += len(chunk)

    tarefas_created = _insert_tarefas(
        client,
        tarefa_specs,
        empresa_ids,
        responsavel_ids,
        created_by=created_by,
    )

    return {
        "empresas": len(empresa_ids),
        "atividades": len(atividade_ids),
        "responsaveis": len(responsavel_ids),
        "obrigacoes": created,
        "tarefas": tarefas_created,
        "competencia": default_comp,
    }


def _insert_tarefas(
    client: Client,
    specs: list[dict[str, Any]],
    empresa_ids: dict[str, str],
    responsavel_ids: dict[str, str],
    created_by: str | None = None,
) -> int:
    if not specs:
        return 0

    existing_rows = (
        client.table("tarefas")
        .select("titulo,responsavel_id,prazo,hora_inicio,empresa_id")
        .execute()
        .data
        or []
    )
    existing = {
        (
            item.get("titulo"),
            str(item.get("responsavel_id")),
            str(item.get("prazo")),
            str(item.get("hora_inicio")),
            str(item.get("empresa_id") or ""),
        )
        for item in existing_rows
    }

    payload: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str, str]] = set()
    for spec in specs:
        responsavel_id = responsavel_ids.get(spec["responsavel"])
        if not responsavel_id:
            continue
        empresa_id = empresa_ids.get(spec["cnpj"]) if spec.get("cnpj") else None
        key = (
            spec["titulo"],
            str(responsavel_id),
            spec["prazo"],
            spec["hora_inicio"],
            str(empresa_id or ""),
        )
        if key in seen or key in existing:
            continue
        seen.add(key)
        item = {
            "titulo": spec["titulo"],
            "solicitante_nome": spec["solicitante"],
            "descricao": spec.get("descricao"),
            "categoria": spec.get("categoria") or "fechamento",
            "status": spec.get("status") or "PENDENTE",
            "competencia": spec.get("competencia"),
            "prazo": spec["prazo"],
            "hora_inicio": spec["hora_inicio"],
            "hora_fim": spec["hora_fim"],
            "empresa_id": empresa_id,
            "responsavel_id": responsavel_id,
            "motivo_atraso": spec.get("motivo_atraso"),
            "created_by": created_by,
        }
        if spec.get("entregue"):
            item["entregue_em"] = datetime.now(timezone.utc).isoformat()
        payload.append(item)

    created = 0
    chunk_size = 100
    for i in range(0, len(payload), chunk_size):
        chunk = payload[i : i + chunk_size]
        client.table("tarefas").insert(chunk).execute()
        created += len(chunk)
    return created

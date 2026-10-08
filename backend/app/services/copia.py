from __future__ import annotations

import re
from typing import Any

from supabase import Client

MESMA_EMPRESA = "Mesma empresa da origem"
EMPRESA_INEXISTENTE = "Empresa não encontrada ou inativa"


def trocar_nome_empresa(
    titulo: str,
    origem: dict[str, Any] | None,
    destino: dict[str, Any],
) -> str:
    """Troca no título o nome da empresa de origem pelo da empresa de destino."""
    if not origem:
        return titulo
    pares = [(c, (origem.get(c) or "").strip()) for c in ("razao_social", "nome_fantasia")]
    # O nome mais longo primeiro: "BRK Tecnologia Ltda" antes de "BRK".
    for campo, nome in sorted(pares, key=lambda p: -len(p[1])):
        if not nome:
            continue
        novo = (destino.get(campo) or destino.get("razao_social") or "").strip()
        if not novo:
            continue
        trocado, n = re.subn(re.escape(nome), novo, titulo, flags=re.IGNORECASE)
        if n:
            return trocado
    return titulo


def carregar_destinos(
    client: Client,
    empresa_ids: list[str],
    origem_empresa_id: str | None,
) -> tuple[dict[str, dict[str, Any]], list[dict[str, str]]]:
    """Empresas de destino válidas (ativas, sem repetir, sem a origem) e as ignoradas."""
    ids = list(dict.fromkeys(empresa_ids))
    ignoradas: list[dict[str, str]] = []
    if origem_empresa_id in ids:
        ids.remove(origem_empresa_id)
        ignoradas.append({"empresa_id": origem_empresa_id, "motivo": MESMA_EMPRESA})
    if not ids:
        return {}, ignoradas
    rows = (
        client.table("empresas")
        .select("id, razao_social, nome_fantasia, ativa")
        .in_("id", ids)
        .execute()
        .data
        or []
    )
    validas = {str(r["id"]): r for r in rows if r.get("ativa", True)}
    for eid in ids:
        if eid not in validas:
            ignoradas.append({"empresa_id": eid, "motivo": EMPRESA_INEXISTENTE})
    return {eid: validas[eid] for eid in ids if eid in validas}, ignoradas

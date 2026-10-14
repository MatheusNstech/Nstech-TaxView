"""Carga das CNDs de uma pasta para o bucket certidoes.

O grupo (matriz + filiais) é identificado pela raiz do CNPJ escrito dentro do PDF e a
certidão fica na matriz que a tela de Empresas mostra. Sem --aplicar só mostra o que faria.

Uso:
  cd backend
  .\\.venv\\Scripts\\python.exe -m scripts.importar_certidoes "<pasta>" [--aplicar]
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.services import certidoes  # noqa: E402
from app.services.db import fetch_all  # noqa: E402
from app.services.empresas_painel import cnpj_raiz, ordenar_grupo  # noqa: E402
from app.services.pdf_texto import is_pdf, so_digitos, texto_do_pdf  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pasta", type=Path)
    parser.add_argument("--esfera", choices=["federal"], default="federal")
    parser.add_argument("--aplicar", action="store_true", help="grava no Supabase")
    args = parser.parse_args()

    client = get_admin_client()
    ativas = fetch_all(
        lambda: client.table("empresas").select("id,cnpj,razao_social").eq("ativa", True).order("id")
    )
    grupos: dict[str, list[dict]] = {}
    for e in ativas:
        grupos.setdefault(cnpj_raiz(e), []).append(e)
    matriz_por_raiz = {raiz: ordenar_grupo(m)[0] for raiz, m in grupos.items() if not raiz.startswith("id:")}

    escolhidas: dict[str, tuple[Path, dict, bytes]] = {}
    sem_empresa: list[tuple[Path, str | None]] = []
    ignoradas: list[tuple[Path, Path]] = []
    for pdf in sorted(args.pasta.glob("*.pdf")):
        content = pdf.read_bytes()
        dados = certidoes.ler_cnd_federal(texto_do_pdf(content)) if is_pdf(content) else {"cnpj": None}
        matriz = matriz_por_raiz.get(so_digitos(dados["cnpj"])[:8])
        if not matriz:
            sem_empresa.append((pdf, dados["cnpj"]))
            continue
        atual = escolhidas.get(matriz["id"])
        if atual and (atual[1]["emitida_em"] or date.min) >= (dados["emitida_em"] or date.min):
            ignoradas.append((pdf, atual[0]))
            continue
        if atual:
            ignoradas.append((atual[0], pdf))
        escolhidas[matriz["id"]] = (pdf, dados, content)

    por_id = {e["id"]: e for e in ativas}
    print(f"{len(escolhidas)} CNDs casadas com grupos:")
    for empresa_id, (pdf, dados, _) in sorted(escolhidas.items(), key=lambda kv: por_id[kv[0]]["razao_social"]):
        e = por_id[empresa_id]
        print(
            f"  {pdf.name[:40]:<41} -> {e['cnpj']}  {e['razao_social'][:40]:<41}"
            f" {dados['situacao']}  emitida {dados['emitida_em']}  válida até {dados['valida_ate']}"
        )
    if ignoradas:
        print("\nMais de uma CND para o mesmo grupo (fica a de emissão mais recente):")
        for velha, nova in ignoradas:
            print(f"  ignora {velha.name}, usa {nova.name}")
    if sem_empresa:
        print("\nArquivos sem empresa cadastrada:")
        for pdf, lido in sem_empresa:
            print(f"  {pdf.name} (CNPJ lido: {lido or 'nenhum'})")
    faltando = [m for m in matriz_por_raiz.values() if m["id"] not in escolhidas]
    if faltando:
        print("\nGrupos sem CND na pasta:")
        for m in sorted(faltando, key=lambda m: m["razao_social"]):
            print(f"  {m['cnpj']}  {m['razao_social']}")

    if not args.aplicar:
        print("\nSimulação: nada foi gravado. Rode com --aplicar para enviar.")
        return 0

    bucket = client.storage.from_(certidoes.BUCKET)
    agora = datetime.now(UTC).isoformat()
    for empresa_id, (_, dados, content) in escolhidas.items():
        path = certidoes.storage_path(empresa_id, args.esfera)
        bucket.upload(path, content, {"content-type": "application/pdf", "upsert": "true"})
        client.table("empresa_certidoes").upsert(
            {
                "empresa_id": empresa_id,
                "esfera": args.esfera,
                "path": path,
                "situacao": dados["situacao"],
                "emitida_em": dados["emitida_em"].isoformat() if dados["emitida_em"] else None,
                "valida_ate": dados["valida_ate"].isoformat() if dados["valida_ate"] else None,
                "codigo_controle": dados["codigo_controle"],
                "atualizado_em": agora,
            },
            on_conflict="empresa_id,esfera",
        ).execute()
    print(f"\n{len(escolhidas)} CNDs enviadas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Cria/atualiza logins de teste que enxergam o sistema como cada pessoa.

Os logins de responsável são visualizadores (somente leitura) com
view_as_responsavel_id apontando para o responsável real. O do Danilo copia
a flag painel_fiscal_editor, que é o que define a visão dele.

Uso:
  cd backend
  $env:TESTE_PASSWORD = "..."   # opcional, default Teste@2026
  .\\.venv\\Scripts\\python.exe -m scripts.ensure_logins_teste
  .\\.venv\\Scripts\\python.exe -m scripts.ensure_logins_teste --remover
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402

LOGINS = [
    {"email": "teste.solange@nstech.com.br", "nome": "Teste · Solange", "responsavel": "Solange"},
    {"email": "teste.viviane@nstech.com.br", "nome": "Teste · Viviane", "responsavel": "Viviane"},
    {"email": "teste.flavia@nstech.com.br", "nome": "Teste · Flávia", "responsavel": "Flávia"},
    {
        "email": "teste.danilo@nstech.com.br",
        "nome": "Teste · Danilo",
        "copiar_de": "danilo.bianchin@nstech.com.br",
    },
]


def _app_meta(admin, login: dict, users_by_email: dict) -> dict:
    if "responsavel" in login:
        rows = (
            admin.table("responsaveis")
            .select("id")
            .eq("nome", login["responsavel"])
            .eq("ativo", True)
            .execute()
            .data
            or []
        )
        if len(rows) != 1:
            raise RuntimeError(f"Responsável {login['responsavel']!r} não encontrado (ou duplicado)")
        return {
            "role": "user",
            "is_viewer": True,
            "view_as_responsavel_id": rows[0]["id"],
            "must_change_password": False,
        }

    origem = users_by_email.get(login["copiar_de"])
    if origem is None:
        raise RuntimeError(f"Usuário {login['copiar_de']} não encontrado")
    meta = dict(getattr(origem, "app_metadata", None) or {})
    return {
        "role": meta.get("role", "user"),
        "painel_fiscal_editor": bool(meta.get("painel_fiscal_editor")),
        "is_viewer": bool(meta.get("is_viewer")),
        "view_as_responsavel_id": meta.get("view_as_responsavel_id"),
        "must_change_password": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--remover", action="store_true", help="apaga os logins de teste")
    args = parser.parse_args()

    settings = get_settings()
    if not settings.supabase_service_role_key or settings.supabase_service_role_key.startswith(
        "your-"
    ):
        print("Configure SUPABASE_SERVICE_ROLE_KEY em backend/.env")
        return 1

    password = os.environ.get("TESTE_PASSWORD", "Teste@2026").strip()
    if len(password) < 8:
        print("TESTE_PASSWORD precisa ter ao menos 8 caracteres")
        return 1

    admin = get_admin_client(settings)
    response = admin.auth.admin.list_users(per_page=1000)
    users = response if isinstance(response, list) else getattr(response, "users", None) or []
    users_by_email = {(u.email or "").lower(): u for u in users}

    for login in LOGINS:
        email = login["email"]
        existing = users_by_email.get(email)

        if args.remover:
            if existing:
                admin.auth.admin.delete_user(existing.id)
                print(f"Removido {email}")
            continue

        meta = _app_meta(admin, login, users_by_email)
        if existing is None:
            created = admin.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"nome": login["nome"]},
                    "app_metadata": meta,
                }
            )
            print(f"Criado {email} id={getattr(created.user, 'id', None)} {meta}")
        else:
            admin.auth.admin.update_user_by_id(
                existing.id,
                {
                    "password": password,
                    "user_metadata": {"nome": login["nome"]},
                    "app_metadata": meta,
                    "ban_duration": "none",
                },
            )
            print(f"Atualizado {email} id={existing.id} {meta}")

    if not args.remover:
        print(f"Senha: {password}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

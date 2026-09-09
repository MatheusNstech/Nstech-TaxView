"""Garante usuário Danilo com permissão de editar o painel RFB/PGFN.

Cria ou atualiza:
  e-mail: danilo.bianchin@nstech.com.br
  senha:  variável DANILO_PASSWORD (default Senha@123)
  role:   user
  flag:   painel_fiscal_editor=true
  must_change_password: true

Uso:
  cd backend
  ..\\.venv\\Scripts\\python.exe -m scripts.ensure_danilo_painel_fiscal
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402

EMAIL = "danilo.bianchin@nstech.com.br"
NOME = "Danilo Bianchin"


def main() -> int:
    settings = get_settings()
    if not settings.supabase_service_role_key or settings.supabase_service_role_key.startswith(
        "your-"
    ):
        print("Configure SUPABASE_SERVICE_ROLE_KEY")
        return 1

    password = os.environ.get("DANILO_PASSWORD", "Senha@123").strip()
    if len(password) < 8:
        print("DANILO_PASSWORD precisa ter ao menos 8 caracteres")
        return 1

    admin = get_admin_client(settings)
    email = EMAIL.strip().lower()
    response = admin.auth.admin.list_users()
    users = getattr(response, "users", None) or []
    target = next((u for u in users if (u.email or "").lower() == email), None)

    app_meta = {
        "role": "user",
        "painel_fiscal_editor": True,
        "must_change_password": True,
    }
    user_meta = {"nome": NOME, "must_change_password": True}

    if target is None:
        created = admin.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "app_metadata": app_meta,
                "user_metadata": user_meta,
            }
        )
        print(f"Criado {email} id={getattr(created.user, 'id', None)}")
    else:
        admin.auth.admin.update_user_by_id(
            target.id,
            {
                "password": password,
                "app_metadata": {
                    **dict(getattr(target, "app_metadata", None) or {}),
                    **app_meta,
                },
                "user_metadata": {
                    **dict(getattr(target, "user_metadata", None) or {}),
                    **user_meta,
                },
            },
        )
        print(f"Atualizado {email} id={target.id}")
    print("Login inicial: Senha@123 (troca obrigatória) — ou DANILO_PASSWORD se definida")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

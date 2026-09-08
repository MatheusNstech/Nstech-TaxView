"""Garante usuário de teste com papel diretor (dev only).

Cria ou atualiza:
  e-mail: diretor@nstech.com.br
  senha:  variável de ambiente DIRETOR_PASSWORD
  role:   diretor (org-wide, somente leitura)

Uso:
  cd backend
  $env:DIRETOR_PASSWORD = "..."
  python -m scripts.ensure_diretor

Requer SUPABASE_SERVICE_ROLE_KEY em backend/.env
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402

DIRETOR_EMAIL = "diretor@nstech.com.br"
DIRETOR_NOME = "Diretor Teste"


def main() -> int:
    settings = get_settings()
    if not settings.supabase_service_role_key or settings.supabase_service_role_key.startswith(
        "your-"
    ):
        print("Configure SUPABASE_SERVICE_ROLE_KEY em backend/.env")
        return 1

    password = os.environ.get("DIRETOR_PASSWORD", "").strip()
    if len(password) < 8:
        print("Defina DIRETOR_PASSWORD (mínimo 8 caracteres)")
        return 1

    admin = get_admin_client(settings)
    email = DIRETOR_EMAIL.strip().lower()

    response = admin.auth.admin.list_users()
    users = getattr(response, "users", None) or []
    target = next((u for u in users if (u.email or "").lower() == email), None)

    meta = {
        "role": "diretor",
        "must_change_password": False,
    }

    if target is None:
        try:
            created = admin.auth.admin.create_user(
                {
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"nome": DIRETOR_NOME},
                    "app_metadata": meta,
                }
            )
        except Exception as exc:  # noqa: BLE001
            print(f"Falha ao criar diretor: {exc}")
            return 1
        user = created.user
        if user is None:
            print("Usuário não retornado pela Auth API")
            return 1
        print(f"OK: criado {email} (id={user.id}) role=diretor")
    else:
        try:
            admin.auth.admin.update_user_by_id(
                target.id,
                {
                    "password": password,
                    "app_metadata": meta,
                    "ban_duration": "none",
                },
            )
        except Exception as exc:  # noqa: BLE001
            print(f"Falha ao atualizar diretor: {exc}")
            return 1
        print(f"OK: atualizado {email} (id={target.id}) role=diretor")

    print(f"Login: {DIRETOR_EMAIL} (senha via DIRETOR_PASSWORD)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

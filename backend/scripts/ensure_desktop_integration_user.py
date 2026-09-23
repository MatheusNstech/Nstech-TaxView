"""Cria/atualiza usuário de integração do app desktop (role admin ou diretor).

Uso:
  cd backend
  $env:DESKTOP_EMAIL="desktop@nstech.com.br"
  $env:DESKTOP_PASSWORD="SenhaForte@123"
  $env:DESKTOP_ROLE="diretor"   # admin | diretor
  ..\\.venv\\Scripts\\python.exe -m scripts.ensure_desktop_integration_user
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402


def main() -> int:
    settings = get_settings()
    if not settings.supabase_service_role_key or settings.supabase_service_role_key.startswith(
        "your-"
    ):
        print("Configure SUPABASE_SERVICE_ROLE_KEY")
        return 1

    email = (os.environ.get("DESKTOP_EMAIL") or "").strip().lower()
    password = (os.environ.get("DESKTOP_PASSWORD") or "").strip()
    role = (os.environ.get("DESKTOP_ROLE") or "diretor").strip().lower()
    if role not in {"admin", "diretor"}:
        print("DESKTOP_ROLE deve ser admin ou diretor")
        return 1
    if not email or "@" not in email:
        print("Defina DESKTOP_EMAIL")
        return 1
    if len(password) < 8:
        print("Defina DESKTOP_PASSWORD com pelo menos 8 caracteres")
        return 1

    admin = get_admin_client(settings)
    existing = None
    page = 1
    while page <= 20:
        try:
            resp = admin.auth.admin.list_users(page=page, per_page=200)
        except TypeError:
            resp = admin.auth.admin.list_users()
            users = getattr(resp, "users", None) or (resp if isinstance(resp, list) else [])
            existing = next(
                (u for u in users if (getattr(u, "email", None) or "").lower() == email),
                None,
            )
            break
        users = getattr(resp, "users", None) or []
        existing = next(
            (u for u in users if (getattr(u, "email", None) or "").lower() == email),
            None,
        )
        if existing or len(users) < 200:
            break
        page += 1

    app_meta = {"role": role, "must_change_password": False}
    if existing is None:
        created = admin.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "app_metadata": app_meta,
                "user_metadata": {"nome": "Integração Desktop"},
            }
        )
        user = getattr(created, "user", created)
        print(f"Usuário criado id={getattr(user, 'id', None)} email={email} role={role}")
    else:
        uid = str(existing.id)
        meta = dict(getattr(existing, "app_metadata", None) or {})
        meta.update(app_meta)
        admin.auth.admin.update_user_by_id(
            uid,
            {
                "password": password,
                "app_metadata": meta,
                "user_metadata": {"nome": "Integração Desktop"},
            },
        )
        print(f"Usuário atualizado id={uid} email={email} role={role}")

    print("Login desktop:")
    print("  POST /api/auth/token  {\"email\":\"...\",\"password\":\"...\"}")
    print("  POST /api/valores     Authorization: Bearer <access_token>")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

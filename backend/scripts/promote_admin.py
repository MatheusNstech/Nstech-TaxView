"""Promove um usuário a admin via service role.

Uso:
  python -m scripts.promote_admin matheus.silva-oliveira@nstech.com.br
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402


def main() -> int:
    email = (sys.argv[1] if len(sys.argv) > 1 else "").strip().lower()
    if not email:
        print("Informe o e-mail: python -m scripts.promote_admin email@empresa.com")
        return 1

    settings = get_settings()
    if not settings.supabase_service_role_key or settings.supabase_service_role_key.startswith(
        "your-"
    ):
        print("Configure SUPABASE_SERVICE_ROLE_KEY em backend/.env")
        return 1

    admin = get_admin_client(settings)
    response = admin.auth.admin.list_users()
    users = getattr(response, "users", None) or []
    target = next((u for u in users if (u.email or "").lower() == email), None)
    if target is None:
        print(f"Usuário não encontrado: {email}")
        return 1

    admin.auth.admin.update_user_by_id(target.id, {"app_metadata": {"role": "admin"}})
    print(f"OK: {email} promovido a admin")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

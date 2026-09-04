"""Rotate team passwords (requires SUPABASE_SERVICE_ROLE_KEY).

Usage (cwd = backend/):
  ..\\.venv\\Scripts\\python.exe scripts/rotate_default_passwords.py

Prints one-time temp passwords to stdout only — do not commit the output.
"""

from __future__ import annotations

import os
import secrets
import string
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402

ALPHABET = string.ascii_letters + string.digits + "!@#$%&*"


def temp_password(length: int = 16) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def main() -> None:
    get_settings.cache_clear()
    settings = get_settings()
    key = settings.supabase_service_role_key
    if not key or key.startswith("your-"):
        print("ERROR: set SUPABASE_SERVICE_ROLE_KEY in backend/.env", file=sys.stderr)
        sys.exit(1)

    admin = get_admin_client(settings)
    response = admin.auth.admin.list_users()
    users = getattr(response, "users", None) or []
    print("email\ttemp_password\tnote")
    for user in users:
        email = getattr(user, "email", None) or ""
        meta = getattr(user, "app_metadata", None) or {}
        if isinstance(meta, dict) and meta.get("role") == "admin":
            print(f"{email}\t(skipped)\tadmin")
            continue
        pwd = temp_password()
        admin.auth.admin.update_user_by_id(
            str(user.id),
            {
                "password": pwd,
                "app_metadata": {"must_change_password": True},
                "user_metadata": {"must_change_password": False},
            },
        )
        print(f"{email}\t{pwd}\tmust change on next login")


if __name__ == "__main__":
    main()

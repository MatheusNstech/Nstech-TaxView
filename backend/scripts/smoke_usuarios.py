"""Smoke: admin cria user; user nao acessa /api/usuarios."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

sys.path.insert(0, str(ROOT))
from app.core.config import get_settings  # noqa: E402

API = "http://127.0.0.1:8000"
ADMIN_EMAIL = "matheus.oliveira@nstech.com.br"
ADMIN_PASSWORD = "Senha@123"
SMOKE_EMAIL = f"smoke.user.{int(time.time())}@nstech.com.br"
SMOKE_PASSWORD = "Senha@123"


def login(email: str, password: str) -> tuple[str, str]:
    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    result = client.auth.sign_in_with_password({"email": email, "password": password})
    if not result.session:
        raise RuntimeError(f"Login falhou: {email}")
    role = (result.user.app_metadata or {}).get("role") if result.user else None
    return result.session.access_token, str(role or "user")


def main() -> None:
    admin_token, admin_role = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert admin_role == "admin", f"Admin esperado, veio role={admin_role!r} (faça logout/login)"

    with httpx.Client(base_url=API, timeout=30.0) as http:
        health = http.get("/api/health")
        assert health.status_code == 200, health.text

        created = http.post(
            "/api/usuarios",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "email": SMOKE_EMAIL,
                "password": SMOKE_PASSWORD,
                "nome": "Smoke User",
                "role": "user",
            },
        )
        assert created.status_code == 201, f"create failed: {created.status_code} {created.text}"
        body = created.json()
        assert body["email"] == SMOKE_EMAIL
        assert body["role"] == "user"
        print("OK create", body["id"])

        listed = http.get(
            "/api/usuarios",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert listed.status_code == 200, listed.text
        emails = {u["email"] for u in listed.json()}
        assert SMOKE_EMAIL in emails
        print("OK list", len(emails), "users")

        user_token, user_role = login(SMOKE_EMAIL, SMOKE_PASSWORD)
        assert user_role == "user", user_role

        denied = http.get(
            "/api/usuarios",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert denied.status_code == 403, f"expected 403, got {denied.status_code} {denied.text}"
        print("OK user denied /api/usuarios")

        me = http.get(
            "/api/usuarios/me",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert me.status_code == 200, me.text
        assert me.json()["role"] == "user"
        print("OK user /me")

    print("SMOKE PASSED")


if __name__ == "__main__":
    main()

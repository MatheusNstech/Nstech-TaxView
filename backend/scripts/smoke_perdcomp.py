"""Smoke HTTP do acompanhamento PER/DCOMP contra a API local, com tokens reais.

Gera sessão via magic link (admin API, sem enviar e-mail) para contas de smoke:
  - diretor: lê summary/lista, PATCH → 403
  - admin: CRUD completo (cria e remove um processo temporário)
  - user comum: GET → 403

Uso:
  cd backend
  ..\\.venv\\Scripts\\python.exe -m scripts.smoke_perdcomp [http://127.0.0.1:8003]
"""

from __future__ import annotations

import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from supabase import create_client  # noqa: E402

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402

DIRETOR = "desktop-smoke@nstech.com.br"
ADMIN = "admin@nstech.com.br"
USER_COMUM = "smoke.user.1787855954@nstech.com.br"
TEMP_PERDCOMP = "SMOKE-PERDCOMP-0000"


def _fail(msg: str) -> None:
    print(f"SMOKE_FAIL: {msg}")
    raise SystemExit(1)


def _token(email: str) -> str:
    settings = get_settings()
    link = get_admin_client(settings).auth.admin.generate_link(
        {"type": "magiclink", "email": email}
    )
    otp = link.properties.email_otp
    anon = create_client(settings.supabase_url, settings.supabase_anon_key)
    session = anon.auth.verify_otp({"email": email, "token": otp, "type": "email"}).session
    if session is None:
        _fail(f"sem sessão para {email}")
    return session.access_token


def _expect(resp: httpx.Response, code: int, label: str) -> None:
    if resp.status_code != code:
        _fail(f"{label}: esperado {code}, veio {resp.status_code} {resp.text[:200]}")
    print(f"ok: {label} -> {code}")


def main() -> None:
    base = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8003").rstrip("/")

    with httpx.Client(base_url=base, timeout=30) as http:
        h_dir = {"Authorization": f"Bearer {_token(DIRETOR)}"}
        r = http.get("/api/perdcomp/summary", headers=h_dir)
        _expect(r, 200, "diretor GET /summary")
        s = r.json()
        print(
            f"   total={s['total_processos']} valor={s['valor_total']:.2f} "
            f"indeferido={s['valor_indeferido']:.2f} prazos={s['prazos']}"
        )
        r = http.get("/api/perdcomp", headers=h_dir)
        _expect(r, 200, "diretor GET lista")
        rows = r.json()
        if not rows:
            _fail("lista vazia")
        alvo = rows[0]
        _expect(
            http.patch(f"/api/perdcomp/{alvo['id']}", json={"observacoes": "x"}, headers=h_dir),
            403,
            "diretor PATCH",
        )
        _expect(
            http.post("/api/perdcomp", json={"perdcomp": TEMP_PERDCOMP}, headers=h_dir),
            403,
            "diretor POST",
        )

        h_adm = {"Authorization": f"Bearer {_token(ADMIN)}"}
        _expect(
            http.patch(
                f"/api/perdcomp/{alvo['id']}",
                json={"observacoes": alvo.get("observacoes") or ""},
                headers=h_adm,
            ),
            200,
            "admin PATCH (no-op)",
        )
        r = http.post(
            "/api/perdcomp",
            json={"perdcomp": TEMP_PERDCOMP, "empresa": "SMOKE", "valor_pedido": 1},
            headers=h_adm,
        )
        _expect(r, 201, "admin POST temporário")
        temp_id = r.json()["id"]
        _expect(http.delete(f"/api/perdcomp/{temp_id}", headers=h_adm), 204, "admin DELETE temporário")

        h_usr = {"Authorization": f"Bearer {_token(USER_COMUM)}"}
        _expect(http.get("/api/perdcomp/summary", headers=h_usr), 403, "user comum GET /summary")
        _expect(http.get("/api/perdcomp", headers=h_usr), 403, "user comum GET lista")

    print("SMOKE_OK")


if __name__ == "__main__":
    main()

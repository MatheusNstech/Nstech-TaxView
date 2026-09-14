"""Garante responsável Matheus + tarefas do Checkpoint P6.

- Localiza Auth user matheus.silva-oliveira@nstech.com.br
- Mantém role=user (escopo só das próprias tarefas; admin fica em outra conta)
- Upsert em responsaveis com auth_user_id
- Insere/atualiza tarefas do checkpoint (idempotente por titulo + responsavel_id)

Uso:
  cd backend
  ..\\.venv\\Scripts\\python.exe -m scripts.ensure_matheus_tarefas
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.auth import get_admin_client  # noqa: E402
from app.core.config import get_settings  # noqa: E402

EMAIL = "matheus.silva-oliveira@nstech.com.br"
NOME = "Matheus Silva Oliveira"
COMPETENCIA = "2026-08-01"
HORA_INICIO = "09:00"
HORA_FIM = "18:00"
PRAZO_ABERTO = "2026-09-18"

# (titulo, status, prazo, descricao, solicitante)
CHECKPOINT_TAREFAS: list[tuple[str, str, str, str, str]] = [
    (
        "Macro Dashboard",
        "ENTREGUE",
        "2026-09-09",
        "Checkpoint P6 · entregue",
        "Checkpoint P6",
    ),
    (
        "Padronizador KMM",
        "ENTREGUE",
        "2026-09-03",
        "Checkpoint P6 · entregue",
        "Eloiza",
    ),
    (
        "Cruzamento NF × KMM",
        "ENTREGUE",
        "2026-08-28",
        "Checkpoint P6 · entregue",
        "Flavia",
    ),
    (
        "Captura de NFS-e",
        "ENTREGUE",
        "2026-08-28",
        "Checkpoint P6 · entregue",
        "Flavia",
    ),
    (
        "Padronizador de CEP BRK",
        "ENTREGUE",
        "2026-08-26",
        "Checkpoint P6 · entregue",
        "Glaucia",
    ),
    (
        "Padronizador de CEP Buonny",
        "EM_REVISAO",
        PRAZO_ABERTO,
        "Checkpoint P6 · em revisão",
        "Glaucia",
    ),
    (
        "Padronizador de CEP Qualp",
        "PENDENTE",
        PRAZO_ABERTO,
        "Checkpoint P6 · pendente",
        "Glaucia",
    ),
    (
        "Manutenção de Macros VBA IR",
        "ENTREGUE",
        "2026-08-20",
        "Checkpoint P6 · entregue",
        "Solange",
    ),
    (
        "Importação de Balancetes",
        "ENTREGUE",
        "2026-08-28",
        "Checkpoint P6 · entregue",
        "Solange",
    ),
    (
        "Extração Notas Prefeitura de Joinville",
        "ENTREGUE",
        "2026-09-08",
        "Checkpoint P6 · entregue",
        "Solange",
    ),
    (
        "Macro (VBA) extração do Imposto de Renda",
        "ENTREGUE",
        "2026-09-08",
        "Checkpoint P6 · entregue",
        "Solange",
    ),
    (
        "Linha do Tempo Contencioso",
        "PENDENTE",
        "2026-09-30",
        "Checkpoint P6 · pendente",
        "Glaucia",
    ),
    (
        "Adicionar Cruzamento Faturamento com Prefeituras",
        "PENDENTE",
        "2026-09-14",
        "Cruzamento de faturamento com prefeituras · prazo hoje",
        "Flavia",
    ),
]


# Títulos antigos → novo (evita duplicar ao renomear)
TITLE_ALIASES: dict[str, str] = {
    "dashboard de apuração de iss e pis/cofins": (
        "Dashboard Tech · Apuração ISS e PIS/COFINS"
    ),
    "padronização cep brk/buonny": "Padronizador de CEP BRK",
    "manutenção macros vba ir": "Manutenção de Macros VBA IR",
}


def _find_auth_user(admin, email: str):
    email_l = email.strip().lower()
    page = 1
    per_page = 200
    while page <= 20:
        try:
            response = admin.auth.admin.list_users(page=page, per_page=per_page)
        except TypeError:
            response = admin.auth.admin.list_users()
            users = _users_from_list_response(response)
            return next(
                (u for u in users if (getattr(u, "email", None) or "").lower() == email_l),
                None,
            )
        users = _users_from_list_response(response)
        if not users:
            break
        match = next(
            (u for u in users if (getattr(u, "email", None) or "").lower() == email_l),
            None,
        )
        if match is not None:
            return match
        if len(users) < per_page:
            break
        page += 1
    return None


def _users_from_list_response(response) -> list:
    if response is None:
        return []
    if isinstance(response, list):
        return response
    users = getattr(response, "users", None)
    if users is not None:
        return list(users)
    if isinstance(response, dict):
        return list(response.get("users") or [])
    return []


# Id conhecido do Auth user Matheus (list_users às vezes não retorna na 1ª página/API).
_FALLBACK_AUTH_USER_ID = "40a57797-53c7-46c9-ab62-c74fb49423d5"


def _resolve_auth_user(admin, email: str):
    import os

    forced = (os.environ.get("MATHEUS_AUTH_USER_ID") or "").strip() or _FALLBACK_AUTH_USER_ID
    found = _find_auth_user(admin, email)
    if found is not None:
        return found
    got = admin.auth.admin.get_user_by_id(forced)
    user = getattr(got, "user", got)
    if user is None:
        return None
    user_email = (getattr(user, "email", None) or "").lower()
    if user_email and user_email != email.strip().lower():
        print(f"Fallback id={forced} tem e-mail {user_email!r}, esperado {email!r}")
        return None
    return user


def _ensure_responsavel(db, *, auth_user_id: str, email: str, nome: str) -> str:
    by_auth = (
        db.table("responsaveis")
        .select("id, nome, email, auth_user_id, ativo")
        .eq("auth_user_id", auth_user_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if by_auth:
        rid = str(by_auth[0]["id"])
        db.table("responsaveis").update(
            {"nome": nome, "email": email, "ativo": True}
        ).eq("id", rid).execute()
        print(f"Responsável já vinculado id={rid}")
        return rid

    by_email = (
        db.table("responsaveis")
        .select("id, nome, email, auth_user_id, ativo")
        .ilike("email", email)
        .limit(1)
        .execute()
        .data
        or []
    )
    if by_email:
        rid = str(by_email[0]["id"])
        existing_auth = by_email[0].get("auth_user_id")
        if existing_auth and str(existing_auth) != auth_user_id:
            raise RuntimeError(
                f"Responsável {email} já está vinculado a outro auth_user_id={existing_auth}"
            )
        db.table("responsaveis").update(
            {
                "nome": nome,
                "email": email,
                "ativo": True,
                "auth_user_id": auth_user_id,
            }
        ).eq("id", rid).execute()
        print(f"Responsável atualizado e vinculado id={rid}")
        return rid

    created = (
        db.table("responsaveis")
        .insert(
            {
                "nome": nome,
                "email": email,
                "ativo": True,
                "auth_user_id": auth_user_id,
            }
        )
        .execute()
        .data
        or []
    )
    if not created:
        raise RuntimeError("Falha ao criar responsável Matheus")
    rid = str(created[0]["id"])
    print(f"Responsável criado id={rid}")
    return rid


def _ensure_tarefas(db, *, responsavel_id: str, created_by: str) -> tuple[int, int, int]:
    existing = (
        db.table("tarefas")
        .select("id, titulo, status, entregue_em")
        .eq("responsavel_id", responsavel_id)
        .execute()
        .data
        or []
    )
    by_titulo = {str(row["titulo"]).strip().lower(): row for row in existing}

    for old_key, new_title in TITLE_ALIASES.items():
        if old_key in by_titulo and new_title.strip().lower() not in by_titulo:
            row = by_titulo.pop(old_key)
            db.table("tarefas").update({"titulo": new_title}).eq("id", row["id"]).execute()
            row["titulo"] = new_title
            by_titulo[new_title.strip().lower()] = row
            print(f"  rename -> {new_title}")

    created_n = 0
    updated_n = 0
    unchanged_n = 0
    for titulo, status, prazo, descricao, solicitante in CHECKPOINT_TAREFAS:
        key = titulo.strip().lower()
        payload: dict = {
            "titulo": titulo,
            "descricao": descricao,
            "categoria": "outras",
            "status": status,
            "competencia": COMPETENCIA,
            "prazo": prazo,
            "hora_inicio": HORA_INICIO,
            "hora_fim": HORA_FIM,
            "responsavel_id": responsavel_id,
            "solicitante_nome": solicitante,
        }
        if status == "ENTREGUE":
            payload["entregue_em"] = f"{prazo}T18:00:00+00:00"
        else:
            payload["entregue_em"] = None

        if key in by_titulo:
            row = by_titulo[key]
            update_payload = {
                "descricao": descricao,
                "status": status,
                "competencia": COMPETENCIA,
                "prazo": prazo,
                "solicitante_nome": solicitante,
                "entregue_em": payload["entregue_em"],
            }
            db.table("tarefas").update(update_payload).eq("id", row["id"]).execute()
            updated_n += 1
            print(f"  ~ {titulo} ({status}) · {solicitante} · {prazo}")
            continue

        payload["created_by"] = created_by
        result = db.table("tarefas").insert(payload).execute().data or []
        if not result:
            raise RuntimeError(f"Falha ao inserir tarefa: {titulo}")
        created_n += 1
        print(f"  + {titulo} ({status}) · {solicitante} · {prazo}")
    return created_n, updated_n, unchanged_n


def main() -> int:
    settings = get_settings()
    if not settings.supabase_service_role_key or settings.supabase_service_role_key.startswith(
        "your-"
    ):
        print("Configure SUPABASE_SERVICE_ROLE_KEY")
        return 1

    admin = get_admin_client(settings)
    email = EMAIL.strip().lower()
    target = _resolve_auth_user(admin, email)
    if target is None:
        print(f"Usuário Auth não encontrado: {email}")
        print("Dica: defina MATHEUS_AUTH_USER_ID com o uuid do Auth user")
        return 1

    auth_user_id = str(target.id)
    # Escopo: user comum vinculado ao responsável (não admin).
    current_meta = dict(getattr(target, "app_metadata", None) or {})
    if current_meta.get("role") != "user":
        admin.auth.admin.update_user_by_id(
            auth_user_id,
            {"app_metadata": {**current_meta, "role": "user"}},
        )
        print("Role ajustada para user (somente tarefas do responsável)")
    role = "user"
    print(f"Auth user id={auth_user_id} role={role!r}")

    db = admin
    responsavel_id = _ensure_responsavel(
        db, auth_user_id=auth_user_id, email=email, nome=NOME
    )
    created_n, updated_n, _unchanged_n = _ensure_tarefas(
        db, responsavel_id=responsavel_id, created_by=auth_user_id
    )
    print(
        f"Tarefas checkpoint: criadas={created_n} atualizadas={updated_n} "
        f"responsavel_id={responsavel_id}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

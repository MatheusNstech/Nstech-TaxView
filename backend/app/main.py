import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    atividades,
    dashboard,
    empresas,
    importacao,
    me,
    notificacoes,
    obrigacoes,
    responsaveis,
    tarefas,
    usuarios,
)
from app.core.config import get_settings

settings = get_settings()


def _assert_deploy_env() -> None:
    on_vercel = os.getenv("VERCEL") == "1"
    if on_vercel and not settings.is_production:
        raise RuntimeError(
            "APP_ENV=production é obrigatório no deploy (Vercel). "
            "Defina APP_ENV, CORS_ORIGINS e SUPABASE_SERVICE_ROLE_KEY."
        )
    if not settings.is_production:
        return
    if not settings.supabase_service_role_key or settings.supabase_service_role_key.startswith(
        "your-"
    ):
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY é obrigatória em produção")
    local = {"http://localhost:5173", "http://127.0.0.1:5173"}
    origins = set(settings.cors_origin_list)
    if not origins or origins <= local:
        raise RuntimeError("CORS_ORIGINS deve apontar para o domínio do frontend em produção")


_assert_deploy_env()

_docs = None if settings.is_production else "/docs"
_redoc = None if settings.is_production else "/redoc"
_openapi = None if settings.is_production else "/openapi.json"

app = FastAPI(
    title="Nstax Cronograma API",
    description="API do Cronograma Fiscal Inteligente nstech",
    version="1.0.0",
    docs_url=_docs,
    redoc_url=_redoc,
    openapi_url=_openapi,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(me.router, prefix="/api")
app.include_router(empresas.router, prefix="/api")
app.include_router(atividades.router, prefix="/api")
app.include_router(responsaveis.router, prefix="/api")
app.include_router(obrigacoes.router, prefix="/api")
app.include_router(tarefas.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(importacao.router, prefix="/api")
app.include_router(usuarios.router, prefix="/api")
app.include_router(notificacoes.router, prefix="/api")


@app.get("/api/health")
def health():
    payload = {"status": "ok", "service": "Nstax-Cronograma"}
    if not settings.is_production:
        payload["env"] = settings.app_env
    return payload

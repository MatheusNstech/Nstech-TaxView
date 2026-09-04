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
    usuarios,
)
from app.core.config import get_settings

settings = get_settings()

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
app.include_router(dashboard.router, prefix="/api")
app.include_router(importacao.router, prefix="/api")
app.include_router(usuarios.router, prefix="/api")
app.include_router(notificacoes.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Nstax-Cronograma", "env": settings.app_env}

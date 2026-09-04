from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StatusObrigacao(str, Enum):
    PENDENTE = "PENDENTE"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    EM_REVISAO = "EM_REVISAO"
    ENTREGUE = "ENTREGUE"
    ATRASADO = "ATRASADO"


class EmpresaBase(BaseModel):
    cnpj: str
    razao_social: str
    bu: str
    ativa: bool = True


class EmpresaCreate(EmpresaBase):
    pass


class EmpresaUpdate(BaseModel):
    cnpj: str | None = None
    razao_social: str | None = None
    bu: str | None = None
    ativa: bool | None = None


class EmpresaOut(EmpresaBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class AtividadeBase(BaseModel):
    nome: str
    requer_apuracao: bool = True
    dia_prazo_legal: int | None = Field(default=None, ge=1, le=31)
    dia_prazo_fiscal: int | None = Field(default=None, ge=1, le=31)
    recorrencia: str = "mensal"
    ativa: bool = True


class AtividadeCreate(AtividadeBase):
    pass


class AtividadeUpdate(BaseModel):
    nome: str | None = None
    requer_apuracao: bool | None = None
    dia_prazo_legal: int | None = Field(default=None, ge=1, le=31)
    dia_prazo_fiscal: int | None = Field(default=None, ge=1, le=31)
    recorrencia: str | None = None
    ativa: bool | None = None


class AtividadeOut(AtividadeBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class ResponsavelBase(BaseModel):
    nome: str
    email: str | None = None
    ativo: bool = True
    capacidade_max: int | None = None
    foto_url: str | None = None


class ResponsavelCreate(ResponsavelBase):
    pass


class ResponsavelUpdate(BaseModel):
    nome: str | None = None
    email: str | None = None
    ativo: bool | None = None
    capacidade_max: int | None = None
    foto_url: str | None = None


class ResponsavelOut(ResponsavelBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    auth_user_id: UUID | None = None


class UsuarioRole(str, Enum):
    ADMIN = "admin"
    DIRETOR = "diretor"
    USER = "user"


class UsuarioCreate(BaseModel):
    email: str
    password: str = Field(min_length=12)
    nome: str | None = None
    role: UsuarioRole = UsuarioRole.USER
    responsavel_id: UUID | None = None


class UsuarioUpdate(BaseModel):
    role: UsuarioRole | None = None
    ativo: bool | None = None


class UsuarioOut(BaseModel):
    id: str
    email: str
    role: UsuarioRole
    created_at: str
    ativo: bool


class MeOut(BaseModel):
    user_id: str
    email: str | None
    role: UsuarioRole
    responsavel_id: UUID | None = None
    responsavel_nome: str | None = None
    must_change_password: bool = False
    is_viewer: bool = False


class ObrigacaoBase(BaseModel):
    empresa_id: UUID
    atividade_id: UUID
    responsavel_id: UUID | None = None
    competencia: date
    prazo_legal: date | None = None
    prazo_fiscal: date | None = None
    data_entrega: date | None = None
    status: StatusObrigacao = StatusObrigacao.PENDENTE
    recibo_path: str | None = None
    recibo_numero: str | None = None
    observacao: str | None = None


class ObrigacaoCreate(ObrigacaoBase):
    pass


class ObrigacaoUpdate(BaseModel):
    empresa_id: UUID | None = None
    atividade_id: UUID | None = None
    responsavel_id: UUID | None = None
    competencia: date | None = None
    prazo_legal: date | None = None
    prazo_fiscal: date | None = None
    data_entrega: date | None = None
    status: StatusObrigacao | None = None
    recibo_path: str | None = None
    recibo_numero: str | None = None
    observacao: str | None = None


class ObrigacaoOut(ObrigacaoBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    empresa: EmpresaOut | None = None
    atividade: AtividadeOut | None = None
    responsavel: ResponsavelOut | None = None
    urgencia: str | None = None
    aprovado_por: UUID | None = None
    aprovado_em: datetime | None = None
    reprovado_motivo: str | None = None


class ReprovarRequest(BaseModel):
    motivo: str = Field(min_length=1)


class ComentarioCreate(BaseModel):
    texto: str = Field(min_length=1)


class ComentarioOut(BaseModel):
    id: UUID
    obrigacao_id: UUID
    user_id: UUID
    autor_email: str | None = None
    texto: str
    created_at: datetime


class AuditLogOut(BaseModel):
    id: UUID
    obrigacao_id: UUID
    user_id: UUID | None = None
    acao: str
    campo: str | None = None
    valor_anterior: str | None = None
    valor_novo: str | None = None
    created_at: datetime


class NotificacaoOut(BaseModel):
    id: UUID
    user_id: UUID
    obrigacao_id: UUID | None = None
    tipo: str
    titulo: str
    corpo: str
    lida: bool
    created_at: datetime


class CalendarioDia(BaseModel):
    data: date
    total: int
    atrasadas: int
    por_status: dict[str, int]


class CalendarioResponse(BaseModel):
    dias: list[CalendarioDia]
    detalhe: list[ObrigacaoOut] = []


class GerarCompetenciaRequest(BaseModel):
    competencia_destino: date
    competencia_origem: date | None = None


class GerarCompetenciaResponse(BaseModel):
    criadas: int
    ignoradas: int
    competencia_destino: date
    competencia_origem: date | None


class ImportResult(BaseModel):
    empresas: int
    atividades: int
    responsaveis: int
    obrigacoes: int
    competencia: date


class DashboardSummary(BaseModel):
    total: int
    pendente: int
    em_andamento: int
    em_revisao: int
    entregue: int
    atrasado: int
    vence_em_7_dias: int
    percentual_entregue: float
    por_bu: dict[str, int]
    por_responsavel: dict[str, int]
    capacidade_por_responsavel: dict[str, int | None] = {}

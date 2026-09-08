from datetime import date, datetime, time
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    password: str = Field(min_length=8)
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
    motivo_atraso: str | None = None


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
    motivo_atraso: str | None = Field(default=None, max_length=2000)


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
    motivo_atraso: str | None = None


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
    tarefas: list["TarefaOut"] = []


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
    tarefas: int = 0
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


class TarefaCategoria(str, Enum):
    FECHAMENTO = "fechamento"
    OUTRAS = "outras"


def _validate_horario(
    hora_inicio: time | None,
    hora_fim: time | None,
    prazo: date | None,
    *,
    prazo_known: bool,
    required: bool,
) -> None:
    if required and (hora_inicio is None or hora_fim is None):
        raise ValueError("Informe início e fim do horário")
    if (hora_inicio is None) != (hora_fim is None):
        raise ValueError("Informe início e fim do horário")
    if hora_inicio is not None and hora_fim is not None and hora_fim <= hora_inicio:
        raise ValueError("O horário final deve ser depois do início")
    if hora_inicio is not None and prazo_known and prazo is None:
        raise ValueError("Informe o prazo do dia para definir o horário")


class TarefaCreate(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    solicitante_nome: str = Field(min_length=2, max_length=120)
    descricao: str | None = None
    categoria: TarefaCategoria = TarefaCategoria.FECHAMENTO
    status: StatusObrigacao = StatusObrigacao.PENDENTE
    competencia: date | None = None
    prazo: date
    hora_inicio: time
    hora_fim: time
    empresa_id: UUID | None = None
    obrigacao_id: UUID | None = None
    responsavel_id: UUID | None = None
    motivo_atraso: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def horario_consistente(self) -> "TarefaCreate":
        _validate_horario(
            self.hora_inicio,
            self.hora_fim,
            self.prazo,
            prazo_known=True,
            required=True,
        )
        return self


class TarefaUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=1, max_length=200)
    descricao: str | None = None
    categoria: TarefaCategoria | None = None
    status: StatusObrigacao | None = None
    competencia: date | None = None
    prazo: date | None = None
    hora_inicio: time | None = None
    hora_fim: time | None = None
    empresa_id: UUID | None = None
    obrigacao_id: UUID | None = None
    responsavel_id: UUID | None = None
    motivo_atraso: str | None = Field(default=None, max_length=2000)
    solicitante_nome: str | None = Field(default=None, min_length=2, max_length=120)

    @model_validator(mode="after")
    def horario_consistente(self) -> "TarefaUpdate":
        fields = self.model_fields_set
        if "hora_inicio" in fields or "hora_fim" in fields:
            _validate_horario(
                self.hora_inicio,
                self.hora_fim,
                self.prazo,
                prazo_known="prazo" in fields,
                required=True,
            )
        return self


class TarefaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    titulo: str
    descricao: str | None = None
    categoria: TarefaCategoria
    status: StatusObrigacao
    competencia: date | None = None
    prazo: date | None = None
    hora_inicio: time | None = None
    hora_fim: time | None = None
    empresa_id: UUID | None = None
    obrigacao_id: UUID | None = None
    responsavel_id: UUID
    solicitante_nome: str
    motivo_atraso: str | None = None
    entregue_em: datetime | None = None
    created_by: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    empresa: EmpresaOut | None = None
    responsavel: ResponsavelOut | None = None
    urgencia: str | None = None


CalendarioResponse.model_rebuild()


CalendarioResponse.model_rebuild()

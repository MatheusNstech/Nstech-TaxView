export type StatusObrigacao =
  | 'PENDENTE'
  | 'EM_ANDAMENTO'
  | 'EM_REVISAO'
  | 'ENTREGUE'
  | 'ATRASADO'

export interface Empresa {
  id: string
  cnpj: string
  razao_social: string
  bu: string
  ativa: boolean
}

export interface Atividade {
  id: string
  nome: string
  requer_apuracao: boolean
  dia_prazo_legal: number | null
  dia_prazo_fiscal: number | null
  recorrencia: string
  ativa: boolean
}

export interface Responsavel {
  id: string
  nome: string
  email: string | null
  ativo: boolean
  auth_user_id?: string | null
  capacidade_max?: number | null
  /** URL da foto de perfil (opcional — pronta para upload futuro). */
  foto_url?: string | null
}

export type UsuarioRole = 'admin' | 'diretor' | 'user'

export interface Usuario {
  id: string
  email: string
  role: UsuarioRole
  created_at: string
  ativo: boolean
}

export interface UsuarioCreate {
  email: string
  password: string
  nome?: string
  role?: UsuarioRole
  responsavel_id?: string | null
}

export type TarefaCategoria = 'fechamento' | 'outras'

export const TAREFA_CATEGORIA_OPTIONS: {
  value: TarefaCategoria
  label: string
}[] = [
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'outras', label: 'Outras' },
]

export function tarefaCategoriaLabel(categoria: TarefaCategoria | string): string {
  return (
    TAREFA_CATEGORIA_OPTIONS.find((o) => o.value === categoria)?.label ??
    categoria
  )
}

export interface Obrigacao {
  id: string
  empresa_id: string
  atividade_id: string
  responsavel_id: string | null
  competencia: string
  prazo_legal: string | null
  prazo_fiscal: string | null
  data_entrega: string | null
  status: StatusObrigacao
  recibo_path: string | null
  recibo_numero: string | null
  observacao: string | null
  motivo_atraso?: string | null
  categoria?: TarefaCategoria
  empresa: Empresa | null
  atividade: Atividade | null
  responsavel: Responsavel | null
  urgencia: string | null
  aprovado_por?: string | null
  aprovado_em?: string | null
  reprovado_motivo?: string | null
}

export interface Tarefa {
  id: string
  titulo: string
  descricao: string | null
  categoria: TarefaCategoria
  status: StatusObrigacao
  competencia: string | null
  prazo: string | null
  hora_inicio: string | null
  hora_fim: string | null
  empresa_id: string | null
  obrigacao_id: string | null
  responsavel_id: string
  solicitante_nome: string
  motivo_atraso: string | null
  entregue_em: string | null
  created_by: string | null
  created_at?: string | null
  updated_at?: string | null
  empresa: Empresa | null
  responsavel: Responsavel | null
  urgencia: string | null
}

export interface TarefaCreate {
  titulo: string
  solicitante_nome: string
  descricao?: string | null
  categoria?: TarefaCategoria
  status?: StatusObrigacao
  competencia?: string | null
  prazo: string
  hora_inicio: string
  hora_fim: string
  empresa_id?: string | null
  obrigacao_id?: string | null
  responsavel_id?: string | null
}

export interface TarefaUpdate {
  titulo?: string
  descricao?: string | null
  status?: StatusObrigacao
  competencia?: string | null
  prazo?: string | null
  hora_inicio?: string | null
  hora_fim?: string | null
  empresa_id?: string | null
  obrigacao_id?: string | null
  responsavel_id?: string | null
  solicitante_nome?: string
  motivo_atraso?: string | null
}

export type WorkOrigem = 'obrigacao' | 'tarefa'

export interface WorkItem {
  key: string
  origem: WorkOrigem
  id: string
  title: string
  subtitle: string
  responsavelNome: string | null
  prazo: string | null
  horaInicio?: string | null
  horaFim?: string | null
  status: StatusObrigacao
  urgencia: string | null
  categoria: TarefaCategoria
  obrigacao?: Obrigacao
  tarefa?: Tarefa
}


export interface ObrigacaoUpdate {
  status?: StatusObrigacao
  prazo_legal?: string | null
  prazo_fiscal?: string | null
  data_entrega?: string | null
  recibo_numero?: string | null
  observacao?: string | null
  motivo_atraso?: string | null
}

export interface Comentario {
  id: string
  obrigacao_id: string
  user_id: string
  autor_email: string | null
  texto: string
  created_at: string
}

export interface AuditLog {
  id: string
  obrigacao_id: string
  user_id: string | null
  acao: string
  campo: string | null
  valor_anterior: string | null
  valor_novo: string | null
  created_at: string
}

export interface Notificacao {
  id: string
  user_id: string
  obrigacao_id: string | null
  tipo: string
  titulo: string
  corpo: string
  lida: boolean
  created_at: string
}

export interface CalendarioDia {
  data: string
  total: number
  atrasadas: number
  por_status: Record<string, number>
}

export interface CalendarioResponse {
  dias: CalendarioDia[]
  detalhe: Obrigacao[]
  tarefas?: Tarefa[]
}

export interface DashboardSummary {
  total: number
  pendente: number
  em_andamento: number
  em_revisao: number
  entregue: number
  atrasado: number
  vence_em_7_dias: number
  percentual_entregue: number
  por_bu: Record<string, number>
  por_responsavel: Record<string, number>
  capacidade_por_responsavel?: Record<string, number | null>
}

export interface GerarCompetenciaResponse {
  criadas: number
  ignoradas: number
  competencia_destino: string
  competencia_origem: string | null
}

export interface ImportResult {
  empresas: number
  atividades: number
  responsaveis: number
  obrigacoes: number
  tarefas?: number
  competencia: string
}

export interface FilterValues {
  competencia: string
  bu: string
  status: string
  search: string
  responsavel_id?: string
}

export const KANBAN_COLUMNS: { id: StatusObrigacao; label: string }[] = [
  { id: 'PENDENTE', label: 'Pendente' },
  { id: 'EM_ANDAMENTO', label: 'Em andamento' },
  { id: 'EM_REVISAO', label: 'Em revisão' },
  { id: 'ENTREGUE', label: 'Entregue' },
]

-- Equipe compartilhada: membros veem e operam os itens uns dos outros em Minhas tarefas.

alter table public.responsaveis
  add column if not exists equipe_compartilhada boolean not null default false;

update public.responsaveis
set equipe_compartilhada = true
where nome in ('Flávia', 'Solange', 'Felipe', 'Viviane', 'Glaucia');

-- Notificação "Flávia entregou a tarefa do Felipe".
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes
  add constraint notificacoes_tipo_check
  check (tipo in ('PRAZO_7D', 'ATRASADO', 'ATRIBUICAO', 'COMENTARIO', 'APROVACAO', 'EQUIPE'));

-- Histórico das tarefas avulsas.
create table if not exists public.tarefa_audit_log (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas(id) on delete cascade,
  user_id uuid,
  acao text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tarefa_audit_log_tarefa
  on public.tarefa_audit_log (tarefa_id, created_at desc);

alter table public.tarefa_audit_log enable row level security;

drop policy if exists tarefa_audit_select_scoped on public.tarefa_audit_log;
create policy tarefa_audit_select_scoped on public.tarefa_audit_log
  for select to authenticated
  using (exists (select 1 from public.tarefas t where t.id = tarefa_id));

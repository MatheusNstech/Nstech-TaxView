-- Tipo de serviço da tarefa (mesmo cadastro das obrigações). Opcional: há tarefas que não são de um serviço fiscal.
alter table public.tarefas
  add column if not exists atividade_id uuid references public.atividades_modelo(id) on delete set null;

create index if not exists tarefas_atividade_id_idx on public.tarefas (atividade_id);

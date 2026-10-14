alter table public.empresas
  add column if not exists cartao_cnpj_path text,
  add column if not exists cartao_cnpj_atualizado_em timestamptz;

-- Sem policies para authenticated: só o backend (service role) lê e grava.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cartoes-cnpj', 'cartoes-cnpj', false, 4194304, array['application/pdf'])
on conflict (id) do nothing;

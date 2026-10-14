-- Certidões (CND) por empresa: só a atual de cada esfera. A federal vale para o grupo e fica na matriz.
create table if not exists public.empresa_certidoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  esfera text not null check (esfera in ('federal', 'estadual', 'municipal')),
  path text not null,
  situacao text check (situacao is null or situacao in ('negativa', 'positiva_efeitos_negativa', 'positiva')),
  emitida_em date,
  valida_ate date,
  codigo_controle text,
  atualizado_em timestamptz not null default now(),
  constraint empresa_certidoes_empresa_esfera_key unique (empresa_id, esfera)
);

alter table public.empresa_certidoes enable row level security;

drop policy if exists empresa_certidoes_select_authenticated on public.empresa_certidoes;
create policy empresa_certidoes_select_authenticated on public.empresa_certidoes
  for select to authenticated using (true);

-- Sem policies para authenticated: só o backend (service role) lê e grava os PDFs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certidoes', 'certidoes', false, 4194304, array['application/pdf'])
on conflict (id) do nothing;

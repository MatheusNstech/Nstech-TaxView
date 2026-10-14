-- Certificado digital (A1) por CNPJ: só o atual. A senha nunca é gravada.
create table if not exists public.empresa_certificados (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  path text not null,
  titular text,
  cnpj text,
  emissor text,
  numero_serie text,
  valido_de timestamptz,
  valido_ate timestamptz,
  atualizado_em timestamptz not null default now()
);

alter table public.empresa_certificados enable row level security;

drop policy if exists empresa_certificados_select_authenticated on public.empresa_certificados;
create policy empresa_certificados_select_authenticated on public.empresa_certificados
  for select to authenticated using (true);

-- Sem policies para authenticated: só o backend (service role) lê e grava os PFX.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificados', 'certificados', false, 1048576, array['application/x-pkcs12', 'application/octet-stream'])
on conflict (id) do nothing;

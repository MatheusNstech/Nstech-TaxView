-- Tela Empresas: nome fantasia, porte, logo e contatos (contábil / contas a pagar) por CNPJ.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS porte text,
  ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_porte_check;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_porte_check CHECK (porte IS NULL OR porte IN ('Pequeno', 'Médio', 'Grande'));

CREATE TABLE IF NOT EXISTS public.empresa_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (area IN ('contabil', 'contas_pagar')),
  nome text,
  email text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresa_contatos_nome_ou_email CHECK (nome IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_empresa_contatos_empresa ON public.empresa_contatos (empresa_id, area, ordem);

ALTER TABLE public.empresa_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_contatos_select_authenticated ON public.empresa_contatos;
CREATE POLICY empresa_contatos_select_authenticated ON public.empresa_contatos
  FOR SELECT TO authenticated USING (true);

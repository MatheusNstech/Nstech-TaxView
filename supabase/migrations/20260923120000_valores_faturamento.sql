-- Ingestão de valores de faturamento (app desktop / integração)
CREATE TABLE IF NOT EXISTS public.valores_faturamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia date NULL,
  origem text NOT NULL DEFAULT 'desktop',
  referencia text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS valores_faturamento_created_at_idx
  ON public.valores_faturamento (created_at DESC);

CREATE INDEX IF NOT EXISTS valores_faturamento_competencia_idx
  ON public.valores_faturamento (competencia);

ALTER TABLE public.valores_faturamento ENABLE ROW LEVEL SECURITY;

-- Leitura/escrita via service role na API; políticas mínimas para authenticated org-wide
CREATE POLICY valores_faturamento_select_org
  ON public.valores_faturamento
  FOR SELECT
  TO authenticated
  USING (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') IN ('admin', 'diretor')
  );

CREATE POLICY valores_faturamento_insert_org
  ON public.valores_faturamento
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') IN ('admin', 'diretor')
  );

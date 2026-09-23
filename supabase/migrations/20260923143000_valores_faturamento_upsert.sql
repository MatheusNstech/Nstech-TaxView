-- Evolui valores_faturamento: chave por empresa/competência/tipo + upsert-on-diff

ALTER TABLE public.valores_faturamento
  ADD COLUMN IF NOT EXISTS empresa_cnpj text,
  ADD COLUMN IF NOT EXISTS empresa_alias text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empresa_razao text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Competência: preenche nulos com mês corrente e torna obrigatória
UPDATE public.valores_faturamento
SET competencia = date_trunc('month', coalesce(competencia, current_date))::date
WHERE competencia IS NULL;

ALTER TABLE public.valores_faturamento
  ALTER COLUMN competencia SET NOT NULL;

-- Tipo default para linhas legadas
UPDATE public.valores_faturamento
SET tipo = 'iss'
WHERE tipo IS NULL;

ALTER TABLE public.valores_faturamento
  ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE public.valores_faturamento
  DROP CONSTRAINT IF EXISTS valores_faturamento_tipo_check;

ALTER TABLE public.valores_faturamento
  ADD CONSTRAINT valores_faturamento_tipo_check
  CHECK (tipo IN ('iss', 'pis_cofins'));

-- CNPJ a partir de coluna ou referencia; remove linhas sem chave válida
UPDATE public.valores_faturamento
SET empresa_cnpj = regexp_replace(coalesce(empresa_cnpj, referencia, ''), '\D', '', 'g')
WHERE coalesce(trim(empresa_cnpj), '') = '';

UPDATE public.valores_faturamento
SET empresa_cnpj = regexp_replace(empresa_cnpj, '\D', '', 'g')
WHERE empresa_cnpj IS NOT NULL;

DELETE FROM public.valores_faturamento
WHERE coalesce(trim(empresa_cnpj), '') = ''
   OR length(empresa_cnpj) < 11;

ALTER TABLE public.valores_faturamento
  ALTER COLUMN empresa_cnpj SET NOT NULL;

-- Remove duplicatas mantendo a mais recente
DELETE FROM public.valores_faturamento a
USING public.valores_faturamento b
WHERE a.empresa_cnpj = b.empresa_cnpj
  AND a.competencia = b.competencia
  AND a.tipo = b.tipo
  AND a.created_at < b.created_at;

ALTER TABLE public.valores_faturamento
  DROP CONSTRAINT IF EXISTS valores_faturamento_empresa_comp_tipo_key;

ALTER TABLE public.valores_faturamento
  ADD CONSTRAINT valores_faturamento_empresa_comp_tipo_key
  UNIQUE (empresa_cnpj, competencia, tipo);

CREATE INDEX IF NOT EXISTS valores_faturamento_comp_tipo_idx
  ON public.valores_faturamento (competencia DESC, tipo);

CREATE INDEX IF NOT EXISTS valores_faturamento_cnpj_idx
  ON public.valores_faturamento (empresa_cnpj);

DROP POLICY IF EXISTS valores_faturamento_update_org ON public.valores_faturamento;
CREATE POLICY valores_faturamento_update_org
  ON public.valores_faturamento
  FOR UPDATE
  TO authenticated
  USING (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') IN ('admin', 'diretor')
  )
  WITH CHECK (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') IN ('admin', 'diretor')
  );

-- Pendências RFB / PGFN: base editável (seed do CSV).

CREATE OR REPLACE FUNCTION public.is_painel_fiscal_editor()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'painel_fiscal_editor'), '') IN ('true', '1')
    OR public.is_app_admin();
$$;

CREATE OR REPLACE FUNCTION public.can_read_painel_fiscal()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_app_org_wide() OR public.is_painel_fiscal_editor();
$$;

CREATE TABLE IF NOT EXISTS public.painel_fiscal_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  razao_social text NOT NULL DEFAULT '',
  situacao_cnpj text NOT NULL DEFAULT '',
  cnpj text NOT NULL DEFAULT '',
  cidade_iss text NOT NULL DEFAULT '',
  uf text NOT NULL DEFAULT '',
  orgao text NOT NULL DEFAULT '',
  sucedida text NOT NULL DEFAULT '',
  data_inscricao date,
  cnpj_sucedida text NOT NULL DEFAULT '',
  empresa_sucedida text NOT NULL DEFAULT '',
  natureza text NOT NULL DEFAULT '',
  fase text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  situacao text NOT NULL DEFAULT '',
  codigo text NOT NULL DEFAULT '',
  mes integer,
  ano integer,
  periodo_apuracao text NOT NULL DEFAULT '',
  vencimento date,
  principal numeric(18, 2),
  multa numeric(18, 2),
  juros numeric(18, 2),
  total numeric(18, 2),
  motivo text NOT NULL DEFAULT '',
  numero_processo text NOT NULL DEFAULT '',
  cnd text NOT NULL DEFAULT '',
  validade_cnd date,
  status_cnd text NOT NULL DEFAULT '',
  nota_01 text NOT NULL DEFAULT '',
  nota_02 text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_painel_fiscal_empresa
  ON public.painel_fiscal_pendencias (empresa);
CREATE INDEX IF NOT EXISTS idx_painel_fiscal_orgao
  ON public.painel_fiscal_pendencias (orgao);
CREATE INDEX IF NOT EXISTS idx_painel_fiscal_ano_mes
  ON public.painel_fiscal_pendencias (ano, mes);
CREATE INDEX IF NOT EXISTS idx_painel_fiscal_cnpj
  ON public.painel_fiscal_pendencias (cnpj);

DROP TRIGGER IF EXISTS trg_painel_fiscal_updated_at ON public.painel_fiscal_pendencias;
CREATE TRIGGER trg_painel_fiscal_updated_at
  BEFORE UPDATE ON public.painel_fiscal_pendencias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.painel_fiscal_pendencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS painel_fiscal_select ON public.painel_fiscal_pendencias;
CREATE POLICY painel_fiscal_select ON public.painel_fiscal_pendencias
  FOR SELECT TO authenticated
  USING (public.can_read_painel_fiscal());

DROP POLICY IF EXISTS painel_fiscal_insert ON public.painel_fiscal_pendencias;
CREATE POLICY painel_fiscal_insert ON public.painel_fiscal_pendencias
  FOR INSERT TO authenticated
  WITH CHECK (public.is_painel_fiscal_editor());

DROP POLICY IF EXISTS painel_fiscal_update ON public.painel_fiscal_pendencias;
CREATE POLICY painel_fiscal_update ON public.painel_fiscal_pendencias
  FOR UPDATE TO authenticated
  USING (public.is_painel_fiscal_editor())
  WITH CHECK (public.is_painel_fiscal_editor());

DROP POLICY IF EXISTS painel_fiscal_delete ON public.painel_fiscal_pendencias;
CREATE POLICY painel_fiscal_delete ON public.painel_fiscal_pendencias
  FOR DELETE TO authenticated
  USING (public.is_painel_fiscal_editor());

REVOKE ALL ON public.painel_fiscal_pendencias FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.painel_fiscal_pendencias TO authenticated;
GRANT ALL ON public.painel_fiscal_pendencias TO service_role;

-- Controle de Créditos Tributários (SELIC global + ledgers por empresa).
-- Leitura: can_read_painel_fiscal. Escrita: is_painel_fiscal_editor.

CREATE TABLE IF NOT EXISTS public.selic_taxas (
  competencia date PRIMARY KEY,
  taxa_mensal numeric(12, 8) NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT 'manual',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT selic_taxas_competencia_dia1 CHECK (EXTRACT(DAY FROM competencia) = 1)
);

CREATE TABLE IF NOT EXISTS public.credito_controles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_contabil text NOT NULL DEFAULT '',
  descricao_conta text NOT NULL DEFAULT 'Saldo Negativo de Anos Anteriores',
  competencia_atual date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT credito_controles_empresa_unique UNIQUE (empresa_id)
);

CREATE TABLE IF NOT EXISTS public.credito_cadastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id uuid NOT NULL REFERENCES public.credito_controles(id) ON DELETE CASCADE,
  codigo_interno int NOT NULL CHECK (codigo_interno BETWEEN 1 AND 20),
  tipo_credito text NOT NULL DEFAULT '',
  tributo text NOT NULL DEFAULT '',
  ano_calendario int,
  credito_original_inicial numeric(18, 2) NOT NULL DEFAULT 0,
  data_inicio_atualizacao date,
  na_consolidada boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  observacao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT credito_cadastros_codigo_unique UNIQUE (controle_id, codigo_interno)
);

CREATE TABLE IF NOT EXISTS public.credito_compensacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id uuid NOT NULL REFERENCES public.credito_cadastros(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  valor numeric(18, 2) NOT NULL DEFAULT 0,
  multa numeric(18, 2) NOT NULL DEFAULT 0,
  juros_evento numeric(18, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT credito_compensacoes_competencia_dia1 CHECK (EXTRACT(DAY FROM competencia) = 1)
);

CREATE INDEX IF NOT EXISTS idx_credito_comp_credito_comp
  ON public.credito_compensacoes (credito_id, competencia);

CREATE TABLE IF NOT EXISTS public.credito_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id uuid NOT NULL REFERENCES public.credito_cadastros(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  selic_mensal numeric(12, 4) NOT NULL DEFAULT 0,
  selic_acumulada numeric(12, 4) NOT NULL DEFAULT 0,
  credito_original numeric(18, 2) NOT NULL DEFAULT 0,
  saldo_atualizado numeric(18, 2) NOT NULL DEFAULT 0,
  principal numeric(18, 2) NOT NULL DEFAULT 0,
  juros numeric(18, 2) NOT NULL DEFAULT 0,
  total_compensado numeric(18, 2) NOT NULL DEFAULT 0,
  credito_remanescente numeric(18, 2) NOT NULL DEFAULT 0,
  credito_original_utilizado numeric(18, 2) NOT NULL DEFAULT 0,
  credito_original_remanescente numeric(18, 2) NOT NULL DEFAULT 0,
  atualiz_mes numeric(18, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credito_movimentos_competencia_dia1 CHECK (EXTRACT(DAY FROM competencia) = 1),
  CONSTRAINT credito_movimentos_unique UNIQUE (credito_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_credito_mov_credito_comp
  ON public.credito_movimentos (credito_id, competencia);

DROP TRIGGER IF EXISTS trg_credito_controles_updated_at ON public.credito_controles;
CREATE TRIGGER trg_credito_controles_updated_at
  BEFORE UPDATE ON public.credito_controles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_credito_cadastros_updated_at ON public.credito_cadastros;
CREATE TRIGGER trg_credito_cadastros_updated_at
  BEFORE UPDATE ON public.credito_cadastros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_credito_compensacoes_updated_at ON public.credito_compensacoes;
CREATE TRIGGER trg_credito_compensacoes_updated_at
  BEFORE UPDATE ON public.credito_compensacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_selic_taxas_updated_at ON public.selic_taxas;
CREATE TRIGGER trg_selic_taxas_updated_at
  BEFORE UPDATE ON public.selic_taxas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.selic_taxas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credito_controles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credito_cadastros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credito_compensacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credito_movimentos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'selic_taxas',
    'credito_controles',
    'credito_cadastros',
    'credito_compensacoes',
    'credito_movimentos'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.can_read_painel_fiscal())',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_painel_fiscal_editor())',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (public.is_painel_fiscal_editor()) WITH CHECK (public.is_painel_fiscal_editor())',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (public.is_painel_fiscal_editor())',
      t, t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

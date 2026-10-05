-- Acompanhamento PER/DCOMP: base editável (carga única da planilha).
-- Leitura: diretoria/admin/editores do painel fiscal. Edição: painel_fiscal_editor ou admin.

CREATE TABLE IF NOT EXISTS public.perdcomp_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perdcomp text NOT NULL UNIQUE,
  processo text NOT NULL DEFAULT '',
  empresa text NOT NULL DEFAULT '',
  tributo_credito text NOT NULL DEFAULT '',
  periodo text NOT NULL DEFAULT '',
  valor_pedido numeric(18, 2),
  status text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  prazo_cumprimento text NOT NULL DEFAULT '',
  data_base_ciencia text NOT NULL DEFAULT '',
  data_limite date,
  providencia text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_perdcomp_empresa
  ON public.perdcomp_processos (empresa);
CREATE INDEX IF NOT EXISTS idx_perdcomp_status
  ON public.perdcomp_processos (status);
CREATE INDEX IF NOT EXISTS idx_perdcomp_data_limite
  ON public.perdcomp_processos (data_limite);

DROP TRIGGER IF EXISTS trg_perdcomp_updated_at ON public.perdcomp_processos;
CREATE TRIGGER trg_perdcomp_updated_at
  BEFORE UPDATE ON public.perdcomp_processos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.perdcomp_processos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perdcomp_select ON public.perdcomp_processos;
CREATE POLICY perdcomp_select ON public.perdcomp_processos
  FOR SELECT TO authenticated
  USING (public.can_read_painel_fiscal());

DROP POLICY IF EXISTS perdcomp_insert ON public.perdcomp_processos;
CREATE POLICY perdcomp_insert ON public.perdcomp_processos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_painel_fiscal_editor());

DROP POLICY IF EXISTS perdcomp_update ON public.perdcomp_processos;
CREATE POLICY perdcomp_update ON public.perdcomp_processos
  FOR UPDATE TO authenticated
  USING (public.is_painel_fiscal_editor())
  WITH CHECK (public.is_painel_fiscal_editor());

DROP POLICY IF EXISTS perdcomp_delete ON public.perdcomp_processos;
CREATE POLICY perdcomp_delete ON public.perdcomp_processos
  FOR DELETE TO authenticated
  USING (public.is_painel_fiscal_editor());

REVOKE ALL ON public.perdcomp_processos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perdcomp_processos TO authenticated;
GRANT ALL ON public.perdcomp_processos TO service_role;

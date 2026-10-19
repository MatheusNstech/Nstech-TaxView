-- Entrega de pendências RFB/PGFN e processos PER/DCOMP.
-- Item entregue sai do valor em aberto; reabrir devolve. Histórico em fiscal_audit_log.

ALTER TABLE public.painel_fiscal_pendencias
  ADD COLUMN IF NOT EXISTS entregue_em date,
  ADD COLUMN IF NOT EXISTS entregue_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entrega_obs text NOT NULL DEFAULT '';

ALTER TABLE public.perdcomp_processos
  ADD COLUMN IF NOT EXISTS entregue_em date,
  ADD COLUMN IF NOT EXISTS entregue_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entrega_obs text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.fiscal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL CHECK (origem IN ('pendencia', 'perdcomp')),
  item_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text NOT NULL DEFAULT '',
  acao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_audit_item
  ON public.fiscal_audit_log (origem, item_id, created_at DESC);

ALTER TABLE public.fiscal_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_audit_select ON public.fiscal_audit_log;
CREATE POLICY fiscal_audit_select ON public.fiscal_audit_log
  FOR SELECT TO authenticated
  USING (public.can_read_painel_fiscal());

DROP POLICY IF EXISTS fiscal_audit_insert ON public.fiscal_audit_log;
CREATE POLICY fiscal_audit_insert ON public.fiscal_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_painel_fiscal_editor());

REVOKE ALL ON public.fiscal_audit_log FROM anon;
GRANT SELECT, INSERT ON public.fiscal_audit_log TO authenticated;
GRANT ALL ON public.fiscal_audit_log TO service_role;

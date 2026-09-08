-- Tarefas manuais (follow-ups de fechamento) + categoria em obrigações.

ALTER TABLE public.obrigacoes
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'fechamento';

ALTER TABLE public.obrigacoes
  DROP CONSTRAINT IF EXISTS obrigacoes_categoria_check;

ALTER TABLE public.obrigacoes
  ADD CONSTRAINT obrigacoes_categoria_check
  CHECK (categoria IN ('fechamento'));

CREATE TABLE IF NOT EXISTS public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'fechamento'
    CHECK (categoria IN ('fechamento')),
  status public.status_obrigacao NOT NULL DEFAULT 'PENDENTE',
  competencia date,
  prazo date,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  obrigacao_id uuid REFERENCES public.obrigacoes(id) ON DELETE SET NULL,
  responsavel_id uuid NOT NULL REFERENCES public.responsaveis(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_competencia ON public.tarefas(competencia);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON public.tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_categoria ON public.tarefas(categoria);
CREATE INDEX IF NOT EXISTS idx_tarefas_prazo ON public.tarefas(prazo);
CREATE INDEX IF NOT EXISTS idx_obrigacoes_categoria ON public.obrigacoes(categoria);

DROP TRIGGER IF EXISTS trg_tarefas_updated_at ON public.tarefas;
CREATE TRIGGER trg_tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tarefa_in_user_scope(p_tarefa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT public.is_app_org_wide()
    OR EXISTS (
      SELECT 1
      FROM public.tarefas t
      WHERE t.id = p_tarefa_id
        AND t.responsavel_id IN (SELECT public.current_responsavel_ids())
    );
$$;

DROP POLICY IF EXISTS tarefas_select_scoped ON public.tarefas;
CREATE POLICY tarefas_select_scoped ON public.tarefas
  FOR SELECT TO authenticated
  USING (
    public.is_app_org_wide()
    OR responsavel_id IN (SELECT public.current_responsavel_ids())
  );

DROP POLICY IF EXISTS tarefas_insert_scoped ON public.tarefas;
CREATE POLICY tarefas_insert_scoped ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND NOT public.is_app_diretor()
      AND responsavel_id IN (SELECT public.current_responsavel_ids())
    )
  );

DROP POLICY IF EXISTS tarefas_update_scoped ON public.tarefas;
CREATE POLICY tarefas_update_scoped ON public.tarefas
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND NOT public.is_app_diretor()
      AND responsavel_id IN (SELECT public.current_responsavel_ids())
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND NOT public.is_app_diretor()
      AND responsavel_id IN (SELECT public.current_responsavel_ids())
    )
  );

DROP POLICY IF EXISTS tarefas_delete_scoped ON public.tarefas;
CREATE POLICY tarefas_delete_scoped ON public.tarefas
  FOR DELETE TO authenticated
  USING (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND NOT public.is_app_diretor()
      AND created_by = auth.uid()
      AND responsavel_id IN (SELECT public.current_responsavel_ids())
    )
  );

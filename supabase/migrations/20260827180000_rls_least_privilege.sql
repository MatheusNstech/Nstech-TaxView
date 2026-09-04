-- Least-privilege RLS: API uses service_role (bypasses RLS).
-- Direct PostgREST with user JWT is limited to own scope / read-only masters.

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_app_viewer()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_viewer'), 'false')
    IN ('true', 'True', '1');
$$;

CREATE OR REPLACE FUNCTION public.jwt_view_as_responsavel_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'view_as_responsavel_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_responsavel_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT r.id
  FROM public.responsaveis r
  WHERE r.auth_user_id = auth.uid()
  UNION
  SELECT public.jwt_view_as_responsavel_id()
  WHERE public.jwt_view_as_responsavel_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.obrigacao_in_user_scope(p_obrigacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT public.is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.obrigacoes o
      WHERE o.id = p_obrigacao_id
        AND o.responsavel_id IN (SELECT public.current_responsavel_ids())
    );
$$;

-- Drop open policies
DROP POLICY IF EXISTS empresas_authenticated_all ON public.empresas;
DROP POLICY IF EXISTS atividades_authenticated_all ON public.atividades_modelo;
DROP POLICY IF EXISTS responsaveis_authenticated_all ON public.responsaveis;
DROP POLICY IF EXISTS obrigacoes_authenticated_all ON public.obrigacoes;
DROP POLICY IF EXISTS notificacoes_all_authenticated ON public.notificacoes;
DROP POLICY IF EXISTS comentarios_all_authenticated ON public.obrigacao_comentarios;
DROP POLICY IF EXISTS audit_all_authenticated ON public.obrigacao_audit_log;

DROP POLICY IF EXISTS recibos_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS recibos_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS recibos_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS recibos_authenticated_delete ON storage.objects;

-- Masters: read for authenticated; writes only via service_role
CREATE POLICY empresas_select_authenticated ON public.empresas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY atividades_select_authenticated ON public.atividades_modelo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY responsaveis_select_authenticated ON public.responsaveis
  FOR SELECT TO authenticated USING (true);

-- Obrigacoes: admin all; users select/update own scope (viewers: select only)
CREATE POLICY obrigacoes_select_scoped ON public.obrigacoes
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR responsavel_id IN (SELECT public.current_responsavel_ids())
  );

CREATE POLICY obrigacoes_update_scoped ON public.obrigacoes
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND responsavel_id IN (SELECT public.current_responsavel_ids())
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND responsavel_id IN (SELECT public.current_responsavel_ids())
    )
  );

CREATE POLICY obrigacoes_insert_admin ON public.obrigacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

CREATE POLICY obrigacoes_delete_admin ON public.obrigacoes
  FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- Notificacoes: own rows only
CREATE POLICY notificacoes_select_own ON public.notificacoes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notificacoes_update_own ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notificacoes_insert_own ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notificacoes_delete_own ON public.notificacoes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Comentarios: scoped by obrigacao
CREATE POLICY comentarios_select_scoped ON public.obrigacao_comentarios
  FOR SELECT TO authenticated
  USING (public.obrigacao_in_user_scope(obrigacao_id));

CREATE POLICY comentarios_insert_scoped ON public.obrigacao_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_app_viewer()
    AND public.obrigacao_in_user_scope(obrigacao_id)
  );

CREATE POLICY comentarios_delete_own_or_admin ON public.obrigacao_comentarios
  FOR DELETE TO authenticated
  USING (public.is_app_admin() OR user_id = auth.uid());

-- Audit: read scoped; insert via service_role / admin path
CREATE POLICY audit_select_scoped ON public.obrigacao_audit_log
  FOR SELECT TO authenticated
  USING (public.obrigacao_in_user_scope(obrigacao_id));

CREATE POLICY audit_insert_admin ON public.obrigacao_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin() OR public.obrigacao_in_user_scope(obrigacao_id));

-- Storage: no direct client access (uploads via API / service_role only)
-- Intentionally no policies for authenticated on recibos bucket.

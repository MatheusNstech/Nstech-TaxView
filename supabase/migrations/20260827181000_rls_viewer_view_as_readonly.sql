-- Viewers use view_as_responsavel_id; JWT may omit is_viewer until refresh.
-- Treat any view_as session as read-only for mutations.

DROP POLICY IF EXISTS obrigacoes_update_scoped ON public.obrigacoes;

CREATE POLICY obrigacoes_update_scoped ON public.obrigacoes
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND public.jwt_view_as_responsavel_id() IS NULL
      AND responsavel_id IN (
        SELECT r.id
        FROM public.responsaveis r
        WHERE r.auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND public.jwt_view_as_responsavel_id() IS NULL
      AND responsavel_id IN (
        SELECT r.id
        FROM public.responsaveis r
        WHERE r.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS comentarios_insert_scoped ON public.obrigacao_comentarios;

CREATE POLICY comentarios_insert_scoped ON public.obrigacao_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_app_viewer()
    AND public.jwt_view_as_responsavel_id() IS NULL
    AND public.obrigacao_in_user_scope(obrigacao_id)
  );

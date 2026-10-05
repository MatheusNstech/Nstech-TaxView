-- _seed_auth_user (criada pela migração remota seed_team_auth_users) era SECURITY DEFINER,
-- executável por anon e sem checagem de admin: permitia trocar senha/role de qualquer conta.
DROP FUNCTION IF EXISTS public._seed_auth_user(text, text, text, text, boolean, uuid, boolean);

REVOKE EXECUTE ON FUNCTION public._assert_is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_usuarios() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_usuario(text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_usuario(uuid, text, boolean) FROM PUBLIC, anon;

ALTER FUNCTION public.is_app_admin() SET search_path = '';
ALTER FUNCTION public.is_app_diretor() SET search_path = '';
ALTER FUNCTION public.is_app_viewer() SET search_path = '';
ALTER FUNCTION public.is_app_org_wide() SET search_path = '';
ALTER FUNCTION public.is_painel_fiscal_editor() SET search_path = '';
ALTER FUNCTION public.can_read_painel_fiscal() SET search_path = '';
ALTER FUNCTION public.jwt_view_as_responsavel_id() SET search_path = '';
ALTER FUNCTION public.current_responsavel_ids() SET search_path = '';
ALTER FUNCTION public.obrigacao_in_user_scope(uuid) SET search_path = '';
ALTER FUNCTION public.tarefa_in_user_scope(uuid) SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';

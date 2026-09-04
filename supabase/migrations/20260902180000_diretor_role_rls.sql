-- Diretor: SELECT org-wide; sem writes (igual viewer nas mutations).

CREATE OR REPLACE FUNCTION public.is_app_diretor()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'diretor';
$$;

CREATE OR REPLACE FUNCTION public.is_app_org_wide()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_app_admin() OR public.is_app_diretor();
$$;

CREATE OR REPLACE FUNCTION public.obrigacao_in_user_scope(p_obrigacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT public.is_app_org_wide()
    OR EXISTS (
      SELECT 1
      FROM public.obrigacoes o
      WHERE o.id = p_obrigacao_id
        AND o.responsavel_id IN (SELECT public.current_responsavel_ids())
    );
$$;

DROP POLICY IF EXISTS obrigacoes_select_scoped ON public.obrigacoes;
CREATE POLICY obrigacoes_select_scoped ON public.obrigacoes
  FOR SELECT TO authenticated
  USING (
    public.is_app_org_wide()
    OR responsavel_id IN (SELECT public.current_responsavel_ids())
  );

-- Updates: admin or scoped non-viewer non-diretor (diretor is read-only)
DROP POLICY IF EXISTS obrigacoes_update_scoped ON public.obrigacoes;
CREATE POLICY obrigacoes_update_scoped ON public.obrigacoes
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

-- Comentários: diretor não insere
DROP POLICY IF EXISTS comentarios_insert_scoped ON public.obrigacao_comentarios;
CREATE POLICY comentarios_insert_scoped ON public.obrigacao_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_app_admin() OR public.obrigacao_in_user_scope(obrigacao_id))
    AND NOT public.is_app_viewer()
    AND NOT public.is_app_diretor()
    AND user_id = auth.uid()
  );

-- Allow diretor in admin usuario RPCs (role clamp)
CREATE OR REPLACE FUNCTION public.admin_create_usuario(
  p_email text,
  p_password text,
  p_role text DEFAULT 'user',
  p_nome text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
  v_role text := CASE
    WHEN p_role = 'admin' THEN 'admin'
    WHEN p_role = 'diretor' THEN 'diretor'
    ELSE 'user'
  END;
  v_meta jsonb;
BEGIN
  PERFORM public._assert_is_admin();

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'E-mail obrigatório';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Senha deve ter ao menos 6 caracteres';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Já existe um usuário com este e-mail';
  END IF;

  v_meta := jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'role', v_role,
    'must_change_password', true
  );

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    v_meta,
    CASE WHEN p_nome IS NULL OR p_nome = '' THEN '{}'::jsonb ELSE jsonb_build_object('nome', p_nome) END,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_id::text,
    now(),
    now(),
    now()
  );

  RETURN jsonb_build_object(
    'id', v_id::text,
    'email', v_email,
    'role', v_role,
    'created_at', now()::text,
    'ativo', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_usuario(
  p_user_id uuid,
  p_role text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  u auth.users%ROWTYPE;
  v_role text;
BEGIN
  PERFORM public._assert_is_admin();

  IF p_user_id = auth.uid() AND p_ativo IS FALSE THEN
    RAISE EXCEPTION 'Você não pode desativar o próprio usuário';
  END IF;
  IF p_user_id = auth.uid() AND p_role IS NOT NULL AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'Você não pode remover o próprio papel de admin';
  END IF;

  SELECT * INTO u FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF p_role IS NOT NULL THEN
    v_role := CASE
      WHEN p_role = 'admin' THEN 'admin'
      WHEN p_role = 'diretor' THEN 'diretor'
      ELSE 'user'
    END;
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_role),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  IF p_ativo IS FALSE THEN
    UPDATE auth.users SET banned_until = now() + interval '100 years', updated_at = now() WHERE id = p_user_id;
  ELSIF p_ativo IS TRUE THEN
    UPDATE auth.users SET banned_until = NULL, updated_at = now() WHERE id = p_user_id;
  END IF;

  SELECT * INTO u FROM auth.users WHERE id = p_user_id;
  RETURN jsonb_build_object(
    'id', u.id::text,
    'email', u.email::text,
    'role', coalesce(u.raw_app_meta_data->>'role', 'user'),
    'created_at', coalesce(u.created_at::text, ''),
    'ativo', (u.banned_until IS NULL OR u.banned_until < now())
  );
END;
$$;

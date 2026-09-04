-- Admin user management without service role (checks auth.users.raw_app_meta_data)
CREATE OR REPLACE FUNCTION public._assert_is_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND coalesce(u.raw_app_meta_data->>'role', 'user') = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_usuarios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM public._assert_is_admin();
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      u.id::text AS id,
      u.email::text AS email,
      coalesce(u.raw_app_meta_data->>'role', 'user') AS role,
      coalesce(u.created_at::text, '') AS created_at,
      (u.banned_until IS NULL OR u.banned_until < now()) AS ativo
    FROM auth.users u
  ) t;
  RETURN result;
END;
$$;

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
  v_role text := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'user' END;
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

  v_meta := jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', v_role);

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
  IF p_user_id = auth.uid() AND p_role = 'user' THEN
    RAISE EXCEPTION 'Você não pode remover o próprio papel de admin';
  END IF;

  SELECT * INTO u FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF p_role IS NOT NULL THEN
    v_role := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'user' END;
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

REVOKE ALL ON FUNCTION public._assert_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_usuarios() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_usuario(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_usuario(uuid, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_usuarios() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_usuario(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_usuario(uuid, text, boolean) TO authenticated;

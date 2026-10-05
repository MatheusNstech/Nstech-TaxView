-- Mais de um responsável por obrigação.
-- obrigacoes.responsavel_id continua sendo o responsável principal; obrigacao_responsaveis
-- guarda o conjunto completo (principal incluído, mantido pelo trigger abaixo).

-- PK própria (não composta pelas FKs): com PK composta o PostgREST trataria a tabela como
-- junção many-to-many e os embeds responsaveis(*) a partir de obrigacoes ficariam ambíguos.
CREATE TABLE IF NOT EXISTS public.obrigacao_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obrigacao_id uuid NOT NULL REFERENCES public.obrigacoes(id) ON DELETE CASCADE,
  responsavel_id uuid NOT NULL REFERENCES public.responsaveis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obrigacao_responsaveis_unique UNIQUE (obrigacao_id, responsavel_id)
);

CREATE INDEX IF NOT EXISTS idx_obrigacao_responsaveis_responsavel
  ON public.obrigacao_responsaveis (responsavel_id);

INSERT INTO public.obrigacao_responsaveis (obrigacao_id, responsavel_id)
SELECT o.id, o.responsavel_id
FROM public.obrigacoes o
WHERE o.responsavel_id IS NOT NULL
ON CONFLICT (obrigacao_id, responsavel_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_obrigacao_responsavel_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.responsavel_id IS NOT NULL
    AND OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id
  THEN
    DELETE FROM public.obrigacao_responsaveis
    WHERE obrigacao_id = NEW.id
      AND responsavel_id = OLD.responsavel_id;
  END IF;
  IF NEW.responsavel_id IS NOT NULL THEN
    INSERT INTO public.obrigacao_responsaveis (obrigacao_id, responsavel_id)
    VALUES (NEW.id, NEW.responsavel_id)
    ON CONFLICT (obrigacao_id, responsavel_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_obrigacao_responsavel_principal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_obrigacoes_sync_responsavel ON public.obrigacoes;
CREATE TRIGGER trg_obrigacoes_sync_responsavel
  AFTER INSERT OR UPDATE OF responsavel_id ON public.obrigacoes
  FOR EACH ROW EXECUTE FUNCTION public.sync_obrigacao_responsavel_principal();

-- SECURITY DEFINER: as policies de obrigacoes e de obrigacao_responsaveis consultam a
-- tabela de vínculo; sem bypass de RLS aqui, uma policy chamaria a outra em recursão.
CREATE OR REPLACE FUNCTION public.obrigacao_tem_responsavel_atual(p_obrigacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.obrigacao_responsaveis r
    WHERE r.obrigacao_id = p_obrigacao_id
      AND r.responsavel_id IN (SELECT public.current_responsavel_ids())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.obrigacao_tem_responsavel_atual(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obrigacao_tem_responsavel_atual(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.obrigacao_in_user_scope(p_obrigacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.is_app_org_wide()
    OR EXISTS (
      SELECT 1
      FROM public.obrigacoes o
      WHERE o.id = p_obrigacao_id
        AND o.responsavel_id IN (SELECT public.current_responsavel_ids())
    )
    OR public.obrigacao_tem_responsavel_atual(p_obrigacao_id);
$$;

DROP POLICY IF EXISTS obrigacoes_select_scoped ON public.obrigacoes;
CREATE POLICY obrigacoes_select_scoped ON public.obrigacoes
  FOR SELECT TO authenticated
  USING (
    public.is_app_org_wide()
    OR responsavel_id IN (SELECT public.current_responsavel_ids())
    OR public.obrigacao_tem_responsavel_atual(id)
  );

DROP POLICY IF EXISTS obrigacoes_update_scoped ON public.obrigacoes;
CREATE POLICY obrigacoes_update_scoped ON public.obrigacoes
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND NOT public.is_app_diretor()
      AND (
        responsavel_id IN (SELECT public.current_responsavel_ids())
        OR public.obrigacao_tem_responsavel_atual(id)
      )
    )
  )
  WITH CHECK (
    public.is_app_admin()
    OR (
      NOT public.is_app_viewer()
      AND NOT public.is_app_diretor()
      AND (
        responsavel_id IN (SELECT public.current_responsavel_ids())
        OR public.obrigacao_tem_responsavel_atual(id)
      )
    )
  );

ALTER TABLE public.obrigacao_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obrigacao_responsaveis_select_scoped ON public.obrigacao_responsaveis;
CREATE POLICY obrigacao_responsaveis_select_scoped ON public.obrigacao_responsaveis
  FOR SELECT TO authenticated
  USING (
    public.is_app_org_wide()
    OR public.obrigacao_tem_responsavel_atual(obrigacao_id)
  );

DROP POLICY IF EXISTS obrigacao_responsaveis_write_admin ON public.obrigacao_responsaveis;
CREATE POLICY obrigacao_responsaveis_write_admin ON public.obrigacao_responsaveis
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Job diário: status ATRASADO uma vez por obrigação; aviso para cada responsável.
create or replace function public.run_atrasos_diarios()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_day_start timestamptz := v_today::timestamp at time zone 'America/Sao_Paulo';
  v_obrigacoes int := 0;
  v_tarefas int := 0;
  v_notifs int := 0;
  v_titulo text;
  r record;
  u record;
begin
  for r in
    select
      o.id,
      o.responsavel_id,
      coalesce(nullif(btrim(a.nome), ''), 'Obrigação') as nome,
      coalesce(nullif(btrim(e.razao_social), ''), '') as empresa
    from public.obrigacoes o
    join public.atividades_modelo a on a.id = o.atividade_id
    join public.empresas e on e.id = o.empresa_id
    where o.status is distinct from 'ENTREGUE'
      and o.data_entrega is null
      and coalesce(o.prazo_fiscal, o.prazo_legal) is not null
      and coalesce(o.prazo_fiscal, o.prazo_legal) < v_today
      and o.status is distinct from 'ATRASADO'
  loop
    update public.obrigacoes
    set status = 'ATRASADO'
    where id = r.id;

    v_obrigacoes := v_obrigacoes + 1;

    for u in
      select distinct resp.auth_user_id
      from public.responsaveis resp
      where resp.auth_user_id is not null
        and (
          resp.id = r.responsavel_id
          or exists (
            select 1
            from public.obrigacao_responsaveis x
            where x.obrigacao_id = r.id
              and x.responsavel_id = resp.id
          )
        )
    loop
      if not exists (
        select 1
        from public.notificacoes n
        where n.user_id = u.auth_user_id
          and n.obrigacao_id = r.id
          and n.tipo = 'ATRASADO'
          and n.created_at >= v_day_start
      ) then
        insert into public.notificacoes (user_id, obrigacao_id, tipo, titulo, corpo)
        values (
          u.auth_user_id,
          r.id,
          'ATRASADO',
          r.nome,
          case
            when r.empresa = '' then 'Atrasada'
            else 'Atrasada · ' || r.empresa
          end
        );
        v_notifs := v_notifs + 1;
      end if;
    end loop;
  end loop;

  for r in
    select
      o.id,
      coalesce(o.prazo_fiscal, o.prazo_legal) as prazo,
      coalesce(nullif(btrim(a.nome), ''), 'Obrigação') as nome,
      coalesce(nullif(btrim(e.razao_social), ''), '') as empresa,
      u2.auth_user_id
    from public.obrigacoes o
    join public.atividades_modelo a on a.id = o.atividade_id
    join public.empresas e on e.id = o.empresa_id
    join lateral (
      select distinct resp.auth_user_id
      from public.responsaveis resp
      where resp.auth_user_id is not null
        and (
          resp.id = o.responsavel_id
          or exists (
            select 1
            from public.obrigacao_responsaveis x
            where x.obrigacao_id = o.id
              and x.responsavel_id = resp.id
          )
        )
    ) u2 on true
    where o.status is distinct from 'ENTREGUE'
      and o.data_entrega is null
      and coalesce(o.prazo_fiscal, o.prazo_legal) >= v_today
      and coalesce(o.prazo_fiscal, o.prazo_legal) <= v_today + 7
  loop
    if not exists (
      select 1
      from public.notificacoes n
      where n.user_id = r.auth_user_id
        and n.obrigacao_id = r.id
        and n.tipo = 'PRAZO_7D'
        and n.created_at >= v_day_start
    ) then
      insert into public.notificacoes (user_id, obrigacao_id, tipo, titulo, corpo)
      values (
        r.auth_user_id,
        r.id,
        'PRAZO_7D',
        r.nome,
        case
          when r.empresa = '' then 'Vence em ' || to_char(r.prazo, 'DD/MM/YYYY')
          else 'Vence em ' || to_char(r.prazo, 'DD/MM/YYYY') || ' · ' || r.empresa
        end
      );
      v_notifs := v_notifs + 1;
    end if;
  end loop;

  for r in
    select
      t.id,
      coalesce(nullif(btrim(t.titulo), ''), 'Tarefa') as nome,
      resp.auth_user_id
    from public.tarefas t
    left join public.responsaveis resp on resp.id = t.responsavel_id
    where t.status is distinct from 'ENTREGUE'
      and t.prazo is not null
      and t.prazo < v_today
      and t.status is distinct from 'ATRASADO'
  loop
    update public.tarefas
    set status = 'ATRASADO'
    where id = r.id;

    v_tarefas := v_tarefas + 1;
    v_titulo := r.nome;

    if r.auth_user_id is not null
      and not exists (
        select 1
        from public.notificacoes n
        where n.user_id = r.auth_user_id
          and n.tipo = 'ATRASADO'
          and n.obrigacao_id is null
          and n.created_at >= v_day_start
          and (
            n.titulo = v_titulo
            or n.corpo = 'tarefa:' || r.id::text
            or n.titulo = 'Tarefa atrasada: ' || v_titulo
          )
      )
    then
      insert into public.notificacoes (user_id, obrigacao_id, tipo, titulo, corpo)
      values (
        r.auth_user_id,
        null,
        'ATRASADO',
        v_titulo,
        'Atrasada'
      );
      v_notifs := v_notifs + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'atualizadas', v_obrigacoes + v_tarefas,
    'notificacoes_criadas', v_notifs,
    'obrigacoes_atualizadas', v_obrigacoes,
    'tarefas_atualizadas', v_tarefas
  );
end;
$$;

revoke all on function public.run_atrasos_diarios() from public;
revoke all on function public.run_atrasos_diarios() from anon;
revoke all on function public.run_atrasos_diarios() from authenticated;
grant execute on function public.run_atrasos_diarios() to service_role;

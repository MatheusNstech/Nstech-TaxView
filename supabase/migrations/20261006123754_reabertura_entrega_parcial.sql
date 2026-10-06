-- Reabertura guarda a data da entrega; entrega parcial e reabertas não viram ATRASADO.
alter table public.obrigacoes add column if not exists entrega_original date;
alter table public.tarefas add column if not exists entrega_original timestamptz;

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
    where o.status not in ('ENTREGUE', 'ENTREGA_PARCIAL')
      and o.entrega_original is null
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
    where o.status not in ('ENTREGUE', 'ENTREGA_PARCIAL')
      and o.entrega_original is null
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
    where t.status not in ('ENTREGUE', 'ENTREGA_PARCIAL')
      and t.entrega_original is null
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

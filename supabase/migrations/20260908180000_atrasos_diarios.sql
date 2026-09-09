-- Marca atrasos e avisa no sino. Agendado no Supabase, sem passar pela Vercel.

create extension if not exists pg_cron;

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
  r record;
begin
  for r in
    select
      o.id,
      resp.auth_user_id
    from public.obrigacoes o
    left join public.responsaveis resp on resp.id = o.responsavel_id
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

    if r.auth_user_id is not null
      and not exists (
        select 1
        from public.notificacoes n
        where n.user_id = r.auth_user_id
          and n.obrigacao_id = r.id
          and n.tipo = 'ATRASADO'
          and n.created_at >= v_day_start
      )
    then
      insert into public.notificacoes (user_id, obrigacao_id, tipo, titulo, corpo)
      values (
        r.auth_user_id,
        r.id,
        'ATRASADO',
        'Obrigação atrasada',
        'O prazo legal/fiscal foi ultrapassado.'
      );
      v_notifs := v_notifs + 1;
    end if;
  end loop;

  for r in
    select
      o.id,
      coalesce(o.prazo_fiscal, o.prazo_legal) as prazo,
      resp.auth_user_id
    from public.obrigacoes o
    left join public.responsaveis resp on resp.id = o.responsavel_id
    where o.status is distinct from 'ENTREGUE'
      and o.data_entrega is null
      and resp.auth_user_id is not null
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
        'Prazo em até 7 dias',
        'Obrigação vence em ' || to_char(r.prazo, 'YYYY-MM-DD')
      );
      v_notifs := v_notifs + 1;
    end if;
  end loop;

  for r in
    select
      t.id,
      t.titulo,
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

    if r.auth_user_id is not null
      and not exists (
        select 1
        from public.notificacoes n
        where n.user_id = r.auth_user_id
          and n.tipo = 'ATRASADO'
          and n.corpo = 'tarefa:' || r.id::text
          and n.created_at >= v_day_start
      )
    then
      insert into public.notificacoes (user_id, obrigacao_id, tipo, titulo, corpo)
      values (
        r.auth_user_id,
        null,
        'ATRASADO',
        'Tarefa atrasada: ' || coalesce(nullif(btrim(r.titulo), ''), 'Tarefa'),
        'tarefa:' || r.id::text
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

do $$
declare
  v_jobid bigint;
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    for v_jobid in
      select jobid from cron.job where jobname = 'atrasos-diarios'
    loop
      perform cron.unschedule(v_jobid);
    end loop;

    perform cron.schedule(
      'atrasos-diarios',
      '0 11 * * *',
      'select public.run_atrasos_diarios();'
    );
  end if;
end;
$$;

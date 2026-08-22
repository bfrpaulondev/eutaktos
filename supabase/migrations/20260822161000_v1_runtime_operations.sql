begin;

alter table public.eutaktos_sessions
  add column if not exists idle_timeout_ms bigint not null default 1800000
  check (idle_timeout_ms between 60000 and 86400000);

create or replace function public.eutaktos_rotate_session(
  p_session_id text,
  p_next_session_id text,
  p_rotated_at timestamptz
) returns table (
  id text,
  tenant_id text,
  actor_id text,
  issued_at timestamptz,
  idle_expires_at timestamptz,
  absolute_expires_at timestamptz,
  revoked_at timestamptz,
  idle_timeout_ms bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.eutaktos_sessions%rowtype;
  v_next_idle timestamptz;
begin
  if p_session_id is null or p_next_session_id is null or p_session_id = p_next_session_id then
    raise exception 'invalid session rotation' using errcode = '22023';
  end if;

  select * into v_current
    from public.eutaktos_sessions
   where public.eutaktos_sessions.id = p_session_id
   for update;

  if not found or v_current.revoked_at is not null or p_rotated_at >= v_current.idle_expires_at or p_rotated_at >= v_current.absolute_expires_at then
    raise exception 'inactive session' using errcode = '28000';
  end if;

  v_next_idle := least(
    p_rotated_at + make_interval(secs => (v_current.idle_timeout_ms / 1000)::integer),
    v_current.absolute_expires_at
  );

  update public.eutaktos_sessions
     set revoked_at = p_rotated_at
   where public.eutaktos_sessions.id = p_session_id;

  insert into public.eutaktos_sessions
    (id, tenant_id, actor_id, issued_at, idle_expires_at, absolute_expires_at, idle_timeout_ms)
  values
    (p_next_session_id, v_current.tenant_id, v_current.actor_id, p_rotated_at, v_next_idle, v_current.absolute_expires_at, v_current.idle_timeout_ms);

  return query
  select s.id, s.tenant_id, s.actor_id, s.issued_at, s.idle_expires_at, s.absolute_expires_at, s.revoked_at, s.idle_timeout_ms
    from public.eutaktos_sessions s
   where s.id = p_next_session_id;
end;
$$;

create or replace function public.eutaktos_claim_outbox(p_limit integer default 25)
returns table (
  tenant_id text,
  id text,
  event_type text,
  aggregate_id text,
  actor_id text,
  occurred_at timestamptz,
  schema_version integer,
  correlation_id text,
  payload jsonb,
  delivery_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'invalid outbox batch size' using errcode = '22023';
  end if;

  return query
  with claimed as (
    select o.tenant_id, o.id
      from public.eutaktos_outbox o
     where o.delivered_at is null
       and o.delivery_attempts < 10
     order by o.occurred_at, o.id
     limit p_limit
     for update skip locked
  ), updated as (
    update public.eutaktos_outbox o
       set delivery_attempts = o.delivery_attempts + 1,
           last_delivery_error = null
      from claimed c
     where o.tenant_id = c.tenant_id and o.id = c.id
    returning o.*
  )
  select u.tenant_id,u.id,u.event_type,u.aggregate_id,u.actor_id,u.occurred_at,u.schema_version,u.correlation_id,u.payload,u.delivery_attempts
    from updated u
   order by u.occurred_at,u.id;
end;
$$;

create or replace function public.eutaktos_mark_outbox_delivered(
  p_tenant_id text,
  p_id text,
  p_delivered_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count bigint;
begin
  update public.eutaktos_outbox
     set delivered_at = p_delivered_at,
         last_delivery_error = null
   where tenant_id = p_tenant_id and id = p_id and delivered_at is null;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.eutaktos_mark_outbox_failed(
  p_tenant_id text,
  p_id text,
  p_error_code text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count bigint;
begin
  if p_error_code not in ('provider-unconfigured','provider-unavailable','provider-rejected','invalid-event') then
    raise exception 'invalid outbox error code' using errcode = '22023';
  end if;
  update public.eutaktos_outbox
     set last_delivery_error = p_error_code
   where tenant_id = p_tenant_id and id = p_id and delivered_at is null;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.eutaktos_rotate_session(text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.eutaktos_claim_outbox(integer) from public, anon, authenticated;
revoke all on function public.eutaktos_mark_outbox_delivered(text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.eutaktos_mark_outbox_failed(text,text,text) from public, anon, authenticated;

grant execute on function public.eutaktos_rotate_session(text,text,timestamptz) to service_role;
grant execute on function public.eutaktos_claim_outbox(integer) to service_role;
grant execute on function public.eutaktos_mark_outbox_delivered(text,text,timestamptz) to service_role;
grant execute on function public.eutaktos_mark_outbox_failed(text,text,text) to service_role;

commit;

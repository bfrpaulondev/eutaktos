create or replace function public.eutaktos_consume_pilot_access_code(
  p_email text,
  p_code_hash text,
  p_session_id text,
  p_authenticated_at timestamptz
) returns table (
  session_id text,
  tenant_id text,
  actor_id text,
  mfa_required boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code public.eutaktos_pilot_access_codes%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_hash text := lower(btrim(coalesce(p_code_hash, '')));
begin
  if v_email = '' or length(v_email) > 254 or position('@' in v_email) <= 1 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if v_hash !~ '^[0-9a-f]{64}$' or p_authenticated_at is null then
    raise exception 'invalid pilot access exchange' using errcode = '22023';
  end if;
  if btrim(coalesce(p_session_id, '')) = '' or p_session_id !~ '^session-[A-Za-z0-9-]{1,100}$' then
    raise exception 'invalid session id' using errcode = '22023';
  end if;

  select c.* into v_code
    from public.eutaktos_pilot_access_codes as c
   where lower(btrim(c.email)) = v_email
     and c.consumed_at is null
     and c.expires_at > p_authenticated_at
     and c.attempts < c.max_attempts
   order by c.created_at desc
   limit 1
   for update;

  if not found then
    return;
  end if;

  if v_code.code_hash <> v_hash then
    update public.eutaktos_pilot_access_codes as c
       set attempts = c.attempts + 1
     where c.id = v_code.id;
    return;
  end if;

  if not exists (
    select 1
      from public.eutaktos_entities as e
     where e.tenant_id = v_code.tenant_id
       and e.entity_type = 'person'
       and e.entity_id = v_code.actor_id
       and coalesce((e.data->>'active')::boolean, false) = true
  ) then
    return;
  end if;

  update public.eutaktos_pilot_access_codes as c
     set consumed_at = p_authenticated_at,
         attempts = c.attempts + 1
   where c.id = v_code.id;

  insert into public.eutaktos_sessions
    (id, tenant_id, actor_id, issued_at, idle_expires_at, absolute_expires_at, last_seen_at, idle_timeout_ms)
  values
    (p_session_id, v_code.tenant_id, v_code.actor_id, p_authenticated_at,
     p_authenticated_at + interval '30 minutes', p_authenticated_at + interval '2 hours', p_authenticated_at, 1800000);

  insert into public.eutaktos_audit
    (tenant_id, id, resource_type, resource_id, action, actor_id, occurred_at, changed_fields)
  values
    (v_code.tenant_id, 'audit-' || gen_random_uuid()::text, 'session', p_session_id, 'create', v_code.actor_id, p_authenticated_at,
     array['authentication','temporary-pilot-code']);

  return query select p_session_id, v_code.tenant_id, v_code.actor_id, false;
end;
$$;

revoke all on function public.eutaktos_consume_pilot_access_code(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.eutaktos_consume_pilot_access_code(text,text,text,timestamptz) to service_role;

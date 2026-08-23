begin;

create table if not exists public.eutaktos_pilot_access_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null check (length(btrim(tenant_id)) between 1 and 200),
  actor_id text not null check (length(btrim(actor_id)) between 1 and 200),
  email text not null check (length(btrim(email)) between 3 and 254 and position('@' in email) > 1),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists eutaktos_pilot_access_codes_email_created_idx
  on public.eutaktos_pilot_access_codes (lower(btrim(email)), created_at desc);

alter table public.eutaktos_pilot_access_codes enable row level security;
revoke all on public.eutaktos_pilot_access_codes from anon, authenticated;
grant select, insert, update on public.eutaktos_pilot_access_codes to service_role;

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

  select * into v_code
    from public.eutaktos_pilot_access_codes
   where lower(btrim(email)) = v_email
     and consumed_at is null
   order by created_at desc
   limit 1
   for update;

  if not found then
    return;
  end if;
  if v_code.expires_at <= p_authenticated_at or v_code.attempts >= v_code.max_attempts then
    return;
  end if;

  if v_code.code_hash <> v_hash then
    update public.eutaktos_pilot_access_codes
       set attempts = attempts + 1
     where id = v_code.id;
    return;
  end if;

  if not exists (
    select 1 from public.eutaktos_entities
     where tenant_id = v_code.tenant_id
       and entity_type = 'person'
       and entity_id = v_code.actor_id
       and coalesce((data->>'active')::boolean, false) = true
  ) then
    return;
  end if;

  update public.eutaktos_pilot_access_codes
     set consumed_at = p_authenticated_at,
         attempts = attempts + 1
   where id = v_code.id;

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

commit;

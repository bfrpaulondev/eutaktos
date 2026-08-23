begin;

create table if not exists public.eutaktos_auth_identities (
  tenant_id text not null check (length(btrim(tenant_id)) between 1 and 200),
  actor_id text not null check (length(btrim(actor_id)) between 1 and 200),
  email text not null check (length(btrim(email)) between 3 and 254 and position('@' in email) > 1),
  auth_user_id uuid unique,
  enabled boolean not null default true,
  mfa_required boolean not null default false,
  created_at timestamptz not null default now(),
  linked_at timestamptz,
  primary key (tenant_id, actor_id),
  check (auth_user_id is not null or linked_at is null)
);

create unique index if not exists eutaktos_auth_identity_email_unique_idx
  on public.eutaktos_auth_identities (lower(btrim(email)));

alter table public.eutaktos_auth_identities enable row level security;
revoke all on public.eutaktos_auth_identities from anon, authenticated;
grant select, insert, update on public.eutaktos_auth_identities to service_role;

create or replace function public.eutaktos_preapprove_auth_identity(
  p_tenant_id text,
  p_actor_id text,
  p_email text,
  p_mfa_required boolean default false
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if btrim(coalesce(p_tenant_id, '')) = '' or btrim(coalesce(p_actor_id, '')) = '' then
    raise exception 'invalid identity' using errcode = '22023';
  end if;
  if v_email = '' or length(v_email) > 254 or position('@' in v_email) <= 1 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.eutaktos_entities
     where tenant_id = p_tenant_id
       and entity_type = 'person'
       and entity_id = p_actor_id
       and coalesce((data->>'active')::boolean, false) = true
  ) then
    raise exception 'active actor not found' using errcode = '22023';
  end if;

  insert into public.eutaktos_auth_identities
    (tenant_id, actor_id, email, enabled, mfa_required)
  values
    (p_tenant_id, p_actor_id, v_email, true, coalesce(p_mfa_required, false))
  on conflict (tenant_id, actor_id) do update
    set email = excluded.email,
        enabled = true,
        mfa_required = excluded.mfa_required
  where public.eutaktos_auth_identities.auth_user_id is null;
end;
$$;

create or replace function public.eutaktos_create_auth_session(
  p_email text,
  p_auth_user_id uuid,
  p_session_id text,
  p_authenticated_at timestamptz,
  p_aal text
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
  v_identity public.eutaktos_auth_identities%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_auth_user_id is null or btrim(coalesce(p_session_id, '')) = '' or p_authenticated_at is null then
    raise exception 'invalid authentication exchange' using errcode = '22023';
  end if;
  if p_session_id !~ '^session-[A-Za-z0-9-]{1,100}$' then
    raise exception 'invalid session id' using errcode = '22023';
  end if;
  if p_aal not in ('aal1','aal2') then
    raise exception 'invalid assurance level' using errcode = '22023';
  end if;

  select * into v_identity
    from public.eutaktos_auth_identities
   where lower(btrim(email)) = v_email
     and enabled = true
   for update;

  if not found then
    raise exception 'identity not authorized' using errcode = '28000';
  end if;
  if v_identity.auth_user_id is not null and v_identity.auth_user_id <> p_auth_user_id then
    raise exception 'identity binding mismatch' using errcode = '28000';
  end if;
  if v_identity.mfa_required and p_aal <> 'aal2' then
    raise exception 'mfa required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.eutaktos_entities
     where tenant_id = v_identity.tenant_id
       and entity_type = 'person'
       and entity_id = v_identity.actor_id
       and coalesce((data->>'active')::boolean, false) = true
  ) then
    raise exception 'actor unavailable' using errcode = '28000';
  end if;

  if v_identity.auth_user_id is null then
    update public.eutaktos_auth_identities
       set auth_user_id = p_auth_user_id,
           linked_at = p_authenticated_at
     where tenant_id = v_identity.tenant_id and actor_id = v_identity.actor_id;
  end if;

  insert into public.eutaktos_sessions
    (id, tenant_id, actor_id, issued_at, idle_expires_at, absolute_expires_at, last_seen_at, idle_timeout_ms)
  values
    (p_session_id, v_identity.tenant_id, v_identity.actor_id, p_authenticated_at,
     p_authenticated_at + interval '30 minutes', p_authenticated_at + interval '12 hours', p_authenticated_at, 1800000);

  insert into public.eutaktos_audit
    (tenant_id, id, resource_type, resource_id, action, actor_id, occurred_at, changed_fields)
  values
    (v_identity.tenant_id, 'audit-' || gen_random_uuid()::text, 'session', p_session_id, 'create', v_identity.actor_id, p_authenticated_at,
     array['authentication','assurance']);

  return query select p_session_id, v_identity.tenant_id, v_identity.actor_id, v_identity.mfa_required;
end;
$$;

revoke all on function public.eutaktos_preapprove_auth_identity(text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.eutaktos_create_auth_session(text,uuid,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.eutaktos_preapprove_auth_identity(text,text,text,boolean) to service_role;
grant execute on function public.eutaktos_create_auth_session(text,uuid,text,timestamptz,text) to service_role;

commit;

begin;

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

  select i.* into v_identity
    from public.eutaktos_auth_identities as i
   where lower(btrim(i.email)) = v_email
     and i.enabled = true
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
    select 1 from public.eutaktos_entities as e
     where e.tenant_id = v_identity.tenant_id
       and e.entity_type = 'person'
       and e.entity_id = v_identity.actor_id
       and coalesce((e.data->>'active')::boolean, false) = true
  ) then
    raise exception 'actor unavailable' using errcode = '28000';
  end if;

  if v_identity.auth_user_id is null then
    update public.eutaktos_auth_identities as i
       set auth_user_id = p_auth_user_id,
           linked_at = p_authenticated_at
     where i.tenant_id = v_identity.tenant_id
       and i.actor_id = v_identity.actor_id;
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

revoke all on function public.eutaktos_create_auth_session(text,uuid,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.eutaktos_create_auth_session(text,uuid,text,timestamptz,text) to service_role;

commit;

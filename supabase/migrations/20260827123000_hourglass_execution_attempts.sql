begin;

create table if not exists public.eutaktos_hourglass_execution_attempts (
  tenant_id text not null,
  execution_id text not null,
  actor_id text not null,
  source_digest text not null,
  confirmation_digest text not null,
  counts jsonb not null,
  initiated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '30 minutes'),
  primary key (tenant_id, execution_id),
  constraint eutaktos_hourglass_execution_source_digest_chk check (source_digest ~ '^[0-9a-f]{64}$'),
  constraint eutaktos_hourglass_execution_confirmation_digest_chk check (confirmation_digest ~ '^[0-9a-f]{64}$'),
  constraint eutaktos_hourglass_execution_counts_chk check (
    jsonb_typeof(counts) = 'object'
    and jsonb_typeof(counts->'create') = 'number'
    and jsonb_typeof(counts->'unchanged') = 'number'
    and jsonb_typeof(counts->'conflict') = 'number'
  )
);

revoke all on public.eutaktos_hourglass_execution_attempts from public, anon, authenticated;
grant select on public.eutaktos_hourglass_execution_attempts to service_role;

create or replace function public.eutaktos_reserve_hourglass_execution_attempt(
  p_tenant_id text,
  p_execution_id text,
  p_actor_id text,
  p_source_digest text,
  p_confirmation_digest text,
  p_counts jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.eutaktos_hourglass_execution_attempts%rowtype;
begin
  if btrim(coalesce(p_tenant_id, '')) = ''
     or btrim(coalesce(p_execution_id, '')) = ''
     or btrim(coalesce(p_actor_id, '')) = ''
     or coalesce(p_source_digest, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_confirmation_digest, '') !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(coalesce(p_counts, 'null'::jsonb)) <> 'object' then
    raise exception 'invalid Hourglass execution attempt' using errcode = '22023';
  end if;

  insert into public.eutaktos_hourglass_execution_attempts (
    tenant_id, execution_id, actor_id, source_digest, confirmation_digest, counts
  ) values (
    p_tenant_id, p_execution_id, p_actor_id, p_source_digest, p_confirmation_digest, p_counts
  )
  on conflict (tenant_id, execution_id) do nothing;

  select * into v_row
    from public.eutaktos_hourglass_execution_attempts
   where tenant_id = p_tenant_id
     and execution_id = p_execution_id;

  if v_row.execution_id is null then
    raise exception 'Hourglass execution attempt unavailable' using errcode = 'P0002';
  end if;
  if v_row.actor_id <> p_actor_id or v_row.source_digest <> p_source_digest then
    raise exception 'Hourglass execution attempt identity mismatch' using errcode = 'P0004';
  end if;

  return jsonb_build_object(
    'tenantId', v_row.tenant_id,
    'executionId', v_row.execution_id,
    'actorId', v_row.actor_id,
    'sourceDigest', v_row.source_digest,
    'confirmationDigest', v_row.confirmation_digest,
    'counts', v_row.counts,
    'initiatedAt', to_char(v_row.initiated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt', to_char(v_row.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

create or replace function public.eutaktos_get_hourglass_execution_attempt(
  p_tenant_id text,
  p_execution_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.eutaktos_hourglass_execution_attempts%rowtype;
begin
  if btrim(coalesce(p_tenant_id, '')) = '' or btrim(coalesce(p_execution_id, '')) = '' then
    raise exception 'invalid Hourglass execution attempt identity' using errcode = '22023';
  end if;

  select * into v_row
    from public.eutaktos_hourglass_execution_attempts
   where tenant_id = p_tenant_id
     and execution_id = p_execution_id;

  if v_row.execution_id is null then return null; end if;

  return jsonb_build_object(
    'tenantId', v_row.tenant_id,
    'executionId', v_row.execution_id,
    'actorId', v_row.actor_id,
    'sourceDigest', v_row.source_digest,
    'confirmationDigest', v_row.confirmation_digest,
    'counts', v_row.counts,
    'initiatedAt', to_char(v_row.initiated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt', to_char(v_row.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

revoke all on function public.eutaktos_reserve_hourglass_execution_attempt(text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.eutaktos_get_hourglass_execution_attempt(text,text) from public, anon, authenticated;
grant execute on function public.eutaktos_reserve_hourglass_execution_attempt(text,text,text,text,text,jsonb) to service_role;
grant execute on function public.eutaktos_get_hourglass_execution_attempt(text,text) to service_role;

commit;

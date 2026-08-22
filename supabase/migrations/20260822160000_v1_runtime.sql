begin;

create table if not exists public.eutaktos_entities (
  tenant_id text not null check (length(btrim(tenant_id)) between 1 and 200),
  entity_type text not null check (length(btrim(entity_type)) between 1 and 80),
  entity_id text not null check (length(btrim(entity_id)) between 1 and 200),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, entity_type, entity_id)
);

create table if not exists public.eutaktos_audit (
  tenant_id text not null,
  id text not null,
  resource_type text not null,
  resource_id text not null,
  action text not null check (action in ('create','update','delete','grant','revoke')),
  actor_id text not null,
  occurred_at timestamptz not null,
  changed_fields text[] not null default '{}',
  primary key (tenant_id, id)
);

create index if not exists eutaktos_audit_tenant_time_idx
  on public.eutaktos_audit (tenant_id, occurred_at desc, id desc);
create index if not exists eutaktos_audit_resource_idx
  on public.eutaktos_audit (tenant_id, resource_type, resource_id, occurred_at desc);

create table if not exists public.eutaktos_outbox (
  tenant_id text not null,
  id text not null,
  event_type text not null,
  aggregate_id text not null,
  actor_id text not null,
  occurred_at timestamptz not null,
  schema_version integer not null check (schema_version > 0),
  correlation_id text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  delivered_at timestamptz,
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  last_delivery_error text,
  primary key (tenant_id, id)
);

create index if not exists eutaktos_outbox_pending_idx
  on public.eutaktos_outbox (tenant_id, occurred_at, id)
  where delivered_at is null;

create table if not exists public.eutaktos_access_grants (
  tenant_id text not null,
  id text not null,
  subject_id text not null,
  capability text not null,
  granted_by text not null,
  granted_at timestamptz not null,
  revoked_at timestamptz,
  primary key (tenant_id, id)
);

create unique index if not exists eutaktos_access_active_unique_idx
  on public.eutaktos_access_grants (tenant_id, subject_id, capability)
  where revoked_at is null;
create index if not exists eutaktos_access_subject_idx
  on public.eutaktos_access_grants (tenant_id, subject_id, granted_at desc);

create table if not exists public.eutaktos_sessions (
  id text primary key check (id ~ '^[A-Za-z0-9._~-]{1,200}$'),
  tenant_id text not null,
  actor_id text not null,
  issued_at timestamptz not null,
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  check (idle_expires_at > issued_at),
  check (absolute_expires_at > issued_at)
);

create index if not exists eutaktos_sessions_identity_idx
  on public.eutaktos_sessions (tenant_id, actor_id)
  where revoked_at is null;

alter table public.eutaktos_entities enable row level security;
alter table public.eutaktos_audit enable row level security;
alter table public.eutaktos_outbox enable row level security;
alter table public.eutaktos_access_grants enable row level security;
alter table public.eutaktos_sessions enable row level security;

revoke all on public.eutaktos_entities from anon, authenticated;
revoke all on public.eutaktos_audit from anon, authenticated;
revoke all on public.eutaktos_outbox from anon, authenticated;
revoke all on public.eutaktos_access_grants from anon, authenticated;
revoke all on public.eutaktos_sessions from anon, authenticated;

grant select, insert, update, delete on public.eutaktos_entities to service_role;
grant select, insert on public.eutaktos_audit to service_role;
grant select, insert, update on public.eutaktos_outbox to service_role;
grant select, insert, update on public.eutaktos_access_grants to service_role;
grant select, insert, update on public.eutaktos_sessions to service_role;

create or replace function public.eutaktos_apply_entity_change(
  p_tenant_id text,
  p_entity_type text,
  p_entity_id text,
  p_data jsonb,
  p_expected_version bigint,
  p_audit jsonb,
  p_event jsonb
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version bigint;
  v_fields text[];
begin
  if btrim(coalesce(p_tenant_id, '')) = '' or btrim(coalesce(p_entity_type, '')) = '' or btrim(coalesce(p_entity_id, '')) = '' then
    raise exception 'invalid entity identity' using errcode = '22023';
  end if;
  if jsonb_typeof(p_data) <> 'object' or p_data->>'tenantId' <> p_tenant_id or p_data->>'id' <> p_entity_id then
    raise exception 'entity identity mismatch' using errcode = '22023';
  end if;
  if p_audit->>'tenantId' <> p_tenant_id or p_audit->>'resourceId' <> p_entity_id then
    raise exception 'audit identity mismatch' using errcode = '22023';
  end if;
  if p_event->>'tenantId' <> p_tenant_id or p_event->>'aggregateId' <> p_entity_id then
    raise exception 'event identity mismatch' using errcode = '22023';
  end if;

  if p_expected_version is null then
    insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
    values (p_tenant_id, p_entity_type, p_entity_id, p_data)
    returning version into v_version;
  else
    update public.eutaktos_entities
       set data = p_data, version = version + 1, updated_at = now()
     where tenant_id = p_tenant_id
       and entity_type = p_entity_type
       and entity_id = p_entity_id
       and version = p_expected_version
    returning version into v_version;
    if v_version is null then
      raise exception 'concurrent entity modification' using errcode = '40001';
    end if;
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_fields
    from jsonb_array_elements_text(coalesce(p_audit->'changedFields', '[]'::jsonb));

  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values
    (p_tenant_id,p_audit->>'id',p_audit->>'resourceType',p_audit->>'resourceId',p_audit->>'action',p_audit->>'actorId',(p_audit->>'occurredAt')::timestamptz,v_fields);

  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,correlation_id,payload)
  values
    (p_tenant_id,p_event->>'id',p_event->>'type',p_event->>'aggregateId',p_event->>'actorId',(p_event->>'occurredAt')::timestamptz,(p_event->>'schemaVersion')::integer,nullif(p_event->>'correlationId',''),coalesce(p_event->'payload','{}'::jsonb));

  return v_version;
end;
$$;

create or replace function public.eutaktos_delete_entity_change(
  p_tenant_id text,
  p_entity_type text,
  p_entity_id text,
  p_expected_version bigint,
  p_audit jsonb,
  p_event jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted bigint;
  v_fields text[];
begin
  if p_expected_version is null then raise exception 'expected version is required' using errcode = '22023'; end if;
  delete from public.eutaktos_entities
   where tenant_id = p_tenant_id and entity_type = p_entity_type and entity_id = p_entity_id and version = p_expected_version;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception 'concurrent entity modification' using errcode = '40001'; end if;
  if p_audit->>'tenantId' <> p_tenant_id or p_audit->>'resourceId' <> p_entity_id then raise exception 'audit identity mismatch' using errcode='22023'; end if;
  if p_event->>'tenantId' <> p_tenant_id or p_event->>'aggregateId' <> p_entity_id then raise exception 'event identity mismatch' using errcode='22023'; end if;
  select coalesce(array_agg(value order by value), '{}'::text[]) into v_fields from jsonb_array_elements_text(coalesce(p_audit->'changedFields','[]'::jsonb));
  insert into public.eutaktos_audit (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values (p_tenant_id,p_audit->>'id',p_audit->>'resourceType',p_audit->>'resourceId',p_audit->>'action',p_audit->>'actorId',(p_audit->>'occurredAt')::timestamptz,v_fields);
  insert into public.eutaktos_outbox (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,correlation_id,payload)
  values (p_tenant_id,p_event->>'id',p_event->>'type',p_event->>'aggregateId',p_event->>'actorId',(p_event->>'occurredAt')::timestamptz,(p_event->>'schemaVersion')::integer,nullif(p_event->>'correlationId',''),coalesce(p_event->'payload','{}'::jsonb));
end;
$$;

create or replace function public.eutaktos_apply_grant_change(
  p_tenant_id text,
  p_grant jsonb,
  p_audit jsonb,
  p_event jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fields text[];
begin
  if p_grant->>'tenantId' <> p_tenant_id then raise exception 'grant tenant mismatch' using errcode='22023'; end if;
  if p_audit->>'tenantId' <> p_tenant_id or p_event->>'tenantId' <> p_tenant_id then raise exception 'change tenant mismatch' using errcode='22023'; end if;
  insert into public.eutaktos_access_grants (tenant_id,id,subject_id,capability,granted_by,granted_at,revoked_at)
  values (p_tenant_id,p_grant->>'id',p_grant->>'subjectId',p_grant->>'capability',p_grant->>'grantedBy',(p_grant->>'grantedAt')::timestamptz,nullif(p_grant->>'revokedAt','')::timestamptz)
  on conflict (tenant_id,id) do update set revoked_at = excluded.revoked_at
  where public.eutaktos_access_grants.subject_id = excluded.subject_id
    and public.eutaktos_access_grants.capability = excluded.capability;
  select coalesce(array_agg(value order by value), '{}'::text[]) into v_fields from jsonb_array_elements_text(coalesce(p_audit->'changedFields','[]'::jsonb));
  insert into public.eutaktos_audit (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values (p_tenant_id,p_audit->>'id',p_audit->>'resourceType',p_audit->>'resourceId',p_audit->>'action',p_audit->>'actorId',(p_audit->>'occurredAt')::timestamptz,v_fields);
  insert into public.eutaktos_outbox (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,correlation_id,payload)
  values (p_tenant_id,p_event->>'id',p_event->>'type',p_event->>'aggregateId',p_event->>'actorId',(p_event->>'occurredAt')::timestamptz,(p_event->>'schemaVersion')::integer,nullif(p_event->>'correlationId',''),coalesce(p_event->'payload','{}'::jsonb));
end;
$$;

revoke all on function public.eutaktos_apply_entity_change(text,text,text,jsonb,bigint,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.eutaktos_delete_entity_change(text,text,text,bigint,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.eutaktos_apply_grant_change(text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.eutaktos_apply_entity_change(text,text,text,jsonb,bigint,jsonb,jsonb) to service_role;
grant execute on function public.eutaktos_delete_entity_change(text,text,text,bigint,jsonb,jsonb) to service_role;
grant execute on function public.eutaktos_apply_grant_change(text,jsonb,jsonb,jsonb) to service_role;

commit;

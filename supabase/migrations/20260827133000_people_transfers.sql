begin;

create table if not exists public.eutaktos_people_transfers (
  id text primary key check (length(btrim(id)) between 1 and 200),
  source_tenant_id text not null check (length(btrim(source_tenant_id)) between 1 and 200),
  client_mutation_id text not null check (length(btrim(client_mutation_id)) between 1 and 120),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by text not null check (length(btrim(created_by)) between 1 and 200),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  cancelled_at timestamptz,
  received_at timestamptz,
  received_by_tenant_id text,
  received_by_actor_id text,
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  created_person_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(created_person_ids) = 'array'),
  constraint eutaktos_people_transfers_expiry check (expires_at > created_at),
  constraint eutaktos_people_transfers_received_pair check (
    (received_at is null and received_by_tenant_id is null and received_by_actor_id is null)
    or
    (received_at is not null and received_by_tenant_id is not null and received_by_actor_id is not null)
  ),
  unique (source_tenant_id, client_mutation_id)
);

create index if not exists eutaktos_people_transfers_source_idx
  on public.eutaktos_people_transfers (source_tenant_id, created_at desc, id desc);

alter table public.eutaktos_people_transfers enable row level security;
revoke all on public.eutaktos_people_transfers from anon, authenticated;
grant select, insert, update on public.eutaktos_people_transfers to service_role;

create or replace function public.eutaktos_create_people_transfer(
  p_transfer jsonb,
  p_audit jsonb,
  p_event jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source_tenant_id text := p_transfer->>'sourceTenantId';
  v_transfer_id text := p_transfer->>'id';
  v_people jsonb := p_transfer->'payload'->'people';
  v_fields text[];
begin
  if btrim(coalesce(v_source_tenant_id, '')) = '' or btrim(coalesce(v_transfer_id, '')) = '' then
    raise exception 'invalid transfer identity' using errcode = '22023';
  end if;
  if p_transfer->'payload'->>'contractVersion' <> 'people-transfer-package-v1'
     or jsonb_typeof(v_people) <> 'array'
     or jsonb_array_length(v_people) not between 1 and 20 then
    raise exception 'invalid transfer payload' using errcode = '22023';
  end if;
  if coalesce(p_transfer->>'tokenHash', '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid transfer token hash' using errcode = '22023';
  end if;
  if p_audit->>'tenantId' <> v_source_tenant_id
     or p_audit->>'resourceId' <> v_transfer_id
     or p_audit->>'resourceType' <> 'people-transfer'
     or p_event->>'tenantId' <> v_source_tenant_id
     or p_event->>'aggregateId' <> v_transfer_id then
    raise exception 'transfer evidence identity mismatch' using errcode = '22023';
  end if;

  insert into public.eutaktos_people_transfers (
    id, source_tenant_id, client_mutation_id, token_hash, payload,
    created_by, created_at, expires_at, history
  ) values (
    v_transfer_id,
    v_source_tenant_id,
    p_transfer->>'clientMutationId',
    p_transfer->>'tokenHash',
    p_transfer->'payload',
    p_transfer->>'createdBy',
    (p_transfer->>'createdAt')::timestamptz,
    (p_transfer->>'expiresAt')::timestamptz,
    jsonb_build_array(jsonb_build_object('action','created','occurredAt',p_transfer->>'createdAt'))
  );

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_fields
    from jsonb_array_elements_text(coalesce(p_audit->'changedFields', '[]'::jsonb));
  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values (
    v_source_tenant_id,p_audit->>'id',p_audit->>'resourceType',p_audit->>'resourceId',p_audit->>'action',
    p_audit->>'actorId',(p_audit->>'occurredAt')::timestamptz,v_fields
  );
  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,correlation_id,payload)
  values (
    v_source_tenant_id,p_event->>'id',p_event->>'type',p_event->>'aggregateId',p_event->>'actorId',
    (p_event->>'occurredAt')::timestamptz,(p_event->>'schemaVersion')::integer,
    nullif(p_event->>'correlationId',''),coalesce(p_event->'payload','{}'::jsonb)
  );

  return jsonb_build_object('outcome','created','transferId',v_transfer_id);
end;
$$;

create or replace function public.eutaktos_rotate_people_transfer_token(
  p_source_tenant_id text,
  p_transfer_id text,
  p_token_hash text,
  p_occurred_at timestamptz,
  p_audit jsonb,
  p_event jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.eutaktos_people_transfers%rowtype;
  v_fields text[];
begin
  select * into v_row from public.eutaktos_people_transfers
   where id = p_transfer_id and source_tenant_id = p_source_tenant_id
   for update;
  if not found then raise exception 'transfer not found' using errcode = 'PT404'; end if;
  if v_row.cancelled_at is not null or v_row.received_at is not null or v_row.expires_at <= p_occurred_at then
    raise exception 'transfer is not pending' using errcode = 'PT423';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid transfer token hash' using errcode = '22023'; end if;
  if p_audit->>'tenantId' <> p_source_tenant_id or p_audit->>'resourceId' <> p_transfer_id
     or p_event->>'tenantId' <> p_source_tenant_id or p_event->>'aggregateId' <> p_transfer_id then
    raise exception 'transfer evidence identity mismatch' using errcode = '22023';
  end if;

  update public.eutaktos_people_transfers
     set token_hash = p_token_hash,
         history = history || jsonb_build_array(jsonb_build_object('action','token-rotated','occurredAt',p_occurred_at))
   where id = p_transfer_id;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_fields from jsonb_array_elements_text(coalesce(p_audit->'changedFields','[]'::jsonb));
  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values (p_source_tenant_id,p_audit->>'id',p_audit->>'resourceType',p_audit->>'resourceId',p_audit->>'action',p_audit->>'actorId',(p_audit->>'occurredAt')::timestamptz,v_fields);
  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,correlation_id,payload)
  values (p_source_tenant_id,p_event->>'id',p_event->>'type',p_event->>'aggregateId',p_event->>'actorId',(p_event->>'occurredAt')::timestamptz,(p_event->>'schemaVersion')::integer,nullif(p_event->>'correlationId',''),coalesce(p_event->'payload','{}'::jsonb));

  return jsonb_build_object('outcome','rotated','transferId',p_transfer_id);
end;
$$;

create or replace function public.eutaktos_cancel_people_transfer(
  p_source_tenant_id text,
  p_transfer_id text,
  p_occurred_at timestamptz,
  p_audit jsonb,
  p_event jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.eutaktos_people_transfers%rowtype;
  v_fields text[];
begin
  select * into v_row from public.eutaktos_people_transfers
   where id = p_transfer_id and source_tenant_id = p_source_tenant_id
   for update;
  if not found then raise exception 'transfer not found' using errcode = 'PT404'; end if;
  if v_row.cancelled_at is not null then
    return jsonb_build_object('outcome','already-cancelled','transferId',p_transfer_id);
  end if;
  if v_row.received_at is not null then raise exception 'received transfer cannot be cancelled' using errcode = 'PT423'; end if;
  if p_audit->>'tenantId' <> p_source_tenant_id or p_audit->>'resourceId' <> p_transfer_id
     or p_event->>'tenantId' <> p_source_tenant_id or p_event->>'aggregateId' <> p_transfer_id then
    raise exception 'transfer evidence identity mismatch' using errcode = '22023';
  end if;

  update public.eutaktos_people_transfers
     set cancelled_at = p_occurred_at,
         history = history || jsonb_build_array(jsonb_build_object('action','cancelled','occurredAt',p_occurred_at))
   where id = p_transfer_id;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_fields from jsonb_array_elements_text(coalesce(p_audit->'changedFields','[]'::jsonb));
  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values (p_source_tenant_id,p_audit->>'id',p_audit->>'resourceType',p_audit->>'resourceId',p_audit->>'action',p_audit->>'actorId',(p_audit->>'occurredAt')::timestamptz,v_fields);
  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,correlation_id,payload)
  values (p_source_tenant_id,p_event->>'id',p_event->>'type',p_event->>'aggregateId',p_event->>'actorId',(p_event->>'occurredAt')::timestamptz,(p_event->>'schemaVersion')::integer,nullif(p_event->>'correlationId',''),coalesce(p_event->'payload','{}'::jsonb));

  return jsonb_build_object('outcome','cancelled','transferId',p_transfer_id);
end;
$$;

create or replace function public.eutaktos_receive_people_transfer(
  p_token_hash text,
  p_destination_tenant_id text,
  p_actor_id text,
  p_occurred_at timestamptz,
  p_audit jsonb,
  p_event jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.eutaktos_people_transfers%rowtype;
  v_person jsonb;
  v_ordinal integer;
  v_person_id text;
  v_person_data jsonb;
  v_created_ids jsonb := '[]'::jsonb;
  v_changed_fields text[];
  v_fields text[];
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid transfer token' using errcode = 'PT404'; end if;
  select * into v_row from public.eutaktos_people_transfers where token_hash = p_token_hash for update;
  if not found then raise exception 'transfer not found' using errcode = 'PT404'; end if;
  if v_row.source_tenant_id = p_destination_tenant_id then raise exception 'same-tenant transfer is not allowed' using errcode = 'PT422'; end if;
  if v_row.cancelled_at is not null or v_row.expires_at <= p_occurred_at then raise exception 'transfer is not available' using errcode = 'PT410'; end if;
  if v_row.received_at is not null then
    if v_row.received_by_tenant_id = p_destination_tenant_id then
      return jsonb_build_object('outcome','already-received','transferId',v_row.id,'createdPersonIds',v_row.created_person_ids);
    end if;
    raise exception 'transfer already received' using errcode = 'PT409';
  end if;
  if p_audit->>'tenantId' <> p_destination_tenant_id or p_audit->>'resourceId' <> v_row.id
     or p_event->>'tenantId' <> p_destination_tenant_id or p_event->>'aggregateId' <> v_row.id then
    raise exception 'transfer evidence identity mismatch' using errcode = '22023';
  end if;

  for v_person, v_ordinal in
    select value, ordinality::integer
      from jsonb_array_elements(v_row.payload->'people') with ordinality
  loop
    if jsonb_typeof(v_person) <> 'object' or btrim(coalesce(v_person->>'displayName','')) = '' then
      raise exception 'invalid stored transfer person' using errcode = '22023';
    end if;
    v_person_id := 'person-transfer-' || replace(v_row.id, '-', '') || '-' || v_ordinal::text;
    v_person_data := jsonb_build_object(
      'id', v_person_id,
      'tenantId', p_destination_tenant_id,
      'displayName', v_person->>'displayName',
      'active', false,
      'availability', '[]'::jsonb,
      'eligibility', '[]'::jsonb
    );
    if v_person ? 'preferredLocale' then v_person_data := v_person_data || jsonb_build_object('preferredLocale',v_person->>'preferredLocale'); end if;
    if v_person ? 'ordinaryContact' then v_person_data := v_person_data || jsonb_build_object('ordinaryContact',v_person->'ordinaryContact'); end if;

    insert into public.eutaktos_entities (tenant_id,entity_type,entity_id,data)
    values (p_destination_tenant_id,'person',v_person_id,v_person_data);

    v_changed_fields := array['active','displayName'];
    if v_person ? 'preferredLocale' then v_changed_fields := array_append(v_changed_fields,'preferredLocale'); end if;
    if v_person ? 'ordinaryContact' then v_changed_fields := array_append(v_changed_fields,'ordinaryContact'); end if;
    select array_agg(value order by value) into v_changed_fields from unnest(v_changed_fields) as value;

    insert into public.eutaktos_audit
      (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
    values (
      p_destination_tenant_id,
      'audit-transfer-person-' || replace(v_row.id,'-','') || '-' || v_ordinal::text,
      'person',v_person_id,'create',p_actor_id,p_occurred_at,v_changed_fields
    );
    insert into public.eutaktos_outbox
      (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,payload)
    values (
      p_destination_tenant_id,
      'event-transfer-person-' || replace(v_row.id,'-','') || '-' || v_ordinal::text,
      'PersonCreated',v_person_id,p_actor_id,p_occurred_at,1,'{}'::jsonb
    );
    v_created_ids := v_created_ids || jsonb_build_array(v_person_id);
  end loop;

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_fields from jsonb_array_elements_text(coalesce(p_audit->'changedFields','[]'::jsonb));
  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values (p_destination_tenant_id,p_audit->>'id',p_audit->>'resourceType',p_audit->>'resourceId',p_audit->>'action',p_audit->>'actorId',(p_audit->>'occurredAt')::timestamptz,v_fields);
  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,correlation_id,payload)
  values (p_destination_tenant_id,p_event->>'id',p_event->>'type',p_event->>'aggregateId',p_event->>'actorId',(p_event->>'occurredAt')::timestamptz,(p_event->>'schemaVersion')::integer,nullif(p_event->>'correlationId',''),coalesce(p_event->'payload','{}'::jsonb));

  update public.eutaktos_people_transfers
     set received_at = p_occurred_at,
         received_by_tenant_id = p_destination_tenant_id,
         received_by_actor_id = p_actor_id,
         created_person_ids = v_created_ids,
         history = history || jsonb_build_array(jsonb_build_object('action','received','occurredAt',p_occurred_at))
   where id = v_row.id;

  return jsonb_build_object('outcome','received','transferId',v_row.id,'createdPersonIds',v_created_ids);
end;
$$;

revoke all on function public.eutaktos_create_people_transfer(jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.eutaktos_rotate_people_transfer_token(text,text,text,timestamptz,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.eutaktos_cancel_people_transfer(text,text,timestamptz,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.eutaktos_receive_people_transfer(text,text,text,timestamptz,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.eutaktos_create_people_transfer(jsonb,jsonb,jsonb) to service_role;
grant execute on function public.eutaktos_rotate_people_transfer_token(text,text,text,timestamptz,jsonb,jsonb) to service_role;
grant execute on function public.eutaktos_cancel_people_transfer(text,text,timestamptz,jsonb,jsonb) to service_role;
grant execute on function public.eutaktos_receive_people_transfer(text,text,text,timestamptz,jsonb,jsonb) to service_role;

commit;

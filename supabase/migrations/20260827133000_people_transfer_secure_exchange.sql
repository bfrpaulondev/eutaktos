begin;

create table if not exists public.eutaktos_people_transfers (
  id text primary key check (id ~ '^people-transfer-[A-Za-z0-9-]{1,100}$'),
  source_tenant_id text not null check (length(btrim(source_tenant_id)) between 1 and 200),
  source_actor_id text not null check (length(btrim(source_actor_id)) between 1 and 200),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'array' and jsonb_array_length(payload) between 1 and 25),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by_tenant_id text,
  claimed_by_actor_id text,
  claim_result jsonb,
  cancelled_at timestamptz,
  check (expires_at > created_at),
  check ((claimed_at is null and claimed_by_tenant_id is null and claimed_by_actor_id is null and claim_result is null)
      or (claimed_at is not null and claimed_by_tenant_id is not null and claimed_by_actor_id is not null and jsonb_typeof(claim_result) = 'array')),
  check (claimed_at is null or cancelled_at is null)
);

create index if not exists eutaktos_people_transfers_source_time_idx
  on public.eutaktos_people_transfers (source_tenant_id, created_at desc, id desc);
create index if not exists eutaktos_people_transfers_expiry_idx
  on public.eutaktos_people_transfers (expires_at)
  where claimed_at is null and cancelled_at is null;

alter table public.eutaktos_people_transfers enable row level security;
revoke all on public.eutaktos_people_transfers from anon, authenticated;
grant select, insert, update on public.eutaktos_people_transfers to service_role;

create or replace function public.eutaktos_create_people_transfer(
  p_transfer_id text,
  p_source_tenant_id text,
  p_source_actor_id text,
  p_token_hash text,
  p_payload jsonb,
  p_created_at timestamptz,
  p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_transfer_id !~ '^people-transfer-[A-Za-z0-9-]{1,100}$'
     or btrim(coalesce(p_source_tenant_id, '')) = ''
     or btrim(coalesce(p_source_actor_id, '')) = ''
     or lower(btrim(coalesce(p_token_hash, ''))) !~ '^[0-9a-f]{64}$'
     or p_created_at is null
     or p_expires_at is null
     or p_expires_at <= p_created_at
     or p_expires_at > p_created_at + interval '72 hours'
     or jsonb_typeof(p_payload) <> 'array'
     or jsonb_array_length(p_payload) not between 1 and 25 then
    raise exception 'invalid people transfer' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_payload) item
     where jsonb_typeof(item) <> 'object'
        or btrim(coalesce(item->>'displayName', '')) = ''
        or length(item->>'displayName') > 120
        or (item ? 'preferredLocale' and (jsonb_typeof(item->'preferredLocale') <> 'string' or length(item->>'preferredLocale') > 40))
        or (item ? 'ordinaryContact' and jsonb_typeof(item->'ordinaryContact') <> 'object')
        or item ?| array['tenantId','actorId','emergencyContacts','eligibility','availability','labels','externalIds','responsibilities','households','serviceGroups','archive','audit']
  ) then
    raise exception 'invalid people transfer payload' using errcode = '22023';
  end if;

  insert into public.eutaktos_people_transfers
    (id, source_tenant_id, source_actor_id, token_hash, payload, created_at, expires_at)
  values
    (p_transfer_id, p_source_tenant_id, p_source_actor_id, lower(btrim(p_token_hash)), p_payload, p_created_at, p_expires_at);

  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values
    (p_source_tenant_id, 'audit-' || gen_random_uuid()::text, 'people-transfer', p_transfer_id, 'create', p_source_actor_id, p_created_at, array['status']);

  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,payload)
  values
    (p_source_tenant_id, 'event-' || gen_random_uuid()::text, 'PeopleTransferPrepared', p_transfer_id, p_source_actor_id, p_created_at, 1, '{}'::jsonb);
end;
$$;

create or replace function public.eutaktos_preview_people_transfer(
  p_token_hash text,
  p_now timestamptz
) returns table (
  transfer_id text,
  expires_at timestamptz,
  people jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transfer public.eutaktos_people_transfers%rowtype;
begin
  if lower(btrim(coalesce(p_token_hash, ''))) !~ '^[0-9a-f]{64}$' or p_now is null then
    raise exception 'invalid people transfer preview' using errcode = '22023';
  end if;

  select * into v_transfer
    from public.eutaktos_people_transfers
   where token_hash = lower(btrim(p_token_hash))
   limit 1;

  if not found
     or v_transfer.cancelled_at is not null
     or v_transfer.claimed_at is not null
     or v_transfer.expires_at <= p_now then
    return;
  end if;

  return query
  select v_transfer.id,
         v_transfer.expires_at,
         coalesce((select jsonb_agg(jsonb_build_object('displayName', item->>'displayName') order by item->>'displayName') from jsonb_array_elements(v_transfer.payload) item), '[]'::jsonb);
end;
$$;

create or replace function public.eutaktos_claim_people_transfer(
  p_token_hash text,
  p_destination_tenant_id text,
  p_destination_actor_id text,
  p_claimed_at timestamptz
) returns table (
  outcome text,
  transfer_id text,
  people jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transfer public.eutaktos_people_transfers%rowtype;
  v_item jsonb;
  v_person_id text;
  v_person_data jsonb;
  v_result jsonb := '[]'::jsonb;
  v_contact jsonb;
begin
  if lower(btrim(coalesce(p_token_hash, ''))) !~ '^[0-9a-f]{64}$'
     or btrim(coalesce(p_destination_tenant_id, '')) = ''
     or btrim(coalesce(p_destination_actor_id, '')) = ''
     or p_claimed_at is null then
    raise exception 'invalid people transfer claim' using errcode = '22023';
  end if;

  select * into v_transfer
    from public.eutaktos_people_transfers
   where token_hash = lower(btrim(p_token_hash))
   limit 1
   for update;

  if not found or v_transfer.cancelled_at is not null or v_transfer.expires_at <= p_claimed_at then
    return;
  end if;

  if v_transfer.claimed_at is not null then
    if v_transfer.claimed_by_tenant_id = p_destination_tenant_id then
      return query select 'already-claimed'::text, v_transfer.id, v_transfer.claim_result;
    end if;
    return;
  end if;

  if v_transfer.source_tenant_id = p_destination_tenant_id then
    raise exception 'source and destination tenant must differ' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_transfer.payload)
  loop
    v_person_id := 'person-' || gen_random_uuid()::text;
    v_contact := case when jsonb_typeof(v_item->'ordinaryContact') = 'object' then v_item->'ordinaryContact' else '{}'::jsonb end;
    v_person_data := jsonb_build_object(
      'id', v_person_id,
      'tenantId', p_destination_tenant_id,
      'displayName', v_item->>'displayName',
      'active', true,
      'availability', '[]'::jsonb,
      'eligibility', '[]'::jsonb
    );
    if btrim(coalesce(v_item->>'preferredLocale', '')) <> '' then
      v_person_data := v_person_data || jsonb_build_object('preferredLocale', v_item->>'preferredLocale');
    end if;
    if v_contact <> '{}'::jsonb then
      v_person_data := v_person_data || jsonb_build_object('ordinaryContact', v_contact);
    end if;

    insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
    values (p_destination_tenant_id, 'person', v_person_id, v_person_data);

    insert into public.eutaktos_audit
      (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
    values
      (p_destination_tenant_id, 'audit-' || gen_random_uuid()::text, 'person', v_person_id, 'create', p_destination_actor_id, p_claimed_at,
       array['displayName','ordinaryContact','preferredLocale']);

    insert into public.eutaktos_outbox
      (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,payload)
    values
      (p_destination_tenant_id, 'event-' || gen_random_uuid()::text, 'PersonTransferredIn', v_person_id, p_destination_actor_id, p_claimed_at, 1, '{}'::jsonb);

    v_result := v_result || jsonb_build_array(jsonb_build_object('personId', v_person_id, 'displayName', v_item->>'displayName'));
  end loop;

  update public.eutaktos_people_transfers
     set claimed_at = p_claimed_at,
         claimed_by_tenant_id = p_destination_tenant_id,
         claimed_by_actor_id = p_destination_actor_id,
         claim_result = v_result,
         payload = coalesce((select jsonb_agg(jsonb_build_object('displayName', item->>'displayName') order by item->>'displayName') from jsonb_array_elements(v_transfer.payload) item), '[]'::jsonb)
   where id = v_transfer.id;

  return query select 'claimed'::text, v_transfer.id, v_result;
end;
$$;

create or replace function public.eutaktos_cancel_people_transfer(
  p_transfer_id text,
  p_source_tenant_id text,
  p_source_actor_id text,
  p_cancelled_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transfer public.eutaktos_people_transfers%rowtype;
begin
  if p_transfer_id !~ '^people-transfer-[A-Za-z0-9-]{1,100}$'
     or btrim(coalesce(p_source_tenant_id, '')) = ''
     or btrim(coalesce(p_source_actor_id, '')) = ''
     or p_cancelled_at is null then
    raise exception 'invalid people transfer cancellation' using errcode = '22023';
  end if;

  select * into v_transfer
    from public.eutaktos_people_transfers
   where id = p_transfer_id and source_tenant_id = p_source_tenant_id
   limit 1
   for update;

  if not found then return false; end if;
  if v_transfer.claimed_at is not null then raise exception 'claimed transfer cannot be cancelled' using errcode = '22023'; end if;
  if v_transfer.cancelled_at is not null then return false; end if;

  update public.eutaktos_people_transfers
     set cancelled_at = p_cancelled_at,
         payload = coalesce((select jsonb_agg(jsonb_build_object('displayName', item->>'displayName') order by item->>'displayName') from jsonb_array_elements(v_transfer.payload) item), '[]'::jsonb)
   where id = v_transfer.id;

  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values
    (p_source_tenant_id, 'audit-' || gen_random_uuid()::text, 'people-transfer', p_transfer_id, 'update', p_source_actor_id, p_cancelled_at, array['status']);

  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,payload)
  values
    (p_source_tenant_id, 'event-' || gen_random_uuid()::text, 'PeopleTransferCancelled', p_transfer_id, p_source_actor_id, p_cancelled_at, 1, '{}'::jsonb);

  return true;
end;
$$;

revoke all on function public.eutaktos_create_people_transfer(text,text,text,text,jsonb,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.eutaktos_preview_people_transfer(text,timestamptz) from public, anon, authenticated;
revoke all on function public.eutaktos_claim_people_transfer(text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.eutaktos_cancel_people_transfer(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.eutaktos_create_people_transfer(text,text,text,text,jsonb,timestamptz,timestamptz) to service_role;
grant execute on function public.eutaktos_preview_people_transfer(text,timestamptz) to service_role;
grant execute on function public.eutaktos_claim_people_transfer(text,text,text,timestamptz) to service_role;
grant execute on function public.eutaktos_cancel_people_transfer(text,text,text,timestamptz) to service_role;

commit;
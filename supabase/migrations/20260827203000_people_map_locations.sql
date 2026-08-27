begin;

create table if not exists public.eutaktos_people_map_locations (
  tenant_id text not null check (length(btrim(tenant_id)) between 1 and 200),
  person_id text not null check (length(btrim(person_id)) between 1 and 200),
  latitude numeric(4,2) not null check (latitude between -90 and 90),
  longitude numeric(5,2) not null check (longitude between -180 and 180),
  precision text not null default 'approximate' check (precision = 'approximate'),
  source text not null default 'manual' check (source = 'manual'),
  updated_at timestamptz not null,
  primary key (tenant_id, person_id)
);

create index if not exists eutaktos_people_map_locations_tenant_idx
  on public.eutaktos_people_map_locations (tenant_id, person_id);

alter table public.eutaktos_people_map_locations enable row level security;
revoke all on public.eutaktos_people_map_locations from anon, authenticated;
grant select, insert, update, delete on public.eutaktos_people_map_locations to service_role;

create or replace function public.eutaktos_list_people_map_points(
  p_tenant_id text
) returns table (
  person_id text,
  display_name text,
  latitude numeric,
  longitude numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if btrim(coalesce(p_tenant_id, '')) = '' then
    raise exception 'invalid people map tenant' using errcode = '22023';
  end if;

  return query
  select l.person_id,
         e.data->>'displayName' as display_name,
         l.latitude,
         l.longitude
    from public.eutaktos_people_map_locations l
    join public.eutaktos_entities e
      on e.tenant_id = l.tenant_id
     and e.entity_type = 'person'
     and e.entity_id = l.person_id
   where l.tenant_id = p_tenant_id
     and e.data->>'tenantId' = p_tenant_id
     and e.data->>'active' = 'true'
     and btrim(coalesce(e.data->>'displayName', '')) <> ''
     and not (coalesce(e.data->'publicationArchive', '{}'::jsonb) ? 'current')
   order by e.data->>'displayName', l.person_id;
end;
$$;

create or replace function public.eutaktos_set_people_map_location(
  p_tenant_id text,
  p_person_id text,
  p_actor_id text,
  p_latitude numeric,
  p_longitude numeric,
  p_updated_at timestamptz
) returns table (
  changed boolean,
  latitude numeric,
  longitude numeric,
  precision text,
  source text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_latitude numeric(4,2);
  v_longitude numeric(5,2);
  v_existing public.eutaktos_people_map_locations%rowtype;
  v_person jsonb;
begin
  if btrim(coalesce(p_tenant_id, '')) = ''
     or btrim(coalesce(p_person_id, '')) = ''
     or btrim(coalesce(p_actor_id, '')) = ''
     or p_latitude is null
     or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180
     or p_updated_at is null then
    raise exception 'invalid people map location' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant_id), hashtext(p_person_id));

  v_latitude := round(p_latitude, 2);
  v_longitude := round(p_longitude, 2);

  select data into v_person
    from public.eutaktos_entities
   where tenant_id = p_tenant_id
     and entity_type = 'person'
     and entity_id = p_person_id
   limit 1;

  if v_person is null
     or v_person->>'tenantId' <> p_tenant_id
     or v_person->>'active' <> 'true'
     or (coalesce(v_person->'publicationArchive', '{}'::jsonb) ? 'current') then
    raise exception 'person is not publishable' using errcode = '22023';
  end if;

  select * into v_existing
    from public.eutaktos_people_map_locations
   where tenant_id = p_tenant_id and person_id = p_person_id
   for update;

  if found and v_existing.latitude = v_latitude and v_existing.longitude = v_longitude then
    return query select false, v_existing.latitude, v_existing.longitude, v_existing.precision, v_existing.source, v_existing.updated_at;
    return;
  end if;

  insert into public.eutaktos_people_map_locations
    (tenant_id, person_id, latitude, longitude, precision, source, updated_at)
  values
    (p_tenant_id, p_person_id, v_latitude, v_longitude, 'approximate', 'manual', p_updated_at)
  on conflict (tenant_id, person_id) do update
    set latitude = excluded.latitude,
        longitude = excluded.longitude,
        precision = 'approximate',
        source = 'manual',
        updated_at = excluded.updated_at;

  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values
    (p_tenant_id, 'audit-' || gen_random_uuid()::text, 'people-map-location', p_person_id,
     case when v_existing.person_id is null then 'create' else 'update' end,
     p_actor_id, p_updated_at, array['mapLocation']);

  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,payload)
  values
    (p_tenant_id, 'event-' || gen_random_uuid()::text, 'PeopleMapLocationSet', p_person_id, p_actor_id, p_updated_at, 1, '{}'::jsonb);

  return query select true, v_latitude::numeric, v_longitude::numeric, 'approximate'::text, 'manual'::text, p_updated_at;
end;
$$;

create or replace function public.eutaktos_remove_people_map_location(
  p_tenant_id text,
  p_person_id text,
  p_actor_id text,
  p_removed_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  if btrim(coalesce(p_tenant_id, '')) = ''
     or btrim(coalesce(p_person_id, '')) = ''
     or btrim(coalesce(p_actor_id, '')) = ''
     or p_removed_at is null then
    raise exception 'invalid people map removal' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant_id), hashtext(p_person_id));

  delete from public.eutaktos_people_map_locations
   where tenant_id = p_tenant_id and person_id = p_person_id;
  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then return false; end if;

  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values
    (p_tenant_id, 'audit-' || gen_random_uuid()::text, 'people-map-location', p_person_id, 'delete', p_actor_id, p_removed_at, array['mapLocation']);

  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,payload)
  values
    (p_tenant_id, 'event-' || gen_random_uuid()::text, 'PeopleMapLocationRemoved', p_person_id, p_actor_id, p_removed_at, 1, '{}'::jsonb);

  return true;
end;
$$;

revoke all on function public.eutaktos_list_people_map_points(text) from public, anon, authenticated;
revoke all on function public.eutaktos_set_people_map_location(text,text,text,numeric,numeric,timestamptz) from public, anon, authenticated;
revoke all on function public.eutaktos_remove_people_map_location(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.eutaktos_list_people_map_points(text) to service_role;
grant execute on function public.eutaktos_set_people_map_location(text,text,text,numeric,numeric,timestamptz) to service_role;
grant execute on function public.eutaktos_remove_people_map_location(text,text,text,timestamptz) to service_role;

commit;

begin;

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
  -- Audit records may describe a subresource stored inside the aggregate entity
  -- (for example an eligibility decision or availability period). Keep tenant
  -- isolation strict, but do not require the audit resource id to equal the
  -- aggregate entity id.
  if p_audit->>'tenantId' <> p_tenant_id or btrim(coalesce(p_audit->>'resourceId', '')) = '' then
    raise exception 'audit identity mismatch' using errcode = '22023';
  end if;
  -- Domain events remain aggregate-scoped and must point at the stored entity.
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

revoke all on function public.eutaktos_apply_entity_change(text,text,text,jsonb,bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.eutaktos_apply_entity_change(text,text,text,jsonb,bigint,jsonb,jsonb) to service_role;

commit;

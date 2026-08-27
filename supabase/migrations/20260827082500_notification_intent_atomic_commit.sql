begin;

create unique index if not exists eutaktos_notification_delivery_idempotency_idx
  on public.eutaktos_entities (tenant_id, (data->>'idempotencyKey'))
  where entity_type = 'notification-delivery' and btrim(coalesce(data->>'idempotencyKey', '')) <> '';

create or replace function public.eutaktos_commit_notification_intent(
  p_tenant_id text,
  p_delivery jsonb,
  p_reminder jsonb,
  p_audit jsonb,
  p_event jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing jsonb;
  v_fields text[];
  v_key text;
begin
  if btrim(coalesce(p_tenant_id, '')) = '' then
    raise exception 'invalid tenant identity' using errcode = '22023';
  end if;
  if jsonb_typeof(p_delivery) <> 'object'
     or p_delivery->>'tenantId' <> p_tenant_id
     or btrim(coalesce(p_delivery->>'id', '')) = ''
     or btrim(coalesce(p_delivery->>'idempotencyKey', '')) = ''
     or btrim(coalesce(p_delivery->>'recipientId', '')) = '' then
    raise exception 'invalid notification delivery' using errcode = '22023';
  end if;
  if p_delivery->>'status' <> 'pending' then
    raise exception 'new notification delivery must be pending' using errcode = '22023';
  end if;
  if jsonb_typeof(p_audit) <> 'object'
     or p_audit->>'tenantId' <> p_tenant_id
     or p_audit->>'resourceType' <> 'notification-intent'
     or p_audit->>'resourceId' <> p_delivery->>'id'
     or p_audit->>'action' <> 'create' then
    raise exception 'invalid notification audit' using errcode = '22023';
  end if;
  if jsonb_typeof(p_event) <> 'object'
     or p_event->>'tenantId' <> p_tenant_id
     or p_event->>'type' <> 'NotificationIntentQueued'
     or (p_event->>'schemaVersion')::integer <> 1
     or jsonb_typeof(p_event->'payload') <> 'object' then
    raise exception 'invalid notification event' using errcode = '22023';
  end if;
  if p_event->'payload'->>'deliveryId' <> p_delivery->>'id'
     or p_event->'payload'->>'recipientId' <> p_delivery->>'recipientId'
     or p_event->'payload'->>'channel' <> p_delivery->>'channel'
     or p_event->'payload'->>'templateKey' <> p_delivery->>'templateKey'
     or p_event->'payload'->>'locale' <> p_delivery->>'locale' then
    raise exception 'notification event payload mismatch' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_event->'payload')) <> 5 then
    raise exception 'notification event payload must contain only delivery envelope fields' using errcode = '22023';
  end if;

  if p_reminder is not null then
    if jsonb_typeof(p_reminder) <> 'object'
       or p_reminder->>'tenantId' <> p_tenant_id
       or p_reminder->>'id' <> p_delivery->>'id'
       or p_reminder->>'deliveryId' <> p_delivery->>'id'
       or p_reminder->>'recipientId' <> p_delivery->>'recipientId'
       or p_reminder->>'assignmentId' <> p_event->>'aggregateId'
       or p_delivery->>'templateKey' <> 'assignment.reminder' then
      raise exception 'invalid assignment reminder correlation' using errcode = '22023';
    end if;
  elsif p_delivery->>'templateKey' = 'assignment.reminder' then
    raise exception 'reminder delivery requires reminder ledger record' using errcode = '22023';
  end if;

  v_key := p_delivery->>'idempotencyKey';
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id || ':notification:' || v_key, 0));

  select data into v_existing
    from public.eutaktos_entities
   where tenant_id = p_tenant_id
     and entity_type = 'notification-delivery'
     and data->>'idempotencyKey' = v_key
   limit 1;

  if v_existing is not null then
    if v_existing->>'recipientId' <> p_delivery->>'recipientId'
       or v_existing->>'channel' <> p_delivery->>'channel'
       or v_existing->>'templateKey' <> p_delivery->>'templateKey'
       or v_existing->>'locale' <> p_delivery->>'locale' then
      raise exception 'notification idempotency identity mismatch' using errcode = '22023';
    end if;
    return v_existing;
  end if;

  insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
  values (p_tenant_id, 'notification-delivery', p_delivery->>'id', p_delivery);

  if p_reminder is not null then
    insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
    values (p_tenant_id, 'assignment-reminder', p_reminder->>'id', p_reminder);
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
    (p_tenant_id,p_event->>'id',p_event->>'type',p_event->>'aggregateId',p_event->>'actorId',(p_event->>'occurredAt')::timestamptz,(p_event->>'schemaVersion')::integer,nullif(p_event->>'correlationId',''),p_event->'payload');

  return p_delivery;
end;
$$;

revoke all on function public.eutaktos_commit_notification_intent(text,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.eutaktos_commit_notification_intent(text,jsonb,jsonb,jsonb,jsonb) to service_role;

commit;

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
  if jsonb_typeof(p_delivery) is distinct from 'object'
     or p_delivery->>'tenantId' is distinct from p_tenant_id
     or btrim(coalesce(p_delivery->>'id', '')) = ''
     or btrim(coalesce(p_delivery->>'idempotencyKey', '')) = ''
     or btrim(coalesce(p_delivery->>'notificationPreferenceId', '')) = ''
     or btrim(coalesce(p_delivery->>'recipientId', '')) = ''
     or btrim(coalesce(p_delivery->>'channel', '')) = ''
     or btrim(coalesce(p_delivery->>'templateKey', '')) = ''
     or btrim(coalesce(p_delivery->>'locale', '')) = '' then
    raise exception 'invalid notification delivery' using errcode = '22023';
  end if;
  if p_delivery->>'status' is distinct from 'pending' then
    raise exception 'new notification delivery must be pending' using errcode = '22023';
  end if;
  if jsonb_typeof(p_audit) is distinct from 'object'
     or p_audit->>'tenantId' is distinct from p_tenant_id
     or p_audit->>'resourceType' is distinct from 'notification-intent'
     or p_audit->>'resourceId' is distinct from p_delivery->>'id'
     or p_audit->>'action' is distinct from 'create'
     or btrim(coalesce(p_audit->>'actorId', '')) = ''
     or btrim(coalesce(p_audit->>'occurredAt', '')) = '' then
    raise exception 'invalid notification audit' using errcode = '22023';
  end if;
  if jsonb_typeof(p_event) is distinct from 'object'
     or p_event->>'tenantId' is distinct from p_tenant_id
     or p_event->>'type' is distinct from 'NotificationIntentQueued'
     or coalesce(p_event->>'schemaVersion', '') <> '1'
     or btrim(coalesce(p_event->>'aggregateId', '')) = ''
     or btrim(coalesce(p_event->>'actorId', '')) = ''
     or btrim(coalesce(p_event->>'occurredAt', '')) = ''
     or jsonb_typeof(p_event->'payload') is distinct from 'object' then
    raise exception 'invalid notification event' using errcode = '22023';
  end if;
  if p_event->'payload'->>'deliveryId' is distinct from p_delivery->>'id'
     or p_event->'payload'->>'recipientId' is distinct from p_delivery->>'recipientId'
     or p_event->'payload'->>'channel' is distinct from p_delivery->>'channel'
     or p_event->'payload'->>'templateKey' is distinct from p_delivery->>'templateKey'
     or p_event->'payload'->>'locale' is distinct from p_delivery->>'locale' then
    raise exception 'notification event payload mismatch' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_event->'payload')) <> 5 then
    raise exception 'notification event payload must contain only delivery envelope fields' using errcode = '22023';
  end if;

  if p_reminder is not null then
    if jsonb_typeof(p_reminder) is distinct from 'object'
       or p_reminder->>'tenantId' is distinct from p_tenant_id
       or p_reminder->>'id' is distinct from p_delivery->>'id'
       or p_reminder->>'deliveryId' is distinct from p_delivery->>'id'
       or p_reminder->>'recipientId' is distinct from p_delivery->>'recipientId'
       or p_reminder->>'assignmentId' is distinct from p_event->>'aggregateId'
       or btrim(coalesce(p_reminder->>'queuedAt', '')) = ''
       or p_delivery->>'templateKey' is distinct from 'assignment.reminder' then
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
    if v_existing->>'recipientId' is distinct from p_delivery->>'recipientId'
       or v_existing->>'channel' is distinct from p_delivery->>'channel'
       or v_existing->>'templateKey' is distinct from p_delivery->>'templateKey'
       or v_existing->>'locale' is distinct from p_delivery->>'locale' then
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
    (p_tenant_id,p_event->>'id',p_event->>'type',p_event->>'aggregateId',p_event->>'actorId',(p_event->>'occurredAt')::timestamptz,1,nullif(p_event->>'correlationId',''),p_event->'payload');

  return p_delivery;
end;
$$;

revoke all on function public.eutaktos_commit_notification_intent(text,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.eutaktos_commit_notification_intent(text,jsonb,jsonb,jsonb,jsonb) to service_role;

commit;

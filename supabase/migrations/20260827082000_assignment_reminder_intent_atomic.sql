begin;

create unique index if not exists eutaktos_notification_delivery_idempotency_idx
  on public.eutaktos_entities (tenant_id, ((data->>'idempotencyKey')))
  where entity_type = 'notification-delivery';

create or replace function public.eutaktos_apply_assignment_reminder_intent(
  p_tenant_id text,
  p_delivery jsonb,
  p_reminder jsonb,
  p_audit jsonb,
  p_event jsonb
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delivery_id text;
  v_existing_id text;
  v_idempotency_key text;
  v_fields text[];
begin
  if btrim(coalesce(p_tenant_id, '')) = '' then
    raise exception 'invalid tenant identity' using errcode = '22023';
  end if;
  if jsonb_typeof(p_delivery) <> 'object'
     or p_delivery->>'tenantId' <> p_tenant_id
     or btrim(coalesce(p_delivery->>'id', '')) = ''
     or btrim(coalesce(p_delivery->>'idempotencyKey', '')) = ''
     or btrim(coalesce(p_delivery->>'recipientId', '')) = ''
     or btrim(coalesce(p_delivery->>'channel', '')) = ''
     or btrim(coalesce(p_delivery->>'templateKey', '')) = ''
     or btrim(coalesce(p_delivery->>'locale', '')) = '' then
    raise exception 'invalid reminder delivery envelope' using errcode = '22023';
  end if;
  if p_delivery->>'templateKey' <> 'assignment.reminder' then
    raise exception 'invalid reminder template' using errcode = '22023';
  end if;
  if p_delivery->>'channel' not in ('in-app','push','email','whatsapp') then
    raise exception 'invalid reminder channel' using errcode = '22023';
  end if;

  v_delivery_id := p_delivery->>'id';
  v_idempotency_key := p_delivery->>'idempotencyKey';

  if jsonb_typeof(p_reminder) <> 'object'
     or p_reminder->>'tenantId' <> p_tenant_id
     or p_reminder->>'id' <> v_delivery_id
     or p_reminder->>'deliveryId' <> v_delivery_id
     or p_reminder->>'recipientId' <> p_delivery->>'recipientId'
     or btrim(coalesce(p_reminder->>'assignmentId', '')) = '' then
    raise exception 'invalid assignment reminder correlation' using errcode = '22023';
  end if;
  if jsonb_typeof(p_audit) <> 'object'
     or p_audit->>'tenantId' <> p_tenant_id
     or p_audit->>'resourceType' <> 'notification-intent'
     or p_audit->>'resourceId' <> v_delivery_id then
    raise exception 'invalid reminder audit identity' using errcode = '22023';
  end if;
  if jsonb_typeof(p_event) <> 'object'
     or p_event->>'tenantId' <> p_tenant_id
     or p_event->>'type' <> 'NotificationIntentQueued'
     or p_event->>'aggregateId' <> p_reminder->>'assignmentId'
     or (p_event->>'schemaVersion')::integer <> 1 then
    raise exception 'invalid reminder event identity' using errcode = '22023';
  end if;

  select e.entity_id
    into v_existing_id
    from public.eutaktos_entities e
   where e.tenant_id = p_tenant_id
     and e.entity_type = 'notification-delivery'
     and e.data->>'idempotencyKey' = v_idempotency_key
   limit 1
   for update;

  if v_existing_id is not null then
    if not exists (
      select 1
        from public.eutaktos_entities e
       where e.tenant_id = p_tenant_id
         and e.entity_type = 'notification-delivery'
         and e.entity_id = v_existing_id
         and e.data->>'recipientId' = p_delivery->>'recipientId'
         and e.data->>'channel' = p_delivery->>'channel'
         and e.data->>'templateKey' = 'assignment.reminder'
    ) then
      raise exception 'notification idempotency identity mismatch' using errcode = '22023';
    end if;
    return v_existing_id;
  end if;

  insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
  values (p_tenant_id, 'notification-delivery', v_delivery_id, p_delivery);

  insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
  values (p_tenant_id, 'assignment-reminder', p_reminder->>'id', p_reminder);

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
    (
      p_tenant_id,
      p_event->>'id',
      p_event->>'type',
      p_event->>'aggregateId',
      p_event->>'actorId',
      (p_event->>'occurredAt')::timestamptz,
      (p_event->>'schemaVersion')::integer,
      nullif(p_event->>'correlationId',''),
      jsonb_build_object(
        'deliveryId', v_delivery_id,
        'recipientId', p_delivery->>'recipientId',
        'channel', p_delivery->>'channel',
        'templateKey', p_delivery->>'templateKey',
        'locale', p_delivery->>'locale'
      )
    );

  return v_delivery_id;
exception
  when unique_violation then
    select e.entity_id
      into v_existing_id
      from public.eutaktos_entities e
     where e.tenant_id = p_tenant_id
       and e.entity_type = 'notification-delivery'
       and e.data->>'idempotencyKey' = v_idempotency_key
     limit 1;
    if v_existing_id is null then raise; end if;
    return v_existing_id;
end;
$$;

revoke all on function public.eutaktos_apply_assignment_reminder_intent(text,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.eutaktos_apply_assignment_reminder_intent(text,jsonb,jsonb,jsonb,jsonb) to service_role;

commit;

begin;

-- Atomic rollback primitive for the currently safe Hourglass execute shape.
--
-- The authoritative Hourglass reconciliation preview currently exposes only
-- create / unchanged / conflict. Existing-record differences are conflicts,
-- never silent updates. This rollback therefore deliberately accepts ONLY a
-- persisted migration whose rollback plan is entirely delete-new-person steps
-- and whose post-commit evidence is entirely create steps.
--
-- Any update/restore step fails closed. This avoids pretending that the older
-- generic partial restore snapshot is sufficient for richer Hourglass person
-- data such as explicit eligibility.

create or replace function public.eutaktos_rollback_hourglass_create_migration(
  p_tenant_id text,
  p_migration_id text,
  p_audit jsonb,
  p_event jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_migration jsonb;
  v_log jsonb;
  v_plan jsonb;
  v_post_steps jsonb;
  v_step jsonb;
  v_post jsonb;
  v_step_count integer;
  v_i integer;
  v_person_id text;
  v_expected_version bigint;
  v_actual_version bigint;
  v_fields text[];
  v_rolled_back_at timestamptz;
begin
  if btrim(coalesce(p_tenant_id, '')) = ''
     or btrim(coalesce(p_migration_id, '')) = '' then
    raise exception 'invalid migration identity' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_audit, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_event, 'null'::jsonb)) <> 'object' then
    raise exception 'invalid rollback envelope' using errcode = '22023';
  end if;

  if p_audit->>'tenantId' <> p_tenant_id
     or p_audit->>'resourceType' <> 'migration'
     or p_audit->>'resourceId' <> p_migration_id
     or p_audit->>'action' <> 'update' then
    raise exception 'rollback audit identity mismatch' using errcode = '22023';
  end if;

  if p_event->>'tenantId' <> p_tenant_id
     or p_event->>'type' <> 'MigrationRolledBack'
     or p_event->>'aggregateId' <> p_migration_id then
    raise exception 'rollback event identity mismatch' using errcode = '22023';
  end if;

  if btrim(coalesce(p_audit->>'actorId', '')) = ''
     or p_event->>'actorId' <> p_audit->>'actorId' then
    raise exception 'rollback actor mismatch' using errcode = '22023';
  end if;

  if coalesce(p_audit->>'occurredAt', '') = ''
     or coalesce(p_event->>'occurredAt', '') = '' then
    raise exception 'invalid rollback timestamps' using errcode = '22023';
  end if;
  perform (p_audit->>'occurredAt')::timestamptz;
  v_rolled_back_at := (p_event->>'occurredAt')::timestamptz;

  if coalesce((p_event->>'schemaVersion')::integer, 0) <= 0 then
    raise exception 'invalid rollback event schema version' using errcode = '22023';
  end if;

  select data
    into v_migration
    from public.eutaktos_entities
   where tenant_id = p_tenant_id
     and entity_type = 'hourglass-migration'
     and entity_id = p_migration_id
   for update;

  if v_migration is null then
    raise exception 'migration not found' using errcode = 'P0002';
  end if;

  v_log := v_migration->'log';
  v_plan := v_migration->'rollbackPlan';
  v_post_steps := v_migration->'postCommitSteps';

  if jsonb_typeof(v_log) <> 'object'
     or jsonb_typeof(v_plan) <> 'object'
     or jsonb_typeof(v_post_steps) <> 'array'
     or jsonb_typeof(v_plan->'steps') <> 'array' then
    raise exception 'invalid stored migration rollback state' using errcode = '22023';
  end if;

  if v_log->>'tenantId' <> p_tenant_id
     or v_log->>'migrationId' <> p_migration_id
     or v_plan->>'tenantId' <> p_tenant_id
     or v_plan->>'migrationId' <> p_migration_id then
    raise exception 'cross-tenant migration rollback denied' using errcode = 'P0004';
  end if;

  if v_log->>'status' = 'rolled-back' then
    return jsonb_build_object('outcome', 'already-rolled-back', 'log', v_log);
  end if;

  if v_log->>'status' <> 'completed' then
    raise exception 'only completed migrations can be rolled back' using errcode = '22023';
  end if;

  v_step_count := jsonb_array_length(v_plan->'steps');
  if jsonb_array_length(v_post_steps) <> v_step_count then
    raise exception 'stored rollback evidence count mismatch' using errcode = '22023';
  end if;

  -- Validate and lock every created person before deleting any of them. A person
  -- changed or removed after import makes the entire rollback stale and aborts
  -- the surrounding transaction, leaving all records untouched.
  for v_i in 1 .. v_step_count loop
    v_step := v_plan->'steps' -> (v_i - 1);
    v_post := v_post_steps -> (v_i - 1);

    if jsonb_typeof(v_step) <> 'object'
       or jsonb_typeof(v_post) <> 'object'
       or (v_step->>'sequence')::integer <> v_i
       or (v_step->>'type') <> 'delete'
       or v_step ? 'restore'
       or (v_post->>'kind') <> 'create'
       or (v_post->>'internalId') <> (v_step->>'internalId') then
      raise exception 'migration is not a create-only Hourglass rollback' using errcode = '22023';
    end if;

    v_person_id := btrim(coalesce(v_step->>'internalId', ''));
    if v_person_id = '' then
      raise exception 'invalid rollback person identity' using errcode = '22023';
    end if;

    if jsonb_typeof(coalesce(v_post->'resultingVersion', 'null'::jsonb)) is distinct from 'number' then
      raise exception 'invalid rollback person version' using errcode = '22023';
    end if;
    v_expected_version := (v_post->>'resultingVersion')::bigint;
    if v_expected_version <= 0 then
      raise exception 'invalid rollback person version' using errcode = '22023';
    end if;

    select version
      into v_actual_version
      from public.eutaktos_entities
     where tenant_id = p_tenant_id
       and entity_type = 'person'
       and entity_id = v_person_id
     for update;

    if v_actual_version is null or v_actual_version <> v_expected_version then
      raise exception 'rollback blocked by concurrent person change' using errcode = '40001';
    end if;
  end loop;

  for v_i in 1 .. v_step_count loop
    v_step := v_plan->'steps' -> (v_i - 1);
    v_post := v_post_steps -> (v_i - 1);
    v_person_id := v_step->>'internalId';
    v_expected_version := (v_post->>'resultingVersion')::bigint;

    delete from public.eutaktos_entities
     where tenant_id = p_tenant_id
       and entity_type = 'person'
       and entity_id = v_person_id
       and version = v_expected_version;

    if not found then
      raise exception 'rollback blocked by concurrent person change' using errcode = '40001';
    end if;
  end loop;

  v_log := jsonb_set(
    jsonb_set(v_log, '{status}', to_jsonb('rolled-back'::text), false),
    '{completedAt}',
    to_jsonb(v_rolled_back_at::text),
    false
  );

  update public.eutaktos_entities
     set data = jsonb_set(v_migration, '{log}', v_log, false),
         version = version + 1,
         updated_at = now()
   where tenant_id = p_tenant_id
     and entity_type = 'hourglass-migration'
     and entity_id = p_migration_id;

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

  return jsonb_build_object('outcome', 'rolled-back', 'log', v_log);
end;
$$;

revoke all on function public.eutaktos_rollback_hourglass_create_migration(text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.eutaktos_rollback_hourglass_create_migration(text,text,jsonb,jsonb) to service_role;

commit;

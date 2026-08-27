begin;

-- Durable Hourglass People migration commit primitive (PX9.9 foundation).
--
-- Applies an already-previewed and explicitly confirmed migration as ONE atomic
-- transaction: all person entity changes together with the persisted migration
-- log, rollback plan, audit row and outbox event. If any part fails the whole
-- transaction aborts, so no partial import state can ever be committed.
--
-- Replay safety: if a migration entity already exists for the tenant with an
-- identical commit fingerprint, the call is treated as an already-applied retry
-- and returns without re-applying anything. Reusing the same migration identity
-- with different commit content is rejected.
--
-- The rollback plan is persisted but NOT executed by this function. Rollback
-- application remains blocked until its dedicated reviewed contract exists;
-- the recovery-boundary documentation still forbids exposing execute/rollback.

create or replace function public.eutaktos_apply_hourglass_migration_commit(
  p_tenant_id text,
  p_migration jsonb,
  p_person_changes jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_log jsonb;
  v_plan jsonb;
  v_audit jsonb;
  v_event jsonb;
  v_migration_id text;
  v_existing jsonb;
  v_commit_fingerprint text;
  v_operation_count integer;
  v_change_count integer;
  v_kind text;
  v_entity_id text;
  v_expected_version bigint;
  v_resulting_version bigint;
  v_fields text[];
  v_seen_ids text[];
  v_steps jsonb := '[]'::jsonb;
  v_i integer;
  v_item jsonb;
  v_plan_step jsonb;
begin
  if btrim(coalesce(p_tenant_id, '')) = '' then
    raise exception 'invalid tenant identity' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_migration, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_person_changes, 'null'::jsonb)) <> 'array' then
    raise exception 'invalid migration commit envelope' using errcode = '22023';
  end if;

  v_log := p_migration->'log';
  v_plan := p_migration->'rollbackPlan';
  v_audit := p_migration->'audit';
  v_event := p_migration->'event';

  if jsonb_typeof(v_log) <> 'object'
     or jsonb_typeof(v_plan) <> 'object'
     or jsonb_typeof(v_audit) <> 'object'
     or jsonb_typeof(v_event) <> 'object' then
    raise exception 'invalid migration commit envelope' using errcode = '22023';
  end if;

  v_migration_id := btrim(coalesce(v_log->>'migrationId', ''));
  if v_migration_id = '' then
    raise exception 'invalid migration identity' using errcode = '22023';
  end if;

  if v_log->>'tenantId' <> p_tenant_id
     or v_plan->>'tenantId' <> p_tenant_id
     or v_audit->>'tenantId' <> p_tenant_id
     or v_event->>'tenantId' <> p_tenant_id then
    raise exception 'cross-tenant migration access denied' using errcode = 'P0004';
  end if;

  if v_plan->>'migrationId' <> v_migration_id then
    raise exception 'migration plan identity mismatch' using errcode = '22023';
  end if;

  if v_log->>'status' <> 'completed' then
    raise exception 'only completed migrations can be durably applied' using errcode = '22023';
  end if;

  if coalesce((v_log->>'startedAt'), '') = ''
     or coalesce((v_log->>'completedAt'), '') = '' then
    raise exception 'invalid migration timestamps' using errcode = '22023';
  end if;
  perform ((v_log->>'startedAt'))::timestamptz;
  perform ((v_log->>'completedAt'))::timestamptz;

  if v_audit->>'resourceType' <> 'migration'
     or v_audit->>'resourceId' <> v_migration_id
     or v_audit->>'action' <> 'create' then
    raise exception 'migration audit identity mismatch' using errcode = '22023';
  end if;

  if v_event->>'type' <> 'MigrationApplied'
     or v_event->>'aggregateId' <> v_migration_id then
    raise exception 'migration event identity mismatch' using errcode = '22023';
  end if;

  if jsonb_typeof(v_log->'operations') <> 'array'
     or jsonb_typeof(v_plan->'steps') <> 'array' then
    raise exception 'invalid migration operations or plan shape' using errcode = '22023';
  end if;

  v_operation_count := jsonb_array_length(v_log->'operations');
  v_change_count := jsonb_array_length(p_person_changes);
  if v_operation_count <> v_change_count
     or jsonb_array_length(v_plan->'steps') <> v_change_count then
    raise exception 'migration operations or rollback plan do not match submitted changes' using errcode = '22023';
  end if;

  -- Keep idempotency comparison PII-minimal: store only a deterministic fingerprint,
  -- never a second copy of the imported person payload. jsonb text output is canonical
  -- for object-key ordering, so equivalent commit envelopes produce the same value.
  v_commit_fingerprint := md5(p_migration::text || E'\n' || p_person_changes::text);

  -- Replay guard: compare the complete commit fingerprint, not only the log. The
  -- log does not contain imported field values or rollback snapshots, so using it
  -- alone would accept a different commit under the same migration identity.
  select data into v_existing
    from public.eutaktos_entities
   where tenant_id = p_tenant_id
     and entity_type = 'hourglass-migration'
     and entity_id = v_migration_id;
  if v_existing is not null then
    if v_existing->>'commitFingerprint' = v_commit_fingerprint then
      return jsonb_build_object('outcome', 'already-applied', 'log', v_existing->'log');
    end if;
    raise exception 'migration identity reuse with different content' using errcode = '22023';
  end if;

  -- Validate every change against both the operation log and rollback plan before
  -- touching any person row. This prevents storing a rollback plan that does not
  -- actually correspond to the changes being applied.
  v_seen_ids := '{}';
  for v_i in 1 .. v_change_count loop
    v_item := p_person_changes -> (v_i - 1);
    v_plan_step := v_plan->'steps' -> (v_i - 1);

    if jsonb_typeof(v_item) <> 'object'
       or v_item ->> 'kind' not in ('create', 'update')
       or jsonb_typeof(v_item->'data') <> 'object' then
      raise exception 'invalid migration change at position %', v_i using errcode = '22023';
    end if;
    if jsonb_typeof(v_plan_step) <> 'object' then
      raise exception 'invalid rollback step at position %', v_i using errcode = '22023';
    end if;

    v_kind := v_item->>'kind';
    v_entity_id := btrim(coalesce(v_item->>'id', ''));
    if v_entity_id = '' or length(v_entity_id) > 200 then
      raise exception 'invalid migration change identity at position %', v_i using errcode = '22023';
    end if;
    if v_entity_id = any(v_seen_ids) then
      raise exception 'duplicate migration change identity %', v_entity_id using errcode = '22023';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_entity_id);

    if v_item->'data'->>'tenantId' <> p_tenant_id or v_item->'data'->>'id' <> v_entity_id then
      raise exception 'cross-tenant migration change denied' using errcode = 'P0004';
    end if;

    if (v_log->'operations' -> (v_i - 1) ->> 'internalId') <> v_entity_id
       or (v_log->'operations' -> (v_i - 1) ->> 'kind') <> v_kind
       or (v_log->'operations' -> (v_i - 1) ->> 'sequence')::integer <> v_i then
      raise exception 'migration operation correlation mismatch' using errcode = '22023';
    end if;

    if (v_plan_step->>'internalId') <> v_entity_id
       or (v_plan_step->>'sequence')::integer <> v_i
       or (v_kind = 'create' and (v_plan_step->>'type' <> 'delete' or v_plan_step ? 'restore'))
       or (v_kind = 'update' and (v_plan_step->>'type' <> 'restore' or jsonb_typeof(v_plan_step->'restore') <> 'object')) then
      raise exception 'migration rollback correlation mismatch' using errcode = '22023';
    end if;
  end loop;

  for v_i in 1 .. v_change_count loop
    v_item := p_person_changes -> (v_i - 1);
    v_kind := v_item->>'kind';
    v_entity_id := v_item->>'id';

    if v_kind = 'create' then
      if exists (
        select 1 from public.eutaktos_entities
         where tenant_id = p_tenant_id
           and entity_type = 'person'
           and entity_id = v_entity_id
      ) then
        raise exception 'duplicate person during migration commit %', v_entity_id using errcode = '22023';
      end if;
      insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
        values (p_tenant_id, 'person', v_entity_id, v_item->'data')
        returning version into v_resulting_version;
    else
      if jsonb_typeof(coalesce(v_item->'expectedVersion', 'null'::jsonb)) is distinct from 'number' then
        raise exception 'missing expected version for migration update %', v_entity_id using errcode = '22023';
      end if;
      v_expected_version := (v_item->>'expectedVersion')::bigint;
      if v_expected_version <= 0 then
        raise exception 'invalid expected version for migration update %', v_entity_id using errcode = '22023';
      end if;
      update public.eutaktos_entities
         set data = v_item->'data', version = version + 1, updated_at = now()
       where tenant_id = p_tenant_id
         and entity_type = 'person'
         and entity_id = v_entity_id
         and version = v_expected_version
        returning version into v_resulting_version;
      if v_resulting_version is null then
        raise exception 'concurrent entity modification' using errcode = '40001';
      end if;
    end if;

    v_steps := v_steps || jsonb_build_object(
      'kind', v_kind,
      'internalId', v_entity_id,
      'resultingVersion', v_resulting_version
    );
  end loop;

  insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
    values (
      p_tenant_id,
      'hourglass-migration',
      v_migration_id,
      jsonb_build_object(
        'log', v_log,
        'rollbackPlan', v_plan,
        'postCommitSteps', v_steps,
        'commitFingerprint', v_commit_fingerprint
      )
    );

  select coalesce(array_agg(value order by value), '{}'::text[])
    into v_fields
    from jsonb_array_elements_text(coalesce(v_audit->'changedFields', '[]'::jsonb));

  insert into public.eutaktos_audit
    (tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values
    (p_tenant_id,v_audit->>'id',v_audit->>'resourceType',v_audit->>'resourceId',v_audit->>'action',v_audit->>'actorId',(v_audit->>'occurredAt')::timestamptz,v_fields);

  insert into public.eutaktos_outbox
    (tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,correlation_id,payload)
  values
    (p_tenant_id,v_event->>'id',v_event->>'type',v_event->>'aggregateId',v_event->>'actorId',(v_event->>'occurredAt')::timestamptz,(v_event->>'schemaVersion')::integer,nullif(v_event->>'correlationId',''),coalesce(v_event->'payload','{}'::jsonb));

  return jsonb_build_object('outcome', 'applied', 'log', v_log);
end;
$$;

revoke all on function public.eutaktos_apply_hourglass_migration_commit(text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.eutaktos_apply_hourglass_migration_commit(text,jsonb,jsonb) to service_role;

commit;

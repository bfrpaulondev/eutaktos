begin;

-- Stable logical-intent replay identity for Hourglass migration apply.
--
-- The complete commit fingerprint remains the integrity fingerprint for the exact
-- persisted envelope. It is intentionally not the sole retry identity because a
-- server may have to reconstruct audit/event ids and timestamps after an ambiguous
-- network outcome. A future authenticated execute boundary must compute
-- intentFingerprint server-side from the freshly revalidated Hourglass mutation
-- intent and reuse the same migration identity for the same client mutation id.
--
-- This wrapper keeps the transaction-scoped advisory serialization introduced by
-- 20260827114500 and intercepts already-applied logical retries before delegating
-- to the exact-envelope fingerprint guard in the internal atomic implementation.

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
  v_migration_id text;
  v_intent_fingerprint text;
  v_existing jsonb;
  v_result jsonb;
begin
  if btrim(coalesce(p_tenant_id, '')) = '' then
    raise exception 'invalid tenant identity' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_migration, 'null'::jsonb)) <> 'object' then
    raise exception 'invalid migration commit envelope' using errcode = '22023';
  end if;

  v_migration_id := btrim(coalesce(p_migration->'log'->>'migrationId', ''));
  if v_migration_id = '' then
    raise exception 'invalid migration identity' using errcode = '22023';
  end if;

  v_intent_fingerprint := btrim(coalesce(p_migration->>'intentFingerprint', ''));
  if v_intent_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid migration intent fingerprint' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id || E'\x1f' || v_migration_id, 0)
  );

  select data
    into v_existing
    from public.eutaktos_entities
   where tenant_id = p_tenant_id
     and entity_type = 'hourglass-migration'
     and entity_id = v_migration_id;

  if v_existing is not null then
    if v_existing->>'intentFingerprint' = v_intent_fingerprint then
      return jsonb_build_object('outcome', 'already-applied', 'log', v_existing->'log');
    end if;
    if not (v_existing ? 'intentFingerprint') then
      raise exception 'existing migration has no logical replay identity' using errcode = '22023';
    end if;
    raise exception 'migration identity reuse with different intent' using errcode = '22023';
  end if;

  v_result := public.eutaktos_apply_hourglass_migration_commit_unlocked(
    p_tenant_id,
    p_migration,
    p_person_changes
  );

  if v_result->>'outcome' <> 'applied' then
    raise exception 'unexpected migration apply outcome' using errcode = '22023';
  end if;

  update public.eutaktos_entities
     set data = jsonb_set(data, '{intentFingerprint}', to_jsonb(v_intent_fingerprint), true),
         updated_at = now()
   where tenant_id = p_tenant_id
     and entity_type = 'hourglass-migration'
     and entity_id = v_migration_id;

  if not found then
    raise exception 'migration persistence missing after apply' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

revoke all on function public.eutaktos_apply_hourglass_migration_commit(text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.eutaktos_apply_hourglass_migration_commit(text,jsonb,jsonb)
  to service_role;

commit;

begin;

-- Serialize Hourglass migration apply attempts for the same tenant + migration id.
--
-- The original atomic apply primitive is preserved under an internal name. The
-- public service-role entry point becomes a small SECURITY DEFINER wrapper that
-- takes a transaction-scoped advisory lock before delegating. Under PostgreSQL
-- READ COMMITTED semantics, a concurrent retry that waited for the lock then
-- observes the migration row committed by the first caller, so the existing
-- fingerprint replay guard can safely return already-applied instead of racing
-- into duplicate writes.

alter function public.eutaktos_apply_hourglass_migration_commit(text,jsonb,jsonb)
  rename to eutaktos_apply_hourglass_migration_commit_unlocked;

revoke all on function public.eutaktos_apply_hourglass_migration_commit_unlocked(text,jsonb,jsonb)
  from public, anon, authenticated, service_role;

create function public.eutaktos_apply_hourglass_migration_commit(
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

  -- Hash collisions can only serialize unrelated migrations; they cannot weaken
  -- correctness. The lock is transaction scoped and is released automatically.
  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id || E'\x1f' || v_migration_id, 0)
  );

  return public.eutaktos_apply_hourglass_migration_commit_unlocked(
    p_tenant_id,
    p_migration,
    p_person_changes
  );
end;
$$;

revoke all on function public.eutaktos_apply_hourglass_migration_commit(text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.eutaktos_apply_hourglass_migration_commit(text,jsonb,jsonb)
  to service_role;

commit;

begin;

create or replace function public.eutaktos_export_tenant(p_tenant_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if btrim(coalesce(p_tenant_id,'')) = '' then
    raise exception 'tenant id is required' using errcode='22023';
  end if;
  return jsonb_build_object(
    'schemaVersion',1,
    'tenantId',p_tenant_id,
    'exportedAt',now(),
    'entities',coalesce((select jsonb_agg(to_jsonb(e) order by e.entity_type,e.entity_id) from public.eutaktos_entities e where e.tenant_id=p_tenant_id),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at,a.id) from public.eutaktos_audit a where a.tenant_id=p_tenant_id),'[]'::jsonb),
    'accessGrants',coalesce((select jsonb_agg(to_jsonb(g) order by g.granted_at,g.id) from public.eutaktos_access_grants g where g.tenant_id=p_tenant_id),'[]'::jsonb)
  );
end;
$$;

create or replace function public.eutaktos_restore_tenant(p_tenant_id text,p_snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_snapshot) <> 'object' or (p_snapshot->>'schemaVersion')::integer <> 1 or p_snapshot->>'tenantId' <> p_tenant_id then
    raise exception 'invalid backup snapshot' using errcode='22023';
  end if;
  if jsonb_typeof(p_snapshot->'entities') <> 'array' or jsonb_typeof(p_snapshot->'audit') <> 'array' or jsonb_typeof(p_snapshot->'accessGrants') <> 'array' then
    raise exception 'invalid backup collections' using errcode='22023';
  end if;
  if p_snapshot ? 'sessions' or p_snapshot ? 'outbox' then
    raise exception 'operational session/outbox data is not restorable' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'entities') x where x->>'tenant_id' <> p_tenant_id)
    or exists(select 1 from jsonb_array_elements(p_snapshot->'audit') x where x->>'tenant_id' <> p_tenant_id)
    or exists(select 1 from jsonb_array_elements(p_snapshot->'accessGrants') x where x->>'tenant_id' <> p_tenant_id) then
    raise exception 'cross-tenant backup row rejected' using errcode='22023';
  end if;

  -- Sessions and pending delivery work are intentionally invalidated rather than
  -- restored from historical state. A restore must never resurrect authentication
  -- or replay stale notifications.
  delete from public.eutaktos_sessions where tenant_id=p_tenant_id;
  delete from public.eutaktos_outbox where tenant_id=p_tenant_id;
  delete from public.eutaktos_audit where tenant_id=p_tenant_id;
  delete from public.eutaktos_access_grants where tenant_id=p_tenant_id;
  delete from public.eutaktos_entities where tenant_id=p_tenant_id;

  insert into public.eutaktos_entities(tenant_id,entity_type,entity_id,data,version,created_at,updated_at)
  select tenant_id,entity_type,entity_id,data,version,created_at,updated_at
  from jsonb_to_recordset(p_snapshot->'entities') as r(tenant_id text,entity_type text,entity_id text,data jsonb,version bigint,created_at timestamptz,updated_at timestamptz);

  insert into public.eutaktos_audit(tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  select tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields
  from jsonb_to_recordset(p_snapshot->'audit') as r(tenant_id text,id text,resource_type text,resource_id text,action text,actor_id text,occurred_at timestamptz,changed_fields text[]);

  insert into public.eutaktos_access_grants(tenant_id,id,subject_id,capability,granted_by,granted_at,revoked_at)
  select tenant_id,id,subject_id,capability,granted_by,granted_at,revoked_at
  from jsonb_to_recordset(p_snapshot->'accessGrants') as r(tenant_id text,id text,subject_id text,capability text,granted_by text,granted_at timestamptz,revoked_at timestamptz);
end;
$$;

revoke all on function public.eutaktos_export_tenant(text) from public,anon,authenticated;
revoke all on function public.eutaktos_restore_tenant(text,jsonb) from public,anon,authenticated;
grant execute on function public.eutaktos_export_tenant(text) to service_role;
grant execute on function public.eutaktos_restore_tenant(text,jsonb) to service_role;

commit;

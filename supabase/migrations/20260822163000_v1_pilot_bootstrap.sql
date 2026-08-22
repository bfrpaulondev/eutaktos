begin;

create or replace function public.eutaktos_bootstrap_pilot(
  p_tenant_id text,
  p_actor_id text,
  p_display_name text,
  p_locale text,
  p_capabilities text[],
  p_session_id text,
  p_now timestamptz
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_capability text;
  v_suffix text;
  v_allowed constant text[] := array[
    'people.read','people.write','eligibility.read','eligibility.write','availability.read','availability.write',
    'emergency-contacts.read','emergency-contacts.write','responsibilities.read','responsibilities.write',
    'delegations.read','delegations.write','schedule.read','schedule.write','reports.read','reports.write',
    'review.read','review.write','audit.read','access.manage','tenant.manage'
  ];
begin
  if btrim(coalesce(p_tenant_id,''))='' or btrim(coalesce(p_actor_id,''))='' or length(btrim(coalesce(p_display_name,''))) < 2 then
    raise exception 'invalid pilot identity' using errcode='22023';
  end if;
  if p_locale not in ('pt-PT','en','es') then raise exception 'unsupported locale' using errcode='22023'; end if;
  if p_session_id !~ '^[A-Za-z0-9._~-]{1,200}$' then raise exception 'invalid session id' using errcode='22023'; end if;
  if p_capabilities is null or cardinality(p_capabilities)=0 or cardinality(p_capabilities)<>cardinality(array(select distinct x from unnest(p_capabilities) x)) then
    raise exception 'capabilities must be unique and non-empty' using errcode='22023';
  end if;
  if exists(select 1 from unnest(p_capabilities) x where not (x=any(v_allowed))) then
    raise exception 'unsupported capability' using errcode='22023';
  end if;
  if exists(select 1 from public.eutaktos_entities where tenant_id=p_tenant_id)
    or exists(select 1 from public.eutaktos_access_grants where tenant_id=p_tenant_id)
    or exists(select 1 from public.eutaktos_sessions where tenant_id=p_tenant_id) then
    raise exception 'pilot tenant is not empty' using errcode='23505';
  end if;

  insert into public.eutaktos_entities(tenant_id,entity_type,entity_id,data)
  values(p_tenant_id,'person',p_actor_id,jsonb_build_object(
    'id',p_actor_id,'tenantId',p_tenant_id,'displayName',btrim(p_display_name),'preferredLocale',p_locale,
    'active',true,'availability',jsonb_build_array(),'eligibility',jsonb_build_array(),'emergencyContacts',jsonb_build_array()
  ));

  insert into public.eutaktos_audit(tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
  values(p_tenant_id,'audit-bootstrap-person','person',p_actor_id,'create',p_actor_id,p_now,array['active','displayName','preferredLocale']);
  insert into public.eutaktos_outbox(tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,payload)
  values(p_tenant_id,'event-bootstrap-person','PersonCreated',p_actor_id,p_actor_id,p_now,1,'{}'::jsonb);

  foreach v_capability in array p_capabilities loop
    v_suffix:=md5(v_capability);
    insert into public.eutaktos_access_grants(tenant_id,id,subject_id,capability,granted_by,granted_at)
    values(p_tenant_id,'grant-bootstrap-'||v_suffix,p_actor_id,v_capability,p_actor_id,p_now);
    insert into public.eutaktos_audit(tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields)
    values(p_tenant_id,'audit-bootstrap-grant-'||v_suffix,'access-grant','grant-bootstrap-'||v_suffix,'grant',p_actor_id,p_now,array['capability','subjectId']);
    insert into public.eutaktos_outbox(tenant_id,id,event_type,aggregate_id,actor_id,occurred_at,schema_version,payload)
    values(p_tenant_id,'event-bootstrap-grant-'||v_suffix,'CapabilityGranted','grant-bootstrap-'||v_suffix,p_actor_id,p_now,1,'{}'::jsonb);
  end loop;

  insert into public.eutaktos_sessions(id,tenant_id,actor_id,issued_at,idle_expires_at,absolute_expires_at,idle_timeout_ms)
  values(p_session_id,p_tenant_id,p_actor_id,p_now,p_now+interval '30 minutes',p_now+interval '12 hours',1800000);
  return p_session_id;
end;
$$;

revoke all on function public.eutaktos_bootstrap_pilot(text,text,text,text,text[],text,timestamptz) from public,anon,authenticated;
grant execute on function public.eutaktos_bootstrap_pilot(text,text,text,text,text[],text,timestamptz) to service_role;

commit;

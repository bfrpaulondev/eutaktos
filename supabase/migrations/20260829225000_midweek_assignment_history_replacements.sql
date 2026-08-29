begin;

create or replace function public.eutaktos_apply_scheduling_entity_change(
  p_tenant_id text,
  p_entity_type text,
  p_entity_id text,
  p_data jsonb,
  p_expected_version bigint,
  p_audit jsonb,
  p_event jsonb,
  p_history jsonb default '[]'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version bigint;
  v_item jsonb;
  v_history jsonb := coalesce(p_history, '[]'::jsonb);
begin
  if p_entity_type not in ('midweek-meeting', 'student-assignment', 'non-student-assignment') then
    raise exception 'invalid scheduling entity type' using errcode = '22023';
  end if;
  if jsonb_typeof(v_history) <> 'array' or jsonb_array_length(v_history) > 4 then
    raise exception 'invalid scheduling history payload' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_history)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or v_item->>'tenantId' <> p_tenant_id
       or btrim(coalesce(v_item->>'id', '')) = ''
       or btrim(coalesce(v_item->>'assignmentId', '')) = ''
       or btrim(coalesce(v_item->>'personId', '')) = ''
       or btrim(coalesce(v_item->>'partType', '')) = ''
       or btrim(coalesce(v_item->>'meetingId', '')) = ''
       or (v_item->>'state') not in ('assigned', 'completed', 'cancelled')
       or btrim(coalesce(v_item->>'meetingDate', '')) = ''
       or btrim(coalesce(v_item->>'recordedAt', '')) = '' then
      raise exception 'invalid scheduling history record' using errcode = '22023';
    end if;
  end loop;

  v_version := public.eutaktos_apply_entity_change(
    p_tenant_id,
    p_entity_type,
    p_entity_id,
    p_data,
    p_expected_version,
    p_audit,
    p_event
  );

  for v_item in select value from jsonb_array_elements(v_history)
  loop
    insert into public.eutaktos_assignment_history (
      tenant_id, id, assignment_id, person_id, part_type, meeting_id, meeting_date, state, recorded_at
    ) values (
      p_tenant_id,
      v_item->>'id',
      v_item->>'assignmentId',
      v_item->>'personId',
      v_item->>'partType',
      v_item->>'meetingId',
      (v_item->>'meetingDate')::date,
      v_item->>'state',
      (v_item->>'recordedAt')::timestamptz
    );
  end loop;

  return v_version;
end;
$$;

revoke all on function public.eutaktos_apply_scheduling_entity_change(text,text,text,jsonb,bigint,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.eutaktos_apply_scheduling_entity_change(text,text,text,jsonb,bigint,jsonb,jsonb,jsonb) to service_role;

commit;

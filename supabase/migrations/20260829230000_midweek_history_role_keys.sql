begin;

-- Distinguish the same part when a person serves as student versus assistant.
-- Non-student roles are also namespaced. This makes recency answer the exact
-- operational question: "when did this person last serve in this function?"
create or replace function public.eutaktos_capture_assignment_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meeting jsonb;
  v_meeting_id text;
  v_meeting_date date;
  v_slot_id text;
  v_part_definition text;
  v_student_part_type text;
  v_assistant_part_type text;
  v_non_student_part_type text;
  v_state text;
  v_recorded_at timestamptz;
  v_old_student text;
  v_old_assistant text;
  v_old_person text;
  v_new_student text;
  v_new_assistant text;
  v_new_person text;
begin
  if new.entity_type not in ('student-assignment','non-student-assignment') then
    return new;
  end if;

  v_meeting_id := new.data->>'meetingId';
  select e.data into v_meeting
    from public.eutaktos_entities e
   where e.tenant_id = new.tenant_id
     and e.entity_type = 'midweek-meeting'
     and e.entity_id = v_meeting_id
   limit 1;

  if v_meeting is null then raise exception 'assignment history meeting not found' using errcode='23503'; end if;
  if v_meeting->>'tenantId' <> new.tenant_id then raise exception 'assignment history tenant mismatch' using errcode='42501'; end if;

  v_meeting_date := (v_meeting->>'date')::date;
  v_state := new.data->>'state';
  if v_state not in ('assigned','completed','cancelled') then raise exception 'invalid assignment state for history' using errcode='22023'; end if;
  if v_state = 'assigned' then v_recorded_at := coalesce((new.data->>'assignedAt')::timestamptz,new.updated_at);
  elsif v_state = 'completed' then v_recorded_at := coalesce((new.data->>'completedAt')::timestamptz,new.updated_at);
  else v_recorded_at := coalesce((new.data->>'cancelledAt')::timestamptz,new.updated_at);
  end if;

  if new.entity_type = 'student-assignment' then
    v_slot_id := new.data->>'slotId';
    select slot->>'partDefinitionId' into v_part_definition
      from jsonb_array_elements(coalesce(v_meeting->'slots','[]'::jsonb)) slot
     where slot->>'id'=v_slot_id
     limit 1;
    if btrim(coalesce(v_part_definition,''))='' then raise exception 'assignment history part definition not found' using errcode='23503'; end if;
    v_student_part_type := 'student:' || v_part_definition;
    v_assistant_part_type := 'assistant:' || v_part_definition;

    v_new_student := nullif(btrim(new.data->>'studentId'),'');
    v_new_assistant := nullif(btrim(new.data->>'assistantId'),'');
    if v_new_student is null then raise exception 'student assignment missing student' using errcode='22023'; end if;

    if tg_op='UPDATE' then
      v_old_student := nullif(btrim(old.data->>'studentId'),'');
      v_old_assistant := nullif(btrim(old.data->>'assistantId'),'');
      if old.data->>'state'='assigned' and v_old_student is not null and v_old_student is distinct from v_new_student then
        perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_old_student,v_student_part_type,v_meeting_id,v_meeting_date,'cancelled',new.updated_at);
      end if;
      if old.data->>'state'='assigned' and v_old_assistant is not null and v_old_assistant is distinct from v_new_assistant then
        perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_old_assistant,v_assistant_part_type,v_meeting_id,v_meeting_date,'cancelled',new.updated_at);
      end if;
    end if;

    perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_new_student,v_student_part_type,v_meeting_id,v_meeting_date,v_state,v_recorded_at);
    if v_new_assistant is not null then
      perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_new_assistant,v_assistant_part_type,v_meeting_id,v_meeting_date,v_state,v_recorded_at);
    end if;
  else
    v_new_person := nullif(btrim(new.data->>'personId'),'');
    if v_new_person is null or btrim(coalesce(new.data->>'role',''))='' then raise exception 'non-student assignment history identity missing' using errcode='22023'; end if;
    v_non_student_part_type := 'role:' || btrim(new.data->>'role');

    if tg_op='UPDATE' then
      v_old_person := nullif(btrim(old.data->>'personId'),'');
      if old.data->>'state'='assigned' and v_old_person is not null and v_old_person is distinct from v_new_person then
        perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_old_person,v_non_student_part_type,v_meeting_id,v_meeting_date,'cancelled',new.updated_at);
      end if;
    end if;

    perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_new_person,v_non_student_part_type,v_meeting_id,v_meeting_date,v_state,v_recorded_at);
  end if;

  return new;
end;
$$;
revoke all on function public.eutaktos_capture_assignment_history() from public, anon, authenticated;
grant execute on function public.eutaktos_capture_assignment_history() to service_role;

commit;

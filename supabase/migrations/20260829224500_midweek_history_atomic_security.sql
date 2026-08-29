begin;

-- The first history migration exposed SECURITY DEFINER RPCs to anon/authenticated.
-- History is a server-side scheduling concern: only the service role may execute
-- these functions. Tenant authorization continues to happen in the API boundary.
revoke all on function public.eutaktos_record_assignment_history(text,text,text,text,text,text,date,text,timestamptz) from public, anon, authenticated;
revoke all on function public.eutaktos_list_assignment_history(text) from public, anon, authenticated;
grant execute on function public.eutaktos_record_assignment_history(text,text,text,text,text,text,date,text,timestamptz) to service_role;
grant execute on function public.eutaktos_list_assignment_history(text) to service_role;

-- Internal append helper. IDs are deterministic per assignment lifecycle fact so
-- retries cannot duplicate history rows.
create or replace function public.eutaktos_append_assignment_history_internal(
  p_tenant_id text,
  p_assignment_id text,
  p_person_id text,
  p_part_type text,
  p_meeting_id text,
  p_meeting_date date,
  p_state text,
  p_recorded_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text;
begin
  if btrim(coalesce(p_tenant_id, '')) = ''
     or btrim(coalesce(p_assignment_id, '')) = ''
     or btrim(coalesce(p_person_id, '')) = ''
     or btrim(coalesce(p_part_type, '')) = ''
     or btrim(coalesce(p_meeting_id, '')) = ''
     or p_meeting_date is null
     or p_recorded_at is null
     or p_state not in ('assigned','completed','cancelled') then
    raise exception 'invalid assignment history fact' using errcode = '22023';
  end if;

  v_id := 'history-' || md5(
    p_tenant_id || chr(31) || p_assignment_id || chr(31) || p_person_id || chr(31) ||
    p_part_type || chr(31) || p_state || chr(31) || p_recorded_at::text
  );

  insert into public.eutaktos_assignment_history
    (tenant_id,id,assignment_id,person_id,part_type,meeting_id,meeting_date,state,recorded_at)
  values
    (p_tenant_id,v_id,p_assignment_id,p_person_id,p_part_type,p_meeting_id,p_meeting_date,p_state,p_recorded_at)
  on conflict (tenant_id,id) do nothing;
end;
$$;
revoke all on function public.eutaktos_append_assignment_history_internal(text,text,text,text,text,date,text,timestamptz) from public, anon, authenticated;

-- History is captured by the database in the SAME transaction as the canonical
-- assignment entity, audit and outbox write. This removes the former best-effort
-- post-commit gap. Student + assistant are both recorded.
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
  v_part_type text;
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

  if v_meeting is null then
    raise exception 'assignment history meeting not found' using errcode = '23503';
  end if;
  if v_meeting->>'tenantId' <> new.tenant_id then
    raise exception 'assignment history tenant mismatch' using errcode = '42501';
  end if;

  v_meeting_date := (v_meeting->>'date')::date;
  v_state := new.data->>'state';
  if v_state not in ('assigned','completed','cancelled') then
    raise exception 'invalid assignment state for history' using errcode = '22023';
  end if;

  if v_state = 'assigned' then
    v_recorded_at := coalesce((new.data->>'assignedAt')::timestamptz, new.updated_at);
  elsif v_state = 'completed' then
    v_recorded_at := coalesce((new.data->>'completedAt')::timestamptz, new.updated_at);
  else
    v_recorded_at := coalesce((new.data->>'cancelledAt')::timestamptz, new.updated_at);
  end if;

  if new.entity_type = 'student-assignment' then
    v_slot_id := new.data->>'slotId';
    select coalesce(slot->>'partDefinitionId', 'slot:' || v_slot_id)
      into v_part_type
      from jsonb_array_elements(coalesce(v_meeting->'slots','[]'::jsonb)) slot
     where slot->>'id' = v_slot_id
     limit 1;
    if v_part_type is null then
      raise exception 'assignment history slot not found' using errcode = '23503';
    end if;

    v_new_student := nullif(btrim(new.data->>'studentId'), '');
    v_new_assistant := nullif(btrim(new.data->>'assistantId'), '');
    if v_new_student is null then raise exception 'student assignment missing student' using errcode='22023'; end if;

    -- If an assigned person is replaced without an explicit cancellation state,
    -- retain the old person's lifecycle fact as cancelled at this mutation time.
    if tg_op = 'UPDATE' then
      v_old_student := nullif(btrim(old.data->>'studentId'), '');
      v_old_assistant := nullif(btrim(old.data->>'assistantId'), '');
      if old.data->>'state' = 'assigned' and v_old_student is not null and v_old_student is distinct from v_new_student then
        perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_old_student,v_part_type,v_meeting_id,v_meeting_date,'cancelled',new.updated_at);
      end if;
      if old.data->>'state' = 'assigned' and v_old_assistant is not null and v_old_assistant is distinct from v_new_assistant then
        perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_old_assistant,v_part_type,v_meeting_id,v_meeting_date,'cancelled',new.updated_at);
      end if;
    end if;

    perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_new_student,v_part_type,v_meeting_id,v_meeting_date,v_state,v_recorded_at);
    if v_new_assistant is not null then
      perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_new_assistant,v_part_type,v_meeting_id,v_meeting_date,v_state,v_recorded_at);
    end if;
  else
    v_part_type := nullif(btrim(new.data->>'role'), '');
    v_new_person := nullif(btrim(new.data->>'personId'), '');
    if v_part_type is null or v_new_person is null then
      raise exception 'non-student assignment history identity missing' using errcode='22023';
    end if;

    if tg_op = 'UPDATE' then
      v_old_person := nullif(btrim(old.data->>'personId'), '');
      if old.data->>'state' = 'assigned' and v_old_person is not null and v_old_person is distinct from v_new_person then
        perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_old_person,v_part_type,v_meeting_id,v_meeting_date,'cancelled',new.updated_at);
      end if;
    end if;

    perform public.eutaktos_append_assignment_history_internal(new.tenant_id,new.entity_id,v_new_person,v_part_type,v_meeting_id,v_meeting_date,v_state,v_recorded_at);
  end if;

  return new;
end;
$$;
revoke all on function public.eutaktos_capture_assignment_history() from public, anon, authenticated;

drop trigger if exists eutaktos_capture_assignment_history on public.eutaktos_entities;
create trigger eutaktos_capture_assignment_history
  after insert or update of data on public.eutaktos_entities
  for each row
  when (new.entity_type in ('student-assignment','non-student-assignment'))
  execute function public.eutaktos_capture_assignment_history();

-- The application still calls this compatibility RPC after a successful entity
-- commit. History is now already captured atomically by the trigger, so the RPC
-- intentionally performs no write. Keeping the signature avoids a breaking API
-- change while removing duplicate/non-atomic history writes.
create or replace function public.eutaktos_record_assignment_history(
  p_tenant_id text,
  p_id text,
  p_assignment_id text,
  p_person_id text,
  p_part_type text,
  p_meeting_id text,
  p_meeting_date date,
  p_state text,
  p_recorded_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if btrim(coalesce(p_tenant_id, '')) = '' then
    raise exception 'tenant_id is required' using errcode='22023';
  end if;
  return;
end;
$$;
revoke all on function public.eutaktos_record_assignment_history(text,text,text,text,text,text,date,text,timestamptz) from public, anon, authenticated;
grant execute on function public.eutaktos_record_assignment_history(text,text,text,text,text,text,date,text,timestamptz) to service_role;

commit;

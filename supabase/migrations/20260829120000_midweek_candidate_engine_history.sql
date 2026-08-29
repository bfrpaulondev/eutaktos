-- Midweek meeting scheduling — Candidate Engine persistence layer
-- Adds the assignment_history table required by the Candidate Engine's recency
-- calculations. The history is append-only and tenant-isolated, matching the
-- immutable/audited schedule history requirement of EPIC #5.
--
-- The Candidate Engine (packages/domain/src/candidate-engine.ts) consults this
-- table via the SchedulingSnapshotUnitOfWork.listAssignmentHistory method to
-- compute daysSinceLastAssignment, recentAssignmentCount, lastAssignmentDate
-- for each candidate.

begin;

-- Append-only assignment history.
-- Each row represents a single historical fact about an assignment:
--   - assignmentId (the StudentAssignment or NonStudentAssignment id)
--   - personId (student, assistant, or non-student assignee)
--   - partType (the part definition id, or the role string for non-student)
--   - meetingDate (YYYY-MM-DD, the date of the meeting the assignment belongs to)
--   - state ('assigned' | 'completed' | 'cancelled')
--   - recordedAt (ISO 8601 instant)
--   - meetingId (the MidweekMeeting id)
--
-- Rows are NEVER updated or deleted. The state column reflects the latest
-- observed state when the row was recorded (typically 'completed' or 'cancelled').
-- For recency, only 'completed' rows are considered.
create table if not exists public.eutaktos_assignment_history (
  tenant_id text not null check (length(btrim(tenant_id)) between 1 and 200),
  id text not null check (length(btrim(id)) between 1 and 200),
  assignment_id text not null check (length(btrim(assignment_id)) between 1 and 200),
  person_id text not null check (length(btrim(person_id)) between 1 and 200),
  part_type text not null check (length(btrim(part_type)) between 1 and 200),
  meeting_id text not null check (length(btrim(meeting_id)) between 1 and 200),
  meeting_date date not null,
  state text not null check (state in ('assigned', 'completed', 'cancelled')),
  recorded_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create index if not exists eutaktos_assignment_history_tenant_person_idx
  on public.eutaktos_assignment_history (tenant_id, person_id, meeting_date desc, id desc);

create index if not exists eutaktos_assignment_history_tenant_part_idx
  on public.eutaktos_assignment_history (tenant_id, part_type, meeting_date desc, id desc);

create index if not exists eutaktos_assignment_history_tenant_meeting_idx
  on public.eutaktos_assignment_history (tenant_id, meeting_id, meeting_date desc, id desc);

-- Append-only guard: rows can only be inserted, never updated or deleted.
-- We use a BEFORE UPDATE / DELETE trigger that raises an exception.
create or replace function public.eutaktos_assignment_history_no_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'eutaktos_assignment_history is append-only';
end;
$$;

drop trigger if exists eutaktos_assignment_history_block_update on public.eutaktos_assignment_history;
create trigger eutaktos_assignment_history_block_update
  before update or delete on public.eutaktos_assignment_history
  for each row execute function public.eutaktos_assignment_history_no_update();

-- Enable RLS. Policies restrict rows by tenant_id, matching the JWT-derived tenant.
alter table public.eutaktos_assignment_history enable row level security;

drop policy if exists eutaktos_assignment_history_tenant_read on public.eutaktos_assignment_history;
create policy eutaktos_assignment_history_tenant_read
  on public.eutaktos_assignment_history
  for select
  using (
    tenant_id = coalesce(nullif(current_setting('request.tenant_id', true), ''), '')
    or tenant_id = (auth.jwt() ->> 'tenant_id')::text
  );

drop policy if exists eutaktos_assignment_history_tenant_insert on public.eutaktos_assignment_history;
create policy eutaktos_assignment_history_tenant_insert
  on public.eutaktos_assignment_history
  for insert
  with check (
    tenant_id = coalesce(nullif(current_setting('request.tenant_id', true), ''), '')
    or tenant_id = (auth.jwt() ->> 'tenant_id')::text
  );

-- Helper RPC: append a single history record with tenant validation.
-- This is called by the application layer (via SupabaseRestDatabase) after a
-- successful assignment creation/completion/cancellation, in the same logical
-- transaction as the audit/outbox writes.
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
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(btrim(p_tenant_id)) not between 1 and 200 then
    raise exception 'tenant_id is required';
  end if;
  if length(btrim(p_id)) not between 1 and 200 then
    raise exception 'id is required';
  end if;
  if length(btrim(p_assignment_id)) not between 1 and 200 then
    raise exception 'assignment_id is required';
  end if;
  if length(btrim(p_person_id)) not between 1 and 200 then
    raise exception 'person_id is required';
  end if;
  if length(btrim(p_part_type)) not between 1 and 200 then
    raise exception 'part_type is required';
  end if;
  if length(btrim(p_meeting_id)) not between 1 and 200 then
    raise exception 'meeting_id is required';
  end if;
  if p_state not in ('assigned', 'completed', 'cancelled') then
    raise exception 'state must be assigned, completed or cancelled';
  end if;
  if p_meeting_date is null then
    raise exception 'meeting_date is required';
  end if;
  if p_recorded_at is null then
    raise exception 'recorded_at is required';
  end if;

  insert into public.eutaktos_assignment_history (
    tenant_id, id, assignment_id, person_id, part_type, meeting_id, meeting_date, state, recorded_at
  ) values (
    p_tenant_id, p_id, p_assignment_id, p_person_id, p_part_type, p_meeting_id, p_meeting_date, p_state, p_recorded_at
  )
  on conflict (tenant_id, id) do nothing;
end;
$$;

grant execute on function public.eutaktos_record_assignment_history to authenticated, anon;

-- Read function: list all assignment history for a tenant, newest first.
-- Returns rows as JSON for direct hydration into AssignmentHistoryRecord.
create or replace function public.eutaktos_list_assignment_history(
  p_tenant_id text
)
returns table (
  id text,
  tenant_id text,
  assignment_id text,
  person_id text,
  part_type text,
  meeting_id text,
  meeting_date date,
  state text,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(btrim(p_tenant_id)) not between 1 and 200 then
    raise exception 'tenant_id is required';
  end if;
  return query
    select
      h.id, h.tenant_id, h.assignment_id, h.person_id, h.part_type, h.meeting_id, h.meeting_date, h.state, h.recorded_at
    from public.eutaktos_assignment_history h
    where h.tenant_id = p_tenant_id
    order by h.meeting_date desc, h.recorded_at desc, h.id desc;
end;
$$;

grant execute on function public.eutaktos_list_assignment_history to authenticated, anon;

commit;

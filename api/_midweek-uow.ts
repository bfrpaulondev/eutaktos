import type {
  MidweekSchedulingChange,
  MidweekSchedulingRuntime,
  MidweekSchedulingUnitOfWork,
  SchedulingIdScope,
  SchedulingWindow,
} from '@eutaktos/application';
import {
  assertCapability,
  assertResourceTenant,
  findSlotById,
  normalizeAssignmentHistoryRecord,
  type AccessContext,
  type AssignmentHistoryRecord,
  type ConflictAssignment,
  type CongregationPerson,
  type MidweekMeeting,
  type MidweekPartDefinition,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import type { AssignmentHistoryRow, EntityRow } from './_db';
import { SupabaseRestDatabase } from './_db';

type TenantEntity = { readonly id: string; readonly tenantId: string };
type Snapshot<T> = { readonly value: T; readonly version: number };
type StoredPartDefinition = MidweekPartDefinition & TenantEntity;
type HistoryState = 'assigned' | 'completed' | 'cancelled';

interface PendingHistoryRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly assignmentId: string;
  readonly personId: string;
  readonly partType: string;
  readonly meetingId: string;
  readonly meetingDate: string;
  readonly state: HistoryState;
  readonly recordedAt: string;
}

interface PendingSchedulingChange {
  readonly entityType: 'midweek-meeting' | 'student-assignment' | 'non-student-assignment';
  readonly entityId: string;
  readonly data: TenantEntity;
  readonly expectedVersion: number | null;
  readonly auditEvent: unknown;
  readonly domainEvent: unknown;
  readonly history: readonly PendingHistoryRecord[];
}

function storedEntity<T extends TenantEntity>(row: EntityRow, tenantId: string): T {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error('Invalid stored scheduling entity');
  }
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored scheduling entity identity');
  return data as T;
}

function ensureTenant(context: AccessContext, tenantId: string): void {
  if (context.tenantId !== tenantId) throw new Error('Cross-tenant access denied');
}

function cloneMeeting(value: Readonly<MidweekMeeting>): Readonly<MidweekMeeting> {
  return Object.freeze({
    ...structuredClone(value),
    slots: Object.freeze(structuredClone(value.slots).map(slot => Object.freeze(slot))),
  });
}

function clonePerson(value: CongregationPerson): CongregationPerson {
  return Object.freeze({
    ...structuredClone(value),
    availability: Object.freeze(structuredClone(value.availability).map(period => Object.freeze(period))),
    eligibility: Object.freeze(structuredClone(value.eligibility).map(item => Object.freeze(item))),
    ...(value.emergencyContacts
      ? { emergencyContacts: Object.freeze(structuredClone(value.emergencyContacts).map(item => Object.freeze(item))) }
      : {}),
  });
}

function clonePart(value: Readonly<MidweekPartDefinition>): Readonly<MidweekPartDefinition> {
  return Object.freeze({
    ...structuredClone(value),
    tenantOverrides: Object.freeze(structuredClone(value.tenantOverrides).map(item => Object.freeze(item))),
  });
}

function dateTimeParts(timeZone: string, instantMs: number): Readonly<{ year: number; month: number; day: number; hour: number; minute: number; second: number }> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));
  const number = (type: Intl.DateTimeFormatPartTypes): number => {
    const raw = parts.find(part => part.type === type)?.value;
    const value = raw === undefined ? Number.NaN : Number(raw);
    if (!Number.isInteger(value)) throw new Error('Unable to resolve meeting timezone');
    return value;
  };
  return Object.freeze({
    year: number('year'),
    month: number('month'),
    day: number('day'),
    hour: number('hour'),
    minute: number('minute'),
    second: number('second'),
  });
}

function sameLocalParts(parts: ReturnType<typeof dateTimeParts>, year: number, month: number, day: number, hour: number, minute: number): boolean {
  return parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute;
}

/** Resolve an IANA-zone local wall clock to an instant without trusting a client-provided UTC offset. */
export function meetingStartInstant(meeting: Pick<MidweekMeeting, 'date' | 'localTime' | 'timezone'>): number {
  const [year, month, day] = meeting.date.split('-').map(Number);
  const [hour, minute] = meeting.localTime.split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isInteger)) throw new Error('Invalid meeting local date/time');
  new Intl.DateTimeFormat('en', { timeZone: meeting.timezone }).format(new Date(0));
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = localAsUtc;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const observed = dateTimeParts(meeting.timezone, candidate);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second, 0);
    const next = candidate + (localAsUtc - observedAsUtc);
    if (next === candidate) break;
    candidate = next;
  }
  const requestedMatch = sameLocalParts(dateTimeParts(meeting.timezone, candidate), year, month, day, hour, minute);
  if (!requestedMatch) throw new Error('Meeting local time does not exist in the configured timezone');
  const alternatives = [candidate - 3_600_000, candidate + 3_600_000]
    .filter(value => sameLocalParts(dateTimeParts(meeting.timezone, value), year, month, day, hour, minute));
  return Math.min(candidate, ...alternatives);
}

function schedulingChangeIdentity(value: unknown): Readonly<{ id: string; occurredAt: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid scheduling audit event');
  const record = value as Readonly<Record<string, unknown>>;
  if (typeof record.id !== 'string' || !record.id.trim() || typeof record.occurredAt !== 'string' || !Number.isFinite(Date.parse(record.occurredAt))) {
    throw new Error('Invalid scheduling audit event identity');
  }
  return Object.freeze({ id: record.id, occurredAt: record.occurredAt });
}

function historyState(value: string): HistoryState {
  if (value === 'assigned' || value === 'completed' || value === 'cancelled') return value;
  throw new Error(`Unsupported assignment history state: ${value}`);
}

function historyRow(input: Omit<PendingHistoryRecord, 'id'> & { id: string }): PendingHistoryRecord {
  return Object.freeze(input);
}

function historyForResource(
  tenantId: string,
  entityType: PendingSchedulingChange['entityType'],
  value: TenantEntity,
  meetings: ReadonlyMap<string, Snapshot<Readonly<MidweekMeeting>>>,
  auditEvent: unknown,
  previousStudent?: Readonly<StudentAssignment>,
  previousNonStudent?: Readonly<NonStudentAssignment>,
): readonly PendingHistoryRecord[] {
  if (entityType === 'midweek-meeting') return Object.freeze([]);
  const identity = schedulingChangeIdentity(auditEvent);

  if (entityType === 'student-assignment') {
    const assignment = value as StudentAssignment;
    const meeting = meetings.get(assignment.meetingId)?.value;
    if (!meeting) throw new Error('Student assignment references a missing meeting');
    const slot = findSlotById(meeting, assignment.slotId);
    if (!slot?.partDefinitionId) throw new Error('Student assignment references a slot without a part definition');
    const studentPartType = `student:${slot.partDefinitionId}`;
    const assistantPartType = `assistant:${slot.partDefinitionId}`;
    const rows: PendingHistoryRecord[] = [];

    if (previousStudent && previousStudent.studentId !== assignment.studentId) {
      rows.push(historyRow({
        id: `history-${identity.id}-previous-student`, tenantId, assignmentId: assignment.id,
        personId: previousStudent.studentId, partType: studentPartType, meetingId: meeting.id,
        meetingDate: meeting.date, state: 'cancelled', recordedAt: identity.occurredAt,
      }));
    }
    if (previousStudent?.assistantId && previousStudent.assistantId !== assignment.assistantId) {
      rows.push(historyRow({
        id: `history-${identity.id}-previous-assistant`, tenantId, assignmentId: assignment.id,
        personId: previousStudent.assistantId, partType: assistantPartType, meetingId: meeting.id,
        meetingDate: meeting.date, state: 'cancelled', recordedAt: identity.occurredAt,
      }));
    }

    rows.push(historyRow({
      id: `history-${identity.id}-student`, tenantId, assignmentId: assignment.id,
      personId: assignment.studentId, partType: studentPartType, meetingId: meeting.id,
      meetingDate: meeting.date, state: historyState(String(assignment.state)), recordedAt: identity.occurredAt,
    }));
    if (assignment.assistantId) {
      rows.push(historyRow({
        id: `history-${identity.id}-assistant`, tenantId, assignmentId: assignment.id,
        personId: assignment.assistantId, partType: assistantPartType, meetingId: meeting.id,
        meetingDate: meeting.date, state: historyState(String(assignment.state)), recordedAt: identity.occurredAt,
      }));
    }
    return Object.freeze(rows);
  }

  const assignment = value as NonStudentAssignment;
  const meeting = meetings.get(assignment.meetingId)?.value;
  if (!meeting) throw new Error('Non-student assignment references a missing meeting');
  const rows: PendingHistoryRecord[] = [];
  if (previousNonStudent && (previousNonStudent.personId !== assignment.personId || previousNonStudent.role !== assignment.role)) {
    rows.push(historyRow({
      id: `history-${identity.id}-previous-assignee`, tenantId, assignmentId: assignment.id,
      personId: previousNonStudent.personId, partType: `role:${previousNonStudent.role}`, meetingId: meeting.id,
      meetingDate: meeting.date, state: 'cancelled', recordedAt: identity.occurredAt,
    }));
  }
  rows.push(historyRow({
    id: `history-${identity.id}-assignee`, tenantId, assignmentId: assignment.id,
    personId: assignment.personId, partType: `role:${assignment.role}`, meetingId: meeting.id,
    meetingDate: meeting.date, state: historyState(String(assignment.state)), recordedAt: identity.occurredAt,
  }));
  return Object.freeze(rows);
}

export class SchedulingRuntimeIds implements MidweekSchedulingRuntime {
  now(): string { return new Date().toISOString(); }
  nextId(scope: SchedulingIdScope): string { return `${scope}-${crypto.randomUUID()}`; }
}

export interface SchedulingSnapshotRows {
  readonly meetings: readonly EntityRow[];
  readonly studentAssignments: readonly EntityRow[];
  readonly nonStudentAssignments: readonly EntityRow[];
  readonly people: readonly EntityRow[];
  readonly partDefinitions: readonly EntityRow[];
  readonly assignmentHistory?: readonly AssignmentHistoryRow[];
}

export class SchedulingSnapshotUnitOfWork implements MidweekSchedulingUnitOfWork {
  readonly #tenantId: string;
  readonly #meetings = new Map<string, Snapshot<Readonly<MidweekMeeting>>>();
  readonly #students = new Map<string, Snapshot<Readonly<StudentAssignment>>>();
  readonly #nonStudents = new Map<string, Snapshot<Readonly<NonStudentAssignment>>>();
  readonly #people = new Map<string, CongregationPerson>();
  readonly #parts = new Map<string, Readonly<MidweekPartDefinition>>();
  readonly #history: Readonly<AssignmentHistoryRecord>[];
  #pending?: PendingSchedulingChange;

  constructor(tenantId: string, rows: SchedulingSnapshotRows) {
    this.#tenantId = tenantId;
    for (const row of rows.meetings) this.#meetings.set(row.entity_id, { value: cloneMeeting(storedEntity<MidweekMeeting>(row, tenantId)), version: row.version });
    for (const row of rows.studentAssignments) this.#students.set(row.entity_id, { value: Object.freeze(structuredClone(storedEntity<StudentAssignment>(row, tenantId))), version: row.version });
    for (const row of rows.nonStudentAssignments) this.#nonStudents.set(row.entity_id, { value: Object.freeze(structuredClone(storedEntity<NonStudentAssignment>(row, tenantId))), version: row.version });
    for (const row of rows.people) this.#people.set(row.entity_id, clonePerson(storedEntity<CongregationPerson>(row, tenantId)));
    for (const row of rows.partDefinitions) {
      const stored = storedEntity<StoredPartDefinition>(row, tenantId);
      const { tenantId: _tenantId, ...part } = stored;
      if (this.#parts.has(part.id)) throw new Error('Duplicate part definition id');
      this.#parts.set(part.id, clonePart(part));
    }
    this.#history = (rows.assignmentHistory ?? []).map(row => normalizeAssignmentHistoryRecord({
      id: row.id,
      tenantId: row.tenant_id,
      assignmentId: row.assignment_id,
      personId: row.person_id,
      partType: row.part_type,
      meetingId: row.meeting_id,
      meetingDate: row.meeting_date,
      state: row.state,
      recordedAt: row.recorded_at,
    }));
  }

  #assertRead(context: AccessContext): void {
    ensureTenant(context, this.#tenantId);
    assertCapability(context, 'schedule.read');
  }

  #assertWrite(context: AccessContext): void {
    ensureTenant(context, this.#tenantId);
    assertCapability(context, 'schedule.write');
  }

  findMeeting(context: AccessContext, meetingId: string): Readonly<MidweekMeeting> | undefined {
    this.#assertRead(context);
    const value = this.#meetings.get(meetingId)?.value;
    return value ? cloneMeeting(value) : undefined;
  }

  findStudentAssignment(context: AccessContext, assignmentId: string): Readonly<StudentAssignment> | undefined {
    this.#assertRead(context);
    const value = this.#students.get(assignmentId)?.value;
    return value ? Object.freeze(structuredClone(value)) : undefined;
  }

  findNonStudentAssignment(context: AccessContext, assignmentId: string): Readonly<NonStudentAssignment> | undefined {
    this.#assertRead(context);
    const value = this.#nonStudents.get(assignmentId)?.value;
    return value ? Object.freeze(structuredClone(value)) : undefined;
  }

  listStudentAssignments(context: AccessContext, meetingId: string): readonly Readonly<StudentAssignment>[] {
    this.#assertRead(context);
    return Object.freeze([...this.#students.values()]
      .map(row => row.value)
      .filter(value => value.meetingId === meetingId)
      .map(value => Object.freeze(structuredClone(value))));
  }

  listNonStudentAssignments(context: AccessContext, meetingId: string): readonly Readonly<NonStudentAssignment>[] {
    this.#assertRead(context);
    return Object.freeze([...this.#nonStudents.values()]
      .map(row => row.value)
      .filter(value => value.meetingId === meetingId)
      .map(value => Object.freeze(structuredClone(value))));
  }

  listPeople(context: AccessContext): readonly CongregationPerson[] {
    this.#assertRead(context);
    return Object.freeze([...this.#people.values()].map(value => clonePerson(value)));
  }

  findPerson(context: AccessContext, personId: string): CongregationPerson | undefined {
    this.#assertRead(context);
    const value = this.#people.get(personId);
    return value ? clonePerson(value) : undefined;
  }

  findPartDefinition(partDefinitionId: string): Readonly<MidweekPartDefinition> | undefined {
    const value = this.#parts.get(partDefinitionId);
    return value ? clonePart(value) : undefined;
  }

  listPartDefinitions(context: AccessContext): readonly Readonly<MidweekPartDefinition>[] {
    this.#assertRead(context);
    return Object.freeze([...this.#parts.values()].map(value => clonePart(value)));
  }

  listAssignmentHistory(context: AccessContext): readonly Readonly<AssignmentHistoryRecord>[] {
    this.#assertRead(context);
    return Object.freeze(this.#history.map(value => Object.freeze(structuredClone(value))));
  }

  resolveSlotWindow(context: AccessContext, meeting: Readonly<MidweekMeeting>, slotId: string): SchedulingWindow {
    this.#assertRead(context);
    assertResourceTenant(context, meeting);
    const slot = findSlotById(meeting, slotId);
    if (!slot) throw new Error('Slot not found');
    const precedingMinutes = meeting.slots
      .filter(item => item.position < slot.position)
      .reduce((total, item) => total + item.durationMinutes, 0);
    const startsAtMs = meetingStartInstant(meeting) + precedingMinutes * 60_000;
    const endsAtMs = startsAtMs + slot.durationMinutes * 60_000;
    return Object.freeze({ startsAt: new Date(startsAtMs).toISOString(), endsAt: new Date(endsAtMs).toISOString() });
  }

  listConflictAssignments(context: AccessContext, personIds: readonly string[]): readonly ConflictAssignment[] {
    this.#assertRead(context);
    const wanted = new Set(personIds);
    const result: ConflictAssignment[] = [];
    for (const row of this.#students.values()) {
      const assignment = row.value;
      if (assignment.state !== 'assigned') continue;
      const meeting = this.#meetings.get(assignment.meetingId)?.value;
      if (!meeting) throw new Error('Assignment references a missing meeting');
      const window = this.resolveSlotWindow(context, meeting, assignment.slotId);
      if (wanted.has(assignment.studentId)) result.push(Object.freeze({ tenantId: this.#tenantId, assignmentId: `${assignment.id}:student`, personId: assignment.studentId, ...window }));
      if (assignment.assistantId && wanted.has(assignment.assistantId)) result.push(Object.freeze({ tenantId: this.#tenantId, assignmentId: `${assignment.id}:assistant`, personId: assignment.assistantId, ...window }));
    }
    for (const row of this.#nonStudents.values()) {
      const assignment = row.value;
      if (assignment.state !== 'assigned' || !wanted.has(assignment.personId)) continue;
      const meeting = this.#meetings.get(assignment.meetingId)?.value;
      if (!meeting) throw new Error('Assignment references a missing meeting');
      const window = this.resolveSlotWindow(context, meeting, assignment.slotId);
      result.push(Object.freeze({ tenantId: this.#tenantId, assignmentId: assignment.id, personId: assignment.personId, ...window }));
    }
    return Object.freeze(result.sort((left, right) => left.personId.localeCompare(right.personId) || left.assignmentId.localeCompare(right.assignmentId)));
  }

  commit(context: AccessContext, change: MidweekSchedulingChange): void {
    this.#assertWrite(context);
    if (this.#pending) throw new Error('Only one scheduling mutation is allowed per request');
    const resources: Array<{ entityType: PendingSchedulingChange['entityType']; value: TenantEntity; version: number | null }> = [];
    if (change.meeting) resources.push({ entityType: 'midweek-meeting', value: change.meeting, version: this.#meetings.get(change.meeting.id)?.version ?? null });
    if (change.studentAssignment) resources.push({ entityType: 'student-assignment', value: change.studentAssignment, version: this.#students.get(change.studentAssignment.id)?.version ?? null });
    if (change.nonStudentAssignment) resources.push({ entityType: 'non-student-assignment', value: change.nonStudentAssignment, version: this.#nonStudents.get(change.nonStudentAssignment.id)?.version ?? null });
    for (const value of change.studentAssignments ?? []) resources.push({ entityType: 'student-assignment', value, version: this.#students.get(value.id)?.version ?? null });
    for (const value of change.nonStudentAssignments ?? []) resources.push({ entityType: 'non-student-assignment', value, version: this.#nonStudents.get(value.id)?.version ?? null });

    if (resources.length !== 1 || change.auditEvents.length !== 1 || change.domainEvents.length !== 1) {
      throw new Error('Scheduling runtime transaction shape is unsupported');
    }
    const resource = resources[0];
    assertResourceTenant(context, resource.value);
    assertResourceTenant(context, change.auditEvents[0]);
    assertResourceTenant(context, change.domainEvents[0]);
    const previousStudent = resource.entityType === 'student-assignment' ? this.#students.get(resource.value.id)?.value : undefined;
    const previousNonStudent = resource.entityType === 'non-student-assignment' ? this.#nonStudents.get(resource.value.id)?.value : undefined;
    const history = historyForResource(
      this.#tenantId,
      resource.entityType,
      resource.value,
      this.#meetings,
      change.auditEvents[0],
      previousStudent,
      previousNonStudent,
    );
    this.#pending = Object.freeze({
      entityType: resource.entityType,
      entityId: resource.value.id,
      data: resource.value,
      expectedVersion: resource.version,
      auditEvent: change.auditEvents[0],
      domainEvent: change.domainEvents[0],
      history,
    });

    const nextVersion = (resource.version ?? 0) + 1;
    if (resource.entityType === 'midweek-meeting') this.#meetings.set(resource.value.id, { value: cloneMeeting(resource.value as MidweekMeeting), version: nextVersion });
    if (resource.entityType === 'student-assignment') this.#students.set(resource.value.id, { value: Object.freeze(structuredClone(resource.value as StudentAssignment)), version: nextVersion });
    if (resource.entityType === 'non-student-assignment') this.#nonStudents.set(resource.value.id, { value: Object.freeze(structuredClone(resource.value as NonStudentAssignment)), version: nextVersion });
  }

  async flush(database: SupabaseRestDatabase): Promise<void> {
    const pending = this.#pending;
    if (!pending) return;
    await database.applySchedulingEntityChange({
      p_tenant_id: this.#tenantId,
      p_entity_type: pending.entityType,
      p_entity_id: pending.entityId,
      p_data: pending.data,
      p_expected_version: pending.expectedVersion,
      p_audit: pending.auditEvent,
      p_event: pending.domainEvent,
      p_history: pending.history,
    });
    this.#pending = undefined;
  }
}

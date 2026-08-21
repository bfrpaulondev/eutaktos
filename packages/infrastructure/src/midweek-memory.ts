import type {
  MidweekSchedulingChange,
  MidweekSchedulingUnitOfWork,
  SchedulingWindow,
} from '@eutaktos/application';
import {
  assertCapability,
  assertResourceTenant,
  findSlotById,
  type AccessContext,
  type AuditEvent,
  type ConflictAssignment,
  type CongregationPerson,
  type DomainEvent,
  type MidweekMeeting,
  type MidweekPartDefinition,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';

function key(tenantId: string, id: string): string {
  return `${tenantId}\u0000${id}`;
}

function cloneMeeting(value: Readonly<MidweekMeeting>): Readonly<MidweekMeeting> {
  return Object.freeze({
    ...structuredClone(value),
    slots: Object.freeze(structuredClone(value.slots).map(slot => Object.freeze(slot))),
  });
}

function cloneStudent(value: Readonly<StudentAssignment>): Readonly<StudentAssignment> {
  return Object.freeze(structuredClone(value));
}

function cloneNonStudent(value: Readonly<NonStudentAssignment>): Readonly<NonStudentAssignment> {
  return Object.freeze(structuredClone(value));
}

function clonePerson(value: CongregationPerson): CongregationPerson {
  return Object.freeze({
    ...structuredClone(value),
    availability: Object.freeze(structuredClone(value.availability).map(period => Object.freeze(period))),
    eligibility: Object.freeze(structuredClone(value.eligibility).map(grant => Object.freeze(grant))),
    ...(value.emergencyContacts
      ? { emergencyContacts: Object.freeze(structuredClone(value.emergencyContacts).map(contact => Object.freeze(contact))) }
      : {}),
  });
}

function clonePart(value: Readonly<MidweekPartDefinition>): Readonly<MidweekPartDefinition> {
  return Object.freeze({
    ...structuredClone(value),
    tenantOverrides: Object.freeze(structuredClone(value.tenantOverrides).map(item => Object.freeze(item))),
  });
}

function cloneAudit(value: Readonly<AuditEvent>): Readonly<AuditEvent> {
  return Object.freeze({ ...structuredClone(value), changedFields: Object.freeze([...value.changedFields]) });
}

function cloneEvent(value: Readonly<DomainEvent>): Readonly<DomainEvent> {
  return Object.freeze(structuredClone(value));
}

export interface MidweekMemorySeed {
  readonly meetings?: readonly MidweekMeeting[];
  readonly studentAssignments?: readonly StudentAssignment[];
  readonly nonStudentAssignments?: readonly NonStudentAssignment[];
  readonly people?: readonly CongregationPerson[];
  readonly partDefinitions?: readonly MidweekPartDefinition[];
  readonly resolveSlotWindow?: (
    meeting: Readonly<MidweekMeeting>,
    slotId: string,
  ) => SchedulingWindow;
}

export class InMemoryMidweekSchedulingUnitOfWork implements MidweekSchedulingUnitOfWork {
  readonly #meetings = new Map<string, Readonly<MidweekMeeting>>();
  readonly #students = new Map<string, Readonly<StudentAssignment>>();
  readonly #nonStudents = new Map<string, Readonly<NonStudentAssignment>>();
  readonly #people = new Map<string, CongregationPerson>();
  readonly #parts = new Map<string, Readonly<MidweekPartDefinition>>();
  readonly #audit = new Map<string, Readonly<AuditEvent>>();
  readonly #outbox = new Map<string, Readonly<DomainEvent>>();
  readonly #windowResolver?: MidweekMemorySeed['resolveSlotWindow'];

  constructor(seed: MidweekMemorySeed = {}) {
    this.#windowResolver = seed.resolveSlotWindow;
    for (const meeting of seed.meetings ?? []) this.#insertUnique(this.#meetings, meeting.tenantId, meeting.id, cloneMeeting(meeting), 'meeting');
    for (const assignment of seed.studentAssignments ?? []) this.#insertUnique(this.#students, assignment.tenantId, assignment.id, cloneStudent(assignment), 'student assignment');
    for (const assignment of seed.nonStudentAssignments ?? []) this.#insertUnique(this.#nonStudents, assignment.tenantId, assignment.id, cloneNonStudent(assignment), 'non-student assignment');
    for (const person of seed.people ?? []) this.#insertUnique(this.#people, person.tenantId, person.id, clonePerson(person), 'person');
    for (const part of seed.partDefinitions ?? []) {
      if (this.#parts.has(part.id)) throw new Error('Duplicate part definition id');
      this.#parts.set(part.id, clonePart(part));
    }
  }

  #insertUnique<T>(map: Map<string, T>, tenantId: string, id: string, value: T, label: string): void {
    const storageKey = key(tenantId, id);
    if (map.has(storageKey)) throw new Error(`Duplicate tenant ${label} id`);
    map.set(storageKey, value);
  }

  #assertWrite(context: AccessContext): void {
    assertCapability(context, 'schedule.write');
  }

  findMeeting(context: AccessContext, meetingId: string): Readonly<MidweekMeeting> | undefined {
    this.#assertWrite(context);
    const meeting = this.#meetings.get(key(context.tenantId, meetingId));
    return meeting ? cloneMeeting(meeting) : undefined;
  }

  findStudentAssignment(context: AccessContext, assignmentId: string): Readonly<StudentAssignment> | undefined {
    this.#assertWrite(context);
    const assignment = this.#students.get(key(context.tenantId, assignmentId));
    return assignment ? cloneStudent(assignment) : undefined;
  }

  findNonStudentAssignment(context: AccessContext, assignmentId: string): Readonly<NonStudentAssignment> | undefined {
    this.#assertWrite(context);
    const assignment = this.#nonStudents.get(key(context.tenantId, assignmentId));
    return assignment ? cloneNonStudent(assignment) : undefined;
  }

  listStudentAssignments(context: AccessContext, meetingId: string): readonly Readonly<StudentAssignment>[] {
    this.#assertWrite(context);
    return [...this.#students.values()]
      .filter(item => item.tenantId === context.tenantId && item.meetingId === meetingId)
      .map(cloneStudent);
  }

  listNonStudentAssignments(context: AccessContext, meetingId: string): readonly Readonly<NonStudentAssignment>[] {
    this.#assertWrite(context);
    return [...this.#nonStudents.values()]
      .filter(item => item.tenantId === context.tenantId && item.meetingId === meetingId)
      .map(cloneNonStudent);
  }

  findPerson(context: AccessContext, personId: string): CongregationPerson | undefined {
    this.#assertWrite(context);
    const person = this.#people.get(key(context.tenantId, personId));
    return person ? clonePerson(person) : undefined;
  }

  findPartDefinition(partDefinitionId: string): Readonly<MidweekPartDefinition> | undefined {
    const part = this.#parts.get(partDefinitionId);
    return part ? clonePart(part) : undefined;
  }

  resolveSlotWindow(
    context: AccessContext,
    meeting: Readonly<MidweekMeeting>,
    slotId: string,
  ): SchedulingWindow {
    this.#assertWrite(context);
    assertResourceTenant(context, meeting);
    if (!findSlotById(meeting, slotId)) throw new Error('Slot not found');
    if (!this.#windowResolver) throw new Error('Scheduling window resolver is not configured');
    const window = this.#windowResolver(cloneMeeting(meeting), slotId);
    const start = Date.parse(window.startsAt);
    const end = Date.parse(window.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error('Scheduling window resolver returned an invalid window');
    }
    return Object.freeze({ startsAt: window.startsAt, endsAt: window.endsAt });
  }

  listConflictAssignments(context: AccessContext, personIds: readonly string[]): readonly ConflictAssignment[] {
    this.#assertWrite(context);
    const wanted = new Set(personIds);
    const result: ConflictAssignment[] = [];

    for (const assignment of this.#students.values()) {
      if (assignment.tenantId !== context.tenantId || assignment.state !== 'assigned') continue;
      const meeting = this.#meetings.get(key(context.tenantId, assignment.meetingId));
      if (!meeting) throw new Error('Assignment references a missing meeting');
      const window = this.resolveSlotWindow(context, meeting, assignment.slotId);
      if (wanted.has(assignment.studentId)) {
        result.push(Object.freeze({
          tenantId: context.tenantId,
          assignmentId: `${assignment.id}:student`,
          personId: assignment.studentId,
          ...window,
        }));
      }
      if (assignment.assistantId && wanted.has(assignment.assistantId)) {
        result.push(Object.freeze({
          tenantId: context.tenantId,
          assignmentId: `${assignment.id}:assistant`,
          personId: assignment.assistantId,
          ...window,
        }));
      }
    }

    for (const assignment of this.#nonStudents.values()) {
      if (assignment.tenantId !== context.tenantId || assignment.state !== 'assigned' || !wanted.has(assignment.personId)) continue;
      const meeting = this.#meetings.get(key(context.tenantId, assignment.meetingId));
      if (!meeting) throw new Error('Assignment references a missing meeting');
      const window = this.resolveSlotWindow(context, meeting, assignment.slotId);
      result.push(Object.freeze({
        tenantId: context.tenantId,
        assignmentId: assignment.id,
        personId: assignment.personId,
        ...window,
      }));
    }

    return Object.freeze(result.sort((a, b) => a.personId.localeCompare(b.personId) || a.assignmentId.localeCompare(b.assignmentId)));
  }

  commit(context: AccessContext, change: MidweekSchedulingChange): void {
    this.#assertWrite(context);
    const resources = [change.meeting, change.studentAssignment, change.nonStudentAssignment].filter(Boolean) as readonly { tenantId: string }[];
    for (const resource of resources) assertResourceTenant(context, resource);
    for (const audit of change.auditEvents) assertResourceTenant(context, audit);
    for (const event of change.domainEvents) assertResourceTenant(context, event);

    const auditKeys = new Set<string>();
    for (const audit of change.auditEvents) {
      const storageKey = key(context.tenantId, audit.id);
      if (auditKeys.has(storageKey) || this.#audit.has(storageKey)) throw new Error('Duplicate audit event id');
      auditKeys.add(storageKey);
    }
    const eventKeys = new Set<string>();
    for (const event of change.domainEvents) {
      const storageKey = key(context.tenantId, event.id);
      if (eventKeys.has(storageKey) || this.#outbox.has(storageKey)) throw new Error('Duplicate domain event id');
      eventKeys.add(storageKey);
    }

    if (change.meeting) this.#meetings.set(key(context.tenantId, change.meeting.id), cloneMeeting(change.meeting));
    if (change.studentAssignment) this.#students.set(key(context.tenantId, change.studentAssignment.id), cloneStudent(change.studentAssignment));
    if (change.nonStudentAssignment) this.#nonStudents.set(key(context.tenantId, change.nonStudentAssignment.id), cloneNonStudent(change.nonStudentAssignment));
    for (const audit of change.auditEvents) this.#audit.set(key(context.tenantId, audit.id), cloneAudit(audit));
    for (const event of change.domainEvents) this.#outbox.set(key(context.tenantId, event.id), cloneEvent(event));
  }

  listAudit(context: AccessContext): readonly Readonly<AuditEvent>[] {
    assertCapability(context, 'audit.read');
    return [...this.#audit.values()].filter(item => item.tenantId === context.tenantId).map(cloneAudit);
  }

  listOutbox(context: AccessContext): readonly Readonly<DomainEvent>[] {
    assertCapability(context, 'tenant.manage');
    return [...this.#outbox.values()].filter(item => item.tenantId === context.tenantId).map(cloneEvent);
  }
}

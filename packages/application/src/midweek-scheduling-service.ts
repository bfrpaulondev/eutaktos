import {
  addMeetingSlot,
  archiveMidweekMeeting,
  cancelMidweekMeeting,
  assertCapability,
  assertExplicitEligibility,
  assertNonStudentAssignmentTenant,
  assertResourceTenant,
  assertStudentAssignmentTenant,
  buildEligibilityIndex,
  cancelNonStudentAssignment,
  createAuditEvent,
  createDomainEvent,
  createMidweekMeeting,
  createNonStudentAssignment,
  createStudentAssignment,
  detectSchedulingConflicts,
  findSlotById,
  publishMidweekMeeting,
  removeMeetingSlot,
  transitionStudentAssignment,
  unavailableIntervalsForPerson,
  updateMidweekMeeting,
  type AccessContext,
  type AuditEvent,
  type ConflictAssignment,
  type CongregationPerson,
  type DomainEvent,
  type MeetingSlot,
  type MidweekMeeting,
  type MidweekPartDefinition,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import { eventCorrelation, type RequestMetadata } from './people-service';

export interface SchedulingWindow {
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface MidweekSchedulingChange {
  readonly meeting?: Readonly<MidweekMeeting>;
  readonly studentAssignment?: Readonly<StudentAssignment>;
  readonly nonStudentAssignment?: Readonly<NonStudentAssignment>;
  readonly auditEvents: readonly Readonly<AuditEvent>[];
  readonly domainEvents: readonly Readonly<DomainEvent>[];
}

/**
 * Every repository read is scoped by the trusted AccessContext. `commit` is the
 * transaction boundary: entity, audit rows and outbox events must succeed or fail
 * together. UTC slot windows come from trusted infrastructure, never request input.
 */
export interface MidweekSchedulingUnitOfWork {
  findMeeting(context: AccessContext, meetingId: string): Readonly<MidweekMeeting> | undefined;
  findStudentAssignment(context: AccessContext, assignmentId: string): Readonly<StudentAssignment> | undefined;
  findNonStudentAssignment(context: AccessContext, assignmentId: string): Readonly<NonStudentAssignment> | undefined;
  listStudentAssignments(context: AccessContext, meetingId: string): readonly Readonly<StudentAssignment>[];
  listNonStudentAssignments(context: AccessContext, meetingId: string): readonly Readonly<NonStudentAssignment>[];
  findPerson(context: AccessContext, personId: string): CongregationPerson | undefined;
  findPartDefinition(partDefinitionId: string): Readonly<MidweekPartDefinition> | undefined;
  listConflictAssignments(context: AccessContext, personIds: readonly string[]): readonly ConflictAssignment[];
  resolveSlotWindow(context: AccessContext, meeting: Readonly<MidweekMeeting>, slotId: string): SchedulingWindow;
  commit(context: AccessContext, change: MidweekSchedulingChange): void;
}

export type SchedulingIdScope =
  | 'midweek-meeting'
  | 'slot'
  | 'student-assignment'
  | 'non-student-assignment'
  | 'audit'
  | 'event';

export interface MidweekSchedulingRuntime {
  now(): string;
  nextId(scope: SchedulingIdScope): string;
}

export interface CreateMidweekMeetingInput {
  date: string;
  localTime: string;
  timezone: string;
  locationId?: string;
}

export interface AddMidweekSlotInput {
  position: number;
  durationMinutes: number;
  titleKey: string;
  partDefinitionId?: string;
}

export interface AssignStudentInput {
  meetingId: string;
  slotId: string;
  studentId: string;
  assistantId?: string | null;
}

export interface AssignNonStudentInput {
  meetingId: string;
  slotId: string;
  personId: string;
  role: string;
}

function id(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

function meetingEvent(
  runtime: MidweekSchedulingRuntime,
  context: AccessContext,
  type: 'MidweekMeetingCreated' | 'MidweekMeetingUpdated' | 'MidweekMeetingPublished' | 'MidweekMeetingCancelled' | 'MidweekMeetingArchived',
  meetingId: string,
  occurredAt: string,
  metadata: RequestMetadata,
): Readonly<DomainEvent> {
  return createDomainEvent({
    id: runtime.nextId('event'),
    tenantId: context.tenantId,
    type,
    aggregateId: meetingId,
    actorId: context.actorId,
    occurredAt,
    schemaVersion: 1,
    ...eventCorrelation(metadata),
  });
}

function assignmentEvent(
  runtime: MidweekSchedulingRuntime,
  context: AccessContext,
  type: 'AssignmentCreated' | 'AssignmentCancelled',
  assignmentId: string,
  occurredAt: string,
  metadata: RequestMetadata,
): Readonly<DomainEvent> {
  return createDomainEvent({
    id: runtime.nextId('event'),
    tenantId: context.tenantId,
    type,
    aggregateId: assignmentId,
    actorId: context.actorId,
    occurredAt,
    schemaVersion: 1,
    ...eventCorrelation(metadata),
  });
}

export class MidweekSchedulingService {
  readonly #uow: MidweekSchedulingUnitOfWork;
  readonly #runtime: MidweekSchedulingRuntime;

  constructor(uow: MidweekSchedulingUnitOfWork, runtime: MidweekSchedulingRuntime) {
    this.#uow = uow;
    this.#runtime = runtime;
  }

  #assertWrite(context: AccessContext): void {
    assertCapability(context, 'schedule.write');
  }

  #assertAssignmentReads(context: AccessContext): void {
    this.#assertWrite(context);
    assertCapability(context, 'eligibility.read');
    assertCapability(context, 'availability.read');
  }

  #meeting(context: AccessContext, meetingIdInput: string): Readonly<MidweekMeeting> {
    const meeting = this.#uow.findMeeting(context, id(meetingIdInput, 'meetingId'));
    if (!meeting) throw new Error('Meeting not found');
    assertResourceTenant(context, meeting);
    return meeting;
  }

  #person(context: AccessContext, personIdInput: string): CongregationPerson {
    const person = this.#uow.findPerson(context, id(personIdInput, 'personId'));
    if (!person) throw new Error('Person not found');
    assertResourceTenant(context, person);
    if (!person.active) throw new Error('Inactive person cannot receive an assignment');
    return person;
  }

  #audit(
    context: AccessContext,
    resourceType: 'midweek-meeting' | 'student-assignment' | 'non-student-assignment',
    resourceId: string,
    action: 'create' | 'update',
    changedFields: readonly string[],
    occurredAt: string,
  ): Readonly<AuditEvent> {
    return createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType,
      resourceId,
      action,
      actorId: context.actorId,
      occurredAt,
      changedFields,
    });
  }

  #assertNoConflict(
    context: AccessContext,
    assignmentId: string,
    person: CongregationPerson,
    window: SchedulingWindow,
  ): void {
    const candidate: ConflictAssignment = {
      tenantId: context.tenantId,
      assignmentId,
      personId: person.id,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
    };
    const conflicts = detectSchedulingConflicts({
      tenantId: context.tenantId,
      candidate,
      assignments: this.#uow.listConflictAssignments(context, [person.id]),
      unavailable: unavailableIntervalsForPerson(person, context.tenantId),
    });
    if (conflicts.length > 0) throw new Error('Scheduling conflict detected');
  }

  createDraftMeeting(
    context: AccessContext,
    input: CreateMidweekMeetingInput,
    metadata: RequestMetadata = {},
  ): Readonly<MidweekMeeting> {
    this.#assertWrite(context);
    const occurredAt = this.#runtime.now();
    const meeting = createMidweekMeeting({
      id: this.#runtime.nextId('midweek-meeting'),
      tenantId: context.tenantId,
      date: input.date,
      localTime: input.localTime,
      timezone: input.timezone,
      ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
      now: occurredAt,
    });
    this.#uow.commit(context, {
      meeting,
      auditEvents: [this.#audit(
        context,
        'midweek-meeting',
        meeting.id,
        'create',
        ['date', 'localTime', 'timezone', ...(meeting.locationId ? ['locationId'] : [])],
        occurredAt,
      )],
      domainEvents: [meetingEvent(this.#runtime, context, 'MidweekMeetingCreated', meeting.id, occurredAt, metadata)],
    });
    return meeting;
  }

  addSlot(
    context: AccessContext,
    meetingId: string,
    input: AddMidweekSlotInput,
    metadata: RequestMetadata = {},
  ): Readonly<MidweekMeeting> {
    this.#assertWrite(context);
    const current = this.#meeting(context, meetingId);
    const occurredAt = this.#runtime.now();
    const slot: MeetingSlot = {
      id: this.#runtime.nextId('slot'),
      position: input.position,
      durationMinutes: input.durationMinutes,
      titleKey: input.titleKey,
      ...(input.partDefinitionId !== undefined ? { partDefinitionId: input.partDefinitionId } : {}),
    };
    const meeting = Object.freeze({ ...addMeetingSlot(current, slot), updatedAt: occurredAt });
    this.#uow.commit(context, {
      meeting,
      auditEvents: [this.#audit(context, 'midweek-meeting', meeting.id, 'update', ['slots'], occurredAt)],
      domainEvents: [meetingEvent(this.#runtime, context, 'MidweekMeetingUpdated', meeting.id, occurredAt, metadata)],
    });
    return meeting;
  }

  removeSlot(
    context: AccessContext,
    meetingId: string,
    slotIdInput: string,
    metadata: RequestMetadata = {},
  ): Readonly<MidweekMeeting> {
    this.#assertWrite(context);
    const current = this.#meeting(context, meetingId);
    const slotId = id(slotIdInput, 'slotId');
    const occupied = [
      ...this.#uow.listStudentAssignments(context, current.id),
      ...this.#uow.listNonStudentAssignments(context, current.id),
    ].some(assignment => assignment.slotId === slotId && assignment.state === 'assigned');
    if (occupied) throw new Error('Cannot remove a slot with an active assignment');
    const occurredAt = this.#runtime.now();
    const meeting = Object.freeze({ ...removeMeetingSlot(current, slotId), updatedAt: occurredAt });
    this.#uow.commit(context, {
      meeting,
      auditEvents: [this.#audit(context, 'midweek-meeting', meeting.id, 'update', ['slots'], occurredAt)],
      domainEvents: [meetingEvent(this.#runtime, context, 'MidweekMeetingUpdated', meeting.id, occurredAt, metadata)],
    });
    return meeting;
  }

  updateMeeting(
    context: AccessContext,
    meetingId: string,
    changes: Parameters<typeof updateMidweekMeeting>[1],
    metadata: RequestMetadata = {},
  ): Readonly<MidweekMeeting> {
    this.#assertWrite(context);
    const current = this.#meeting(context, meetingId);
    const occurredAt = this.#runtime.now();
    const meeting = updateMidweekMeeting(current, changes, occurredAt);
    const changedFields = (['date', 'localTime', 'timezone', 'locationId'] as const).filter(field => current[field] !== meeting[field]);
    if (changedFields.length === 0) return current;
    this.#uow.commit(context, {
      meeting,
      auditEvents: [this.#audit(context, 'midweek-meeting', meeting.id, 'update', changedFields, occurredAt)],
      domainEvents: [meetingEvent(this.#runtime, context, 'MidweekMeetingUpdated', meeting.id, occurredAt, metadata)],
    });
    return meeting;
  }

  assignStudent(
    context: AccessContext,
    input: AssignStudentInput,
    metadata: RequestMetadata = {},
  ): Readonly<StudentAssignment> {
    this.#assertAssignmentReads(context);
    const meeting = this.#meeting(context, input.meetingId);
    if (meeting.state !== 'draft') throw new Error('Assignments can only be changed on draft meetings');
    const slot = findSlotById(meeting, id(input.slotId, 'slotId'));
    if (!slot) throw new Error('Slot not found');
    if (!slot.partDefinitionId) throw new Error('Student assignment requires a part definition');
    const part = this.#uow.findPartDefinition(slot.partDefinitionId);
    if (!part) throw new Error('Part definition not found');
    if (!part.studentNeeded) throw new Error('This part does not accept a student assignment');

    const student = this.#person(context, input.studentId);
    const assistant = input.assistantId ? this.#person(context, input.assistantId) : undefined;
    if (part.assistantRequirement === 'required' && !assistant) throw new Error('Assistant is required for this part');
    if (part.assistantRequirement === 'none' && assistant) throw new Error('Assistant is not allowed for this part');

    const eligibility = buildEligibilityIndex(assistant ? [student, assistant] : [student], context.tenantId);
    assertExplicitEligibility(eligibility, context.tenantId, student.id, part.id);
    if (assistant) assertExplicitEligibility(eligibility, context.tenantId, assistant.id, part.id);

    const occurredAt = this.#runtime.now();
    const assignmentId = this.#runtime.nextId('student-assignment');
    const window = this.#uow.resolveSlotWindow(context, meeting, slot.id);
    this.#assertNoConflict(context, `${assignmentId}:student`, student, window);
    if (assistant) this.#assertNoConflict(context, `${assignmentId}:assistant`, assistant, window);

    const assignment = createStudentAssignment({
      id: assignmentId,
      tenantId: context.tenantId,
      meetingId: meeting.id,
      slotId: slot.id,
      studentId: student.id,
      assistantId: assistant?.id ?? null,
      assistantIsRequired: part.assistantRequirement === 'required',
      now: occurredAt,
    });
    this.#uow.commit(context, {
      studentAssignment: assignment,
      auditEvents: [this.#audit(
        context,
        'student-assignment',
        assignment.id,
        'create',
        ['meetingId', 'slotId', 'studentId', ...(assistant ? ['assistantId'] : [])],
        occurredAt,
      )],
      domainEvents: [assignmentEvent(this.#runtime, context, 'AssignmentCreated', assignment.id, occurredAt, metadata)],
    });
    return assignment;
  }

  assignNonStudent(
    context: AccessContext,
    input: AssignNonStudentInput,
    metadata: RequestMetadata = {},
  ): Readonly<NonStudentAssignment> {
    this.#assertAssignmentReads(context);
    const meeting = this.#meeting(context, input.meetingId);
    if (meeting.state !== 'draft') throw new Error('Assignments can only be changed on draft meetings');
    const slot = findSlotById(meeting, id(input.slotId, 'slotId'));
    if (!slot) throw new Error('Slot not found');
    const person = this.#person(context, input.personId);
    const role = id(input.role, 'role');
    const eligibility = buildEligibilityIndex([person], context.tenantId);
    assertExplicitEligibility(eligibility, context.tenantId, person.id, role);

    const occurredAt = this.#runtime.now();
    const assignmentId = this.#runtime.nextId('non-student-assignment');
    const window = this.#uow.resolveSlotWindow(context, meeting, slot.id);
    this.#assertNoConflict(context, assignmentId, person, window);
    const assignment = createNonStudentAssignment({
      id: assignmentId,
      tenantId: context.tenantId,
      meetingId: meeting.id,
      slotId: slot.id,
      personId: person.id,
      role,
      now: occurredAt,
    });
    this.#uow.commit(context, {
      nonStudentAssignment: assignment,
      auditEvents: [this.#audit(
        context,
        'non-student-assignment',
        assignment.id,
        'create',
        ['meetingId', 'slotId', 'personId', 'role'],
        occurredAt,
      )],
      domainEvents: [assignmentEvent(this.#runtime, context, 'AssignmentCreated', assignment.id, occurredAt, metadata)],
    });
    return assignment;
  }

  cancelStudentAssignment(
    context: AccessContext,
    assignmentIdInput: string,
    metadata: RequestMetadata = {},
  ): Readonly<StudentAssignment> {
    this.#assertWrite(context);
    const assignmentId = id(assignmentIdInput, 'assignmentId');
    const current = this.#uow.findStudentAssignment(context, assignmentId);
    if (!current) throw new Error('Student assignment not found');
    assertStudentAssignmentTenant(current, context.tenantId);
    const occurredAt = this.#runtime.now();
    const assignment = transitionStudentAssignment(current, 'cancelled', occurredAt);
    this.#uow.commit(context, {
      studentAssignment: assignment,
      auditEvents: [this.#audit(context, 'student-assignment', assignment.id, 'update', ['state'], occurredAt)],
      domainEvents: [assignmentEvent(this.#runtime, context, 'AssignmentCancelled', assignment.id, occurredAt, metadata)],
    });
    return assignment;
  }

  cancelNonStudentAssignment(
    context: AccessContext,
    assignmentIdInput: string,
    metadata: RequestMetadata = {},
  ): Readonly<NonStudentAssignment> {
    this.#assertWrite(context);
    const assignmentId = id(assignmentIdInput, 'assignmentId');
    const current = this.#uow.findNonStudentAssignment(context, assignmentId);
    if (!current) throw new Error('Non-student assignment not found');
    assertNonStudentAssignmentTenant(current, context.tenantId);
    const occurredAt = this.#runtime.now();
    const assignment = cancelNonStudentAssignment(current, occurredAt);
    this.#uow.commit(context, {
      nonStudentAssignment: assignment,
      auditEvents: [this.#audit(context, 'non-student-assignment', assignment.id, 'update', ['state'], occurredAt)],
      domainEvents: [assignmentEvent(this.#runtime, context, 'AssignmentCancelled', assignment.id, occurredAt, metadata)],
    });
    return assignment;
  }

  publishMeeting(
    context: AccessContext,
    meetingId: string,
    metadata: RequestMetadata = {},
  ): Readonly<MidweekMeeting> {
    this.#assertWrite(context);
    const current = this.#meeting(context, meetingId);
    if (current.slots.length === 0) throw new Error('Cannot publish a meeting without slots');
    const activeStudent = this.#uow.listStudentAssignments(context, current.id).filter(item => item.state === 'assigned');
    const activeNonStudent = this.#uow.listNonStudentAssignments(context, current.id).filter(item => item.state === 'assigned');
    activeStudent.forEach(item => assertStudentAssignmentTenant(item, context.tenantId));
    activeNonStudent.forEach(item => assertNonStudentAssignmentTenant(item, context.tenantId));
    const filled = new Set([...activeStudent, ...activeNonStudent].map(item => item.slotId));
    if (current.slots.some(slot => !filled.has(slot.id))) throw new Error('Cannot publish a meeting with an unassigned slot');

    const occurredAt = this.#runtime.now();
    const meeting = publishMidweekMeeting(current, occurredAt);
    this.#uow.commit(context, {
      meeting,
      auditEvents: [this.#audit(context, 'midweek-meeting', meeting.id, 'update', ['state'], occurredAt)],
      domainEvents: [meetingEvent(this.#runtime, context, 'MidweekMeetingPublished', meeting.id, occurredAt, metadata)],
    });
    return meeting;
  }

  cancelMeeting(
    context: AccessContext,
    meetingId: string,
    metadata: RequestMetadata = {},
  ): Readonly<MidweekMeeting> {
    this.#assertWrite(context);
    const current = this.#meeting(context, meetingId);
    const occurredAt = this.#runtime.now();
    const meeting = cancelMidweekMeeting(current, occurredAt);
    this.#uow.commit(context, {
      meeting,
      auditEvents: [this.#audit(context, 'midweek-meeting', meeting.id, 'update', ['state'], occurredAt)],
      domainEvents: [meetingEvent(this.#runtime, context, 'MidweekMeetingCancelled', meeting.id, occurredAt, metadata)],
    });
    return meeting;
  }

  archiveMeeting(
    context: AccessContext,
    meetingId: string,
    metadata: RequestMetadata = {},
  ): Readonly<MidweekMeeting> {
    this.#assertWrite(context);
    const current = this.#meeting(context, meetingId);
    const occurredAt = this.#runtime.now();
    const meeting = archiveMidweekMeeting(current, occurredAt);
    this.#uow.commit(context, {
      meeting,
      auditEvents: [this.#audit(context, 'midweek-meeting', meeting.id, 'update', ['state'], occurredAt)],
      domainEvents: [meetingEvent(this.#runtime, context, 'MidweekMeetingArchived', meeting.id, occurredAt, metadata)],
    });
    return meeting;
  }
}

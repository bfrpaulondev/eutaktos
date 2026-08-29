import {
  assertCapability,
  assertExplicitEligibility,
  assertResourceTenant,
  assertStudentAssignmentTenant,
  buildEligibilityIndex,
  createAuditEvent,
  createDomainEvent,
  detectSchedulingConflicts,
  findSlotById,
  reassignStudentAssignment,
  transitionStudentAssignment,
  unavailableIntervalsForPerson,
  type AccessContext,
  type ConflictAssignment,
  type CongregationPerson,
  type StudentAssignment,
} from '@eutaktos/domain';
import type { MidweekSchedulingRuntime, MidweekSchedulingUnitOfWork, SchedulingWindow } from './midweek-scheduling-service';
import { eventCorrelation, type RequestMetadata } from './people-service';
import { assistantEligibilityTypeId, studentEligibilityTypeId } from './midweek-eligibility';

export interface ReplaceStudentAssignmentInput {
  readonly assignmentId: string;
  readonly studentId: string;
  readonly assistantId?: string | null;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

export class StudentAssignmentReplacementService {
  readonly #uow: MidweekSchedulingUnitOfWork;
  readonly #runtime: MidweekSchedulingRuntime;

  constructor(uow: MidweekSchedulingUnitOfWork, runtime: MidweekSchedulingRuntime) {
    this.#uow = uow;
    this.#runtime = runtime;
  }

  #person(context: AccessContext, personId: string): CongregationPerson {
    const person = this.#uow.findPerson(context, required(personId, 'personId'));
    if (!person) throw new Error('Person not found');
    assertResourceTenant(context, person);
    if (!person.active) throw new Error('Inactive person cannot receive an assignment');
    return person;
  }

  #assertNoConflict(context: AccessContext, currentId: string, candidateId: string, person: CongregationPerson, window: SchedulingWindow): void {
    const candidate: ConflictAssignment = Object.freeze({ tenantId: context.tenantId, assignmentId: candidateId, personId: person.id, startsAt: window.startsAt, endsAt: window.endsAt });
    const assignments = this.#uow.listConflictAssignments(context, [person.id]).filter(item => !item.assignmentId.startsWith(`${currentId}:`));
    const conflicts = detectSchedulingConflicts({ tenantId: context.tenantId, candidate, assignments, unavailable: unavailableIntervalsForPerson(person, context.tenantId) });
    if (conflicts.length > 0) throw new Error('Scheduling conflict detected');
  }

  replace(context: AccessContext, input: ReplaceStudentAssignmentInput, metadata: RequestMetadata = {}): Readonly<StudentAssignment> {
    assertCapability(context, 'schedule.write');
    assertCapability(context, 'eligibility.read');
    assertCapability(context, 'availability.read');

    const assignmentId = required(input.assignmentId, 'assignmentId');
    const current = this.#uow.findStudentAssignment(context, assignmentId);
    if (!current) throw new Error('Student assignment not found');
    assertStudentAssignmentTenant(current, context.tenantId);
    if (current.state !== 'assigned') throw new Error('Only assigned student assignments can be replaced');

    const studentId = required(input.studentId, 'studentId');
    const assistantId = input.assistantId === undefined || input.assistantId === null ? null : required(input.assistantId, 'assistantId');
    if (current.studentId === studentId && current.assistantId === assistantId) return current;

    const meeting = this.#uow.findMeeting(context, current.meetingId);
    if (!meeting) throw new Error('Meeting not found');
    assertResourceTenant(context, meeting);
    if (meeting.state !== 'draft') throw new Error('Assignments can only be changed on draft meetings');

    const slot = findSlotById(meeting, current.slotId);
    if (!slot?.partDefinitionId) throw new Error('Student assignment requires a part definition');
    const part = this.#uow.findPartDefinition(slot.partDefinitionId);
    if (!part || !part.studentNeeded) throw new Error('Student part definition not found');

    const student = this.#person(context, studentId);
    const assistant = assistantId ? this.#person(context, assistantId) : undefined;
    if (assistant?.id === student.id) throw new Error('Student and assistant must be different people');
    if (part.assistantRequirement === 'required' && !assistant) throw new Error('Assistant is required for this part');
    if (part.assistantRequirement === 'none' && assistant) throw new Error('Assistant is not allowed for this part');

    const eligibility = buildEligibilityIndex(assistant ? [student, assistant] : [student], context.tenantId);
    assertExplicitEligibility(eligibility, context.tenantId, student.id, studentEligibilityTypeId(part));
    if (assistant) assertExplicitEligibility(eligibility, context.tenantId, assistant.id, assistantEligibilityTypeId(part));

    const window = this.#uow.resolveSlotWindow(context, meeting, current.slotId);
    this.#assertNoConflict(context, current.id, `${current.id}:student`, student, window);
    if (assistant) this.#assertNoConflict(context, current.id, `${current.id}:assistant`, assistant, window);

    const occurredAt = this.#runtime.now();
    const cancelled = transitionStudentAssignment(current, 'cancelled', occurredAt);
    const replacement = reassignStudentAssignment(cancelled, student.id, assistant?.id ?? null, occurredAt);
    const audit = createAuditEvent({ id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'student-assignment', resourceId: replacement.id, action: 'update', actorId: context.actorId, occurredAt, changedFields: ['studentId', 'assistantId'] });
    const event = createDomainEvent({ id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'AssignmentReplaced', aggregateId: replacement.id, actorId: context.actorId, occurredAt, schemaVersion: 1, ...eventCorrelation(metadata) });
    this.#uow.commit(context, { studentAssignments: [replacement], auditEvents: [audit], domainEvents: [event] });
    return replacement;
  }
}

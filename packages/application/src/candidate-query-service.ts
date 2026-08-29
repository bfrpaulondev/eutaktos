import {
  assertCapability,
  assertResourceTenant,
  computeCandidates,
  findSlotById,
  type AccessContext,
  type AssignmentHistoryRecord,
  type CandidateProfile,
  type CandidateRole,
  type ConflictAssignment,
  type MidweekMeeting,
} from '@eutaktos/domain';
import type { MidweekSchedulingUnitOfWork, SchedulingWindow } from './midweek-scheduling-service';
import type { RequestMetadata } from './people-service';
import {
  assistantEligibilityTypeId,
  nonStudentEligibilityTypeId,
  studentEligibilityTypeId,
} from './midweek-eligibility';

export interface CandidateSlotQuery {
  readonly meetingId: string;
  readonly slotId: string;
  readonly role: CandidateRole;
  readonly excludePersonIds?: readonly string[];
}

export interface CandidateQueryResult {
  readonly meetingId: string;
  readonly slotId: string;
  readonly role: CandidateRole;
  /** Stable scheduling/history identity, not necessarily the eligibility id. */
  readonly assignmentTypeId: string;
  readonly window: SchedulingWindow;
  readonly candidates: readonly Readonly<CandidateProfile>[];
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  if (trimmed.length > 200) throw new Error(`${field} is too long`);
  return trimmed;
}

export class CandidateQueryService {
  readonly #uow: MidweekSchedulingUnitOfWork;

  constructor(uow: MidweekSchedulingUnitOfWork) {
    this.#uow = uow;
  }

  #assertReads(context: AccessContext): void {
    assertCapability(context, 'schedule.read');
    assertCapability(context, 'eligibility.read');
    assertCapability(context, 'availability.read');
  }

  #meeting(context: AccessContext, meetingIdInput: string): Readonly<MidweekMeeting> {
    const meeting = this.#uow.findMeeting(context, required(meetingIdInput, 'meetingId'));
    if (!meeting) throw new Error('Meeting not found');
    assertResourceTenant(context, meeting);
    return meeting;
  }

  #meetingPeopleAndSignals(context: AccessContext, meeting: Readonly<MidweekMeeting>) {
    const people = this.#uow.listPeople(context);
    const history: readonly Readonly<AssignmentHistoryRecord>[] = this.#uow.listAssignmentHistory(context);
    const existingAssignments: readonly ConflictAssignment[] = this.#uow.listConflictAssignments(context, people.map(person => person.id));
    const personsInSameMeeting = new Set<string>();
    for (const assignment of this.#uow.listStudentAssignments(context, meeting.id)) {
      if (assignment.state !== 'assigned') continue;
      personsInSameMeeting.add(assignment.studentId);
      if (assignment.assistantId) personsInSameMeeting.add(assignment.assistantId);
    }
    for (const assignment of this.#uow.listNonStudentAssignments(context, meeting.id)) {
      if (assignment.state === 'assigned') personsInSameMeeting.add(assignment.personId);
    }
    return Object.freeze({ people, history, existingAssignments, personsInSameMeeting });
  }

  listCandidates(
    context: AccessContext,
    query: CandidateSlotQuery,
    _metadata: RequestMetadata = {},
  ): Readonly<CandidateQueryResult> {
    this.#assertReads(context);
    const meeting = this.#meeting(context, query.meetingId);
    const slot = findSlotById(meeting, required(query.slotId, 'slotId'));
    if (!slot) throw new Error('Slot not found');
    if (query.role === 'non-student') throw new Error('Non-student candidate queries require an explicit assignmentTypeId; use listNonStudentCandidates');
    if (!slot.partDefinitionId) throw new Error('Student/assistant slot requires a part definition');

    const part = this.#uow.findPartDefinition(slot.partDefinitionId);
    if (!part) throw new Error('Part definition not found');
    if (query.role === 'student' && !part.studentNeeded) throw new Error('This part does not accept a student assignment');
    if (query.role === 'assistant' && part.assistantRequirement === 'none') throw new Error('This part does not accept an assistant');

    const assignmentTypeId = part.id;
    const eligibilityAssignmentTypeId = query.role === 'student'
      ? studentEligibilityTypeId(part)
      : assistantEligibilityTypeId(part);
    const window = this.#uow.resolveSlotWindow(context, meeting, slot.id);
    const signals = this.#meetingPeopleAndSignals(context, meeting);
    const excludeSet = new Set(query.excludePersonIds ?? []);

    const candidates = computeCandidates({
      tenantId: context.tenantId,
      role: query.role,
      assignmentTypeId,
      eligibilityAssignmentTypeId,
      referenceDate: meeting.date,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      personsInSameMeeting: signals.personsInSameMeeting,
      existingAssignments: signals.existingAssignments,
      people: excludeSet.size > 0 ? signals.people.filter(person => !excludeSet.has(person.id)) : signals.people,
      history: signals.history,
    });

    return Object.freeze({ meetingId: meeting.id, slotId: slot.id, role: query.role, assignmentTypeId, window, candidates });
  }

  listNonStudentCandidates(
    context: AccessContext,
    meetingIdInput: string,
    slotIdInput: string,
    roleInput: string,
    _metadata: RequestMetadata = {},
  ): Readonly<CandidateQueryResult> {
    this.#assertReads(context);
    const meeting = this.#meeting(context, meetingIdInput);
    const slot = findSlotById(meeting, required(slotIdInput, 'slotId'));
    if (!slot) throw new Error('Slot not found');
    const role = required(roleInput, 'role');
    const referencedPart = this.#uow.findPartDefinition(role);
    if (referencedPart && slot.partDefinitionId !== referencedPart.id) throw new Error('Role part definition does not match the target slot');
    if (referencedPart?.studentNeeded) throw new Error('Student part cannot be assigned as a non-student role');

    const eligibilityAssignmentTypeId = nonStudentEligibilityTypeId(role, referencedPart);
    const window = this.#uow.resolveSlotWindow(context, meeting, slot.id);
    const signals = this.#meetingPeopleAndSignals(context, meeting);
    const candidates = computeCandidates({
      tenantId: context.tenantId,
      role: 'non-student',
      assignmentTypeId: role,
      eligibilityAssignmentTypeId,
      referenceDate: meeting.date,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      personsInSameMeeting: signals.personsInSameMeeting,
      existingAssignments: signals.existingAssignments,
      people: signals.people,
      history: signals.history,
    });

    return Object.freeze({ meetingId: meeting.id, slotId: slot.id, role: 'non-student', assignmentTypeId: role, window, candidates });
  }
}

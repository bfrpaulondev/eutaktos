import {
  assertCapability,
  assertResourceTenant,
  buildEligibilityIndex,
  computeCandidates,
  findSlotById,
  type AccessContext,
  type AssignmentHistoryRecord,
  type CandidateProfile,
  type CandidateRole,
  type CongregationPerson,
  type ConflictAssignment,
  type MidweekMeeting,
  type MidweekPartDefinition,
} from '@eutaktos/domain';
import type { MidweekSchedulingUnitOfWork, SchedulingWindow } from './midweek-scheduling-service';
import type { RequestMetadata } from './people-service';

// ─── Public types ───────────────────────────────────────────────────────────

export interface CandidateSlotQuery {
  readonly meetingId: string;
  readonly slotId: string;
  readonly role: CandidateRole;
  /**
   * Optional pre-selected assistant when querying student candidates. Used to
   * detect conflicts against an existing assistant in the same part.
   */
  readonly excludePersonIds?: readonly string[];
}

export interface CandidateQueryResult {
  readonly meetingId: string;
  readonly slotId: string;
  readonly role: CandidateRole;
  readonly assignmentTypeId: string;
  readonly window: SchedulingWindow;
  readonly candidates: readonly Readonly<CandidateProfile>[];
}

// ─── Service ───────────────────────────────────────────────────────────────

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  if (trimmed.length > 200) throw new Error(`${field} is too long`);
  return trimmed;
}

/**
 * Read-only Candidate Query Service.
 *
 * Computes eligible candidates for a meeting slot by combining:
 *   - People (server-authoritative, tenant-scoped)
 *   - Explicitly configured eligibility (never inferred)
 *   - Availability / absence periods
 *   - Existing assignments (for conflict detection)
 *   - Assignment history (for recency and recent load)
 *
 * Capabilities enforced:
 *   - `schedule.read`        — basic read of meeting/slot info
 *   - `eligibility.read`     — read eligibility grants
 *   - `availability.read`    — read availability/absence periods
 *
 * The server is the authority. The frontend NEVER decides eligibility alone.
 */
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

  /**
   * List candidates for a meeting slot.
   *
   * Returns all people of the tenant, with their CandidateProfile computed
   * from the server-authoritative eligibility, availability, conflicts and
   * recency signals.
   *
   * Ineligible candidates are included (with `eligible: false`) so the UI can
   * explain why a specific person is not selectable, but the server NEVER
   * allows them to be assigned (validated separately in the write path).
   */
  listCandidates(
    context: AccessContext,
    query: CandidateSlotQuery,
    _metadata: RequestMetadata = {},
  ): Readonly<CandidateQueryResult> {
    this.#assertReads(context);

    const meeting = this.#meeting(context, query.meetingId);
    const slot = findSlotById(meeting, required(query.slotId, 'slotId'));
    if (!slot) throw new Error('Slot not found');

    // Resolve the assignment type id based on the role.
    let assignmentTypeId: string;
    if (query.role === 'non-student') {
      // For non-student assignments, the role string is the assignment type id.
      throw new Error('Non-student candidate queries require an explicit assignmentTypeId; use listNonStudentCandidates');
    } else {
      // For student/assistant, the part definition id is the assignment type id.
      if (!slot.partDefinitionId) throw new Error('Student/assistant slot requires a part definition');
      const part = this.#uow.findPartDefinition(slot.partDefinitionId);
      if (!part) throw new Error('Part definition not found');
      if (query.role === 'student' && !part.studentNeeded) {
        throw new Error('This part does not accept a student assignment');
      }
      if (query.role === 'assistant' && part.assistantRequirement === 'none') {
        throw new Error('This part does not accept an assistant');
      }
      assignmentTypeId = slot.partDefinitionId;
    }

    const window = this.#uow.resolveSlotWindow(context, meeting, slot.id);

    // People from this tenant only (UoW guarantees tenant scope).
    const people = this.#uow.listPeople(context);

    // History for the tenant — full scan (filtered by tenant inside the engine).
    const history: readonly Readonly<AssignmentHistoryRecord>[] = this.#uow.listAssignmentHistory(context);

    // Existing assignments for everyone in this tenant (conflict detection).
    // This is the union of all student/non-student assignments as ConflictAssignment.
    const personIds = people.map(p => p.id);
    const existingAssignments: readonly ConflictAssignment[] = this.#uow.listConflictAssignments(context, personIds);

    // People already assigned in this meeting (any role).
    const studentAssignments = this.#uow.listStudentAssignments(context, meeting.id);
    const nonStudentAssignments = this.#uow.listNonStudentAssignments(context, meeting.id);
    const personsInSameMeeting = new Set<string>();
    for (const sa of studentAssignments) {
      if (sa.state === 'assigned') {
        personsInSameMeeting.add(sa.studentId);
        if (sa.assistantId) personsInSameMeeting.add(sa.assistantId);
      }
    }
    for (const na of nonStudentAssignments) {
      if (na.state === 'assigned') personsInSameMeeting.add(na.personId);
    }

    // Optionally exclude specific people (e.g. an already-selected student when querying assistants).
    const excludeSet = new Set(query.excludePersonIds ?? []);

    const candidates = computeCandidates({
      tenantId: context.tenantId,
      role: query.role,
      assignmentTypeId,
      referenceDate: meeting.date,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      personsInSameMeeting,
      existingAssignments,
      people: excludeSet.size > 0 ? people.filter(p => !excludeSet.has(p.id)) : people,
      history,
    });

    return Object.freeze({
      meetingId: meeting.id,
      slotId: slot.id,
      role: query.role,
      assignmentTypeId,
      window,
      candidates,
    });
  }

  /**
   * List candidates for a non-student role (e.g. chairman, prayer, reader).
   * The role string is used as the assignment type id directly.
   */
  listNonStudentCandidates(
    context: AccessContext,
    meetingIdInput: string,
    slotIdInput: string,
    role: string,
    _metadata: RequestMetadata = {},
  ): Readonly<CandidateQueryResult> {
    this.#assertReads(context);

    const meeting = this.#meeting(context, meetingIdInput);
    const slot = findSlotById(meeting, required(slotIdInput, 'slotId'));
    if (!slot) throw new Error('Slot not found');

    const window = this.#uow.resolveSlotWindow(context, meeting, slot.id);
    const people = this.#uow.listPeople(context);
    const history = this.#uow.listAssignmentHistory(context);
    const personIds = people.map(p => p.id);
    const existingAssignments = this.#uow.listConflictAssignments(context, personIds);

    const studentAssignments = this.#uow.listStudentAssignments(context, meeting.id);
    const nonStudentAssignments = this.#uow.listNonStudentAssignments(context, meeting.id);
    const personsInSameMeeting = new Set<string>();
    for (const sa of studentAssignments) {
      if (sa.state === 'assigned') {
        personsInSameMeeting.add(sa.studentId);
        if (sa.assistantId) personsInSameMeeting.add(sa.assistantId);
      }
    }
    for (const na of nonStudentAssignments) {
      if (na.state === 'assigned') personsInSameMeeting.add(na.personId);
    }

    const candidates = computeCandidates({
      tenantId: context.tenantId,
      role: 'non-student',
      assignmentTypeId: required(role, 'role'),
      referenceDate: meeting.date,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      personsInSameMeeting,
      existingAssignments,
      people,
      history,
    });

    return Object.freeze({
      meetingId: meeting.id,
      slotId: slot.id,
      role: 'non-student',
      assignmentTypeId: role,
      window,
      candidates,
    });
  }
}

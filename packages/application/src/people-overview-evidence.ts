import {
  assertCapability,
  detectSchedulingConflicts,
  unavailableIntervalsForPerson,
  type AccessContext,
  type AssignmentHistoryRecord,
  type ConflictAssignment,
  type CongregationPerson,
  type MidweekMeeting,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import { manualPlanningCandidates, type ManualPlanningCandidate } from './hourglass-planning';

export type RecommendationReasonCode =
  | 'ELIGIBLE'
  | 'AVAILABLE'
  | 'NO_MEETING_CONFLICT'
  | 'NO_WEEKLY_ASSIGNMENT'
  | 'LONGER_SINCE_LAST_ASSIGNMENT'
  | 'HAS_WEEKLY_ASSIGNMENT'
  | 'AWAY_DURING_MEETING'
  | 'NOT_ELIGIBLE'
  | 'CONFLICTING_ASSIGNMENT'
  | 'INACTIVE'
  | 'NO_COMPLETED_ASSIGNMENT_HISTORY';

export interface RecommendationReason {
  readonly code: RecommendationReasonCode;
}

export interface RecommendationHistoryEvidence {
  readonly kind: 'completed-history' | 'no-completed-history';
  readonly lastCompletedMeetingDate?: string;
  readonly daysSinceLastCompletedAssignment?: number;
}

export interface RecommendationCandidateEvidence {
  readonly personId: string;
  readonly status: 'candidate' | 'excluded';
  /** Present only for candidates that passed every hard constraint. */
  readonly rank?: number;
  readonly reasons: readonly RecommendationReason[];
  readonly history: RecommendationHistoryEvidence;
  readonly sameWeekAssignmentCount: number;
}

export interface DeterministicRecommendation {
  readonly contractVersion: 'px7-evidence-v1';
  readonly candidates: readonly RecommendationCandidateEvidence[];
  readonly excluded: readonly RecommendationCandidateEvidence[];
}

/**
 * This is deliberately the smallest input required to rank operational facts.
 * The surrounding server adapter must derive all data from the authenticated
 * tenant; the browser never supplies an authority-bearing tenant or capability.
 */
export interface DeterministicRecommendationInput {
  readonly assignmentTypeId: string;
  /** Assignment-history part type. It may be the same as assignmentTypeId. */
  readonly partType: string;
  /** Civil date of the target meeting in its configured IANA timezone. */
  readonly targetMeetingDate: string;
  /** Civil date against which completed-history interval is calculated. */
  readonly referenceDate: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly people: readonly CongregationPerson[];
  readonly history: readonly Readonly<AssignmentHistoryRecord>[];
  /** Already-resolved windows for active (`assigned`) assignments only. */
  readonly activeAssignments: readonly ActiveAssignmentEvidence[];
  /** Active assignments used only as a same-local-week workload signal. */
  readonly workloadAssignments: readonly AssignmentWorkloadEvidence[];
}

export interface AssignmentWorkloadEvidence {
  readonly tenantId: string;
  readonly assignmentId: string;
  readonly personId: string;
  /** Civil meeting date in the meeting's configured timezone. */
  readonly meetingDate: string;
  readonly state: 'assigned';
}

export interface ActiveAssignmentEvidence extends ConflictAssignment {
  readonly state: 'assigned';
}

export interface AffectedAssignmentEvidence {
  readonly assignmentId: string;
  readonly personId: string;
  readonly unavailablePeriodId: string;
}

export interface AffectedAssignmentInput {
  readonly people: readonly CongregationPerson[];
  readonly activeAssignments: readonly ActiveAssignmentEvidence[];
}

export interface BlockedEvidenceContract {
  readonly status: 'blocked';
  readonly requiredBoundary: string;
}

/** Source records for a deterministic history projection from real Midweek state. */
export interface CompletedAssignmentHistoryInput {
  readonly meetings: readonly Readonly<MidweekMeeting>[];
  readonly studentAssignments: readonly Readonly<StudentAssignment>[];
  readonly nonStudentAssignments: readonly Readonly<NonStudentAssignment>[];
}

/**
 * There is no canonical operational-required-field definition in the current
 * domain. Returning a blocked contract is more truthful than inferring a list
 * from contact data or other sensitive fields.
 */
export const PROFILE_COMPLETENESS: Readonly<BlockedEvidenceContract> = Object.freeze({
  status: 'blocked',
  requiredBoundary: 'versioned operational profile requirements with stable requirement codes',
});

/**
 * Existing generic audit metadata cannot safely distinguish availability create,
 * removal and edit after aggregation. A purpose-built, minimized canonical
 * availability history projection is required before this card can be factual.
 */
export const RECENT_AVAILABILITY_CHANGES: Readonly<BlockedEvidenceContract> = Object.freeze({
  status: 'blocked',
  requiredBoundary: 'canonical availability-change history projection linked to person and period identity',
});

/**
 * Projects completed Midweek assignments into the existing completed-history
 * contract. The meeting's stored local civil date is preserved verbatim; it is
 * never reconstructed from a UTC timestamp. Student participants use the
 * factual slot `partDefinitionId` (the same key used by eligibility), while
 * non-student participants use their explicit assignment role.
 */
export function completedAssignmentHistoryFromScheduling(
  context: AccessContext,
  input: CompletedAssignmentHistoryInput,
): readonly Readonly<AssignmentHistoryRecord>[] {
  assertCapability(context, 'schedule.read');
  const meetings = new Map<string, Readonly<MidweekMeeting>>();
  for (const meeting of input.meetings) {
    if (meeting.tenantId !== context.tenantId) continue;
    if (meetings.has(meeting.id)) throw new Error('Duplicate meeting history source');
    meetings.set(meeting.id, meeting);
  }

  const history: AssignmentHistoryRecord[] = [];
  const meetingFor = (meetingId: string): Readonly<MidweekMeeting> => {
    const meeting = meetings.get(meetingId);
    if (!meeting) throw new Error('Completed assignment references a missing tenant meeting');
    return meeting;
  };
  const completedAt = (value: string | null, assignmentId: string): string => {
    if (!value) throw new Error(`Completed assignment ${assignmentId} lacks completedAt`);
    return value;
  };

  for (const assignment of input.studentAssignments) {
    if (assignment.tenantId !== context.tenantId || assignment.state !== 'completed') continue;
    const meeting = meetingFor(assignment.meetingId);
    const slot = meeting.slots.find(item => item.id === assignment.slotId);
    if (!slot?.partDefinitionId) throw new Error('Completed student assignment lacks a factual part definition');
    const recordedAt = completedAt(assignment.completedAt, assignment.id);
    history.push(Object.freeze({
      id: `${assignment.id}:student`,
      tenantId: context.tenantId,
      assignmentId: assignment.id,
      personId: assignment.studentId,
      partType: slot.partDefinitionId,
      meetingDate: meeting.date,
      state: 'completed',
      recordedAt,
      meetingId: meeting.id,
    }));
    if (assignment.assistantId) history.push(Object.freeze({
      id: `${assignment.id}:assistant`,
      tenantId: context.tenantId,
      assignmentId: assignment.id,
      personId: assignment.assistantId,
      partType: slot.partDefinitionId,
      meetingDate: meeting.date,
      state: 'completed',
      recordedAt,
      meetingId: meeting.id,
    }));
  }

  for (const assignment of input.nonStudentAssignments) {
    if (assignment.tenantId !== context.tenantId || assignment.state !== 'completed') continue;
    const meeting = meetingFor(assignment.meetingId);
    history.push(Object.freeze({
      id: assignment.id,
      tenantId: context.tenantId,
      assignmentId: assignment.id,
      personId: assignment.personId,
      partType: assignment.role,
      meetingDate: meeting.date,
      state: 'completed',
      recordedAt: completedAt(assignment.completedAt, assignment.id),
      meetingId: meeting.id,
    }));
  }

  return Object.freeze(history.sort((left, right) =>
    left.meetingDate.localeCompare(right.meetingDate) ||
    left.recordedAt.localeCompare(right.recordedAt) ||
    left.id.localeCompare(right.id),
  ));
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) throw new Error(`${field} is invalid`);
  return normalized;
}

/**
 * Validates a civil calendar date. Date.UTC is used only for calendar
 * validation/ISO-week arithmetic; meeting instants remain the pre-resolved
 * timezone-aware `startsAt`/`endsAt` supplied by scheduling infrastructure.
 */
function civilDate(value: string, field: string): string {
  const date = required(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${field} must be YYYY-MM-DD`);
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${field} must be a real calendar date`);
  }
  return date;
}

function isoWeekKey(dateInput: string): string {
  const date = civilDate(dateInput, 'meetingDate');
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - weekday);
  const isoYear = value.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekday = firstThursday.getUTCDay() || 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - firstWeekday);
  const week = 1 + Math.round((value.getTime() - firstThursday.getTime()) / 604_800_000);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function assertEvidenceReadCapabilities(context: AccessContext): void {
  assertCapability(context, 'people.read');
  assertCapability(context, 'eligibility.read');
  assertCapability(context, 'availability.read');
  assertCapability(context, 'schedule.read');
}

function reason(code: RecommendationReasonCode): RecommendationReason {
  return Object.freeze({ code });
}

function sameWeekAssignments(
  personId: string,
  tenantId: string,
  targetWeek: string,
  assignments: readonly AssignmentWorkloadEvidence[],
): number {
  return assignments.filter(assignment =>
    assignment.tenantId === tenantId &&
    assignment.personId === personId &&
    assignment.state === 'assigned' &&
    isoWeekKey(assignment.meetingDate) === targetWeek,
  ).length;
}

function historyEvidence(candidate: ManualPlanningCandidate): RecommendationHistoryEvidence {
  if (candidate.neverAssigned) return Object.freeze({ kind: 'no-completed-history' });
  return Object.freeze({
    kind: 'completed-history',
    lastCompletedMeetingDate: candidate.lastAssignedOn,
    daysSinceLastCompletedAssignment: candidate.daysSinceLastAssignment,
  });
}

function candidateEvidence(
  candidate: ManualPlanningCandidate,
  tenantId: string,
  targetWeek: string,
  assignments: readonly AssignmentWorkloadEvidence[],
): RecommendationCandidateEvidence {
  const reasons: RecommendationReason[] = [];
  if (!candidate.active) reasons.push(reason('INACTIVE'));
  if (candidate.explicitlyEligible) reasons.push(reason('ELIGIBLE'));
  else reasons.push(reason('NOT_ELIGIBLE'));

  const unavailable = candidate.conflicts.some(conflict => conflict.kind === 'unavailable');
  const assignmentConflict = candidate.conflicts.some(conflict => conflict.kind === 'assignment-overlap');
  if (unavailable) reasons.push(reason('AWAY_DURING_MEETING'));
  if (assignmentConflict) reasons.push(reason('CONFLICTING_ASSIGNMENT'));
  if (!candidate.conflicts.length) {
    reasons.push(reason('AVAILABLE'));
    reasons.push(reason('NO_MEETING_CONFLICT'));
  }

  const sameWeekAssignmentCount = sameWeekAssignments(candidate.personId, tenantId, targetWeek, assignments);
  reasons.push(reason(sameWeekAssignmentCount === 0 ? 'NO_WEEKLY_ASSIGNMENT' : 'HAS_WEEKLY_ASSIGNMENT'));
  if (candidate.neverAssigned) reasons.push(reason('NO_COMPLETED_ASSIGNMENT_HISTORY'));
  else reasons.push(reason('LONGER_SINCE_LAST_ASSIGNMENT'));

  return Object.freeze({
    personId: candidate.personId,
    status: candidate.selectable ? 'candidate' : 'excluded',
    reasons: Object.freeze(reasons),
    history: historyEvidence(candidate),
    sameWeekAssignmentCount,
  });
}

function candidateOrder(left: RecommendationCandidateEvidence, right: RecommendationCandidateEvidence): number {
  // Same-week workload is a soft signal. Both entries have already passed the
  // hard constraints that place them in the candidate list.
  const workload = left.sameWeekAssignmentCount - right.sameWeekAssignmentCount;
  if (workload !== 0) return workload;

  // Missing history is explicit but not treated as positive evidence of a long
  // interval. Candidates with factual completed history sort before it.
  const leftDays = left.history.daysSinceLastCompletedAssignment;
  const rightDays = right.history.daysSinceLastCompletedAssignment;
  const historyPresence = Number(rightDays !== undefined) - Number(leftDays !== undefined);
  if (historyPresence !== 0) return historyPresence;
  const recency = (rightDays ?? -1) - (leftDays ?? -1);
  if (recency !== 0) return recency;
  return left.personId.localeCompare(right.personId);
}

function excludedOrder(left: RecommendationCandidateEvidence, right: RecommendationCandidateEvidence): number {
  return left.personId.localeCompare(right.personId);
}

/**
 * Deterministic, advisory-only PX7 evidence. It reuses the existing manual
 * planning composition for explicit eligibility, availability and conflict
 * semantics, then adds only ordering/reason presentation around candidates
 * which already passed every hard constraint.
 */
export function deterministicRecommendationEvidence(
  context: AccessContext,
  input: DeterministicRecommendationInput,
): DeterministicRecommendation {
  assertEvidenceReadCapabilities(context);
  const assignmentTypeId = required(input.assignmentTypeId, 'assignmentTypeId');
  const partType = required(input.partType, 'partType');
  const targetMeetingDate = civilDate(input.targetMeetingDate, 'targetMeetingDate');
  const referenceDate = civilDate(input.referenceDate, 'referenceDate');
  const activeAssignments = input.activeAssignments
    .filter(assignment => assignment.tenantId === context.tenantId && assignment.state === 'assigned')
    .map(({ state: _state, ...assignment }) => assignment);
  const completedHistory = input.history.filter(record =>
    record.tenantId === context.tenantId &&
    record.state === 'completed' &&
    record.meetingDate <= referenceDate,
  );
  const planning = manualPlanningCandidates({
    tenantId: context.tenantId,
    assignmentTypeId,
    partType,
    referenceDate,
    startsAt: required(input.startsAt, 'startsAt'),
    endsAt: required(input.endsAt, 'endsAt'),
    people: input.people,
    history: completedHistory,
    existingAssignments: activeAssignments,
  });
  const targetWeek = isoWeekKey(targetMeetingDate);
  const allEvidence = planning.map(candidate => candidateEvidence(candidate, context.tenantId, targetWeek, input.workloadAssignments));
  const candidates = allEvidence
    .filter(item => item.status === 'candidate')
    .sort(candidateOrder)
    .map((item, index) => Object.freeze({ ...item, rank: index + 1 }));
  const excluded = allEvidence.filter(item => item.status === 'excluded').sort(excludedOrder);
  return Object.freeze({
    contractVersion: 'px7-evidence-v1',
    candidates: Object.freeze(candidates),
    excluded: Object.freeze(excluded),
  });
}

/**
 * Read-only evidence for a human review card. Only explicitly active
 * assignments (`assigned`) are considered. Any availability period, including
 * `reasonCode: other`, overlaps through the existing conflict engine.
 */
export function affectedAssignmentsByAvailability(
  context: AccessContext,
  input: AffectedAssignmentInput,
): readonly AffectedAssignmentEvidence[] {
  assertEvidenceReadCapabilities(context);
  const people = new Map(input.people
    .filter(person => person.tenantId === context.tenantId)
    .map(person => [person.id, person]));
  const result: AffectedAssignmentEvidence[] = [];
  for (const assignment of input.activeAssignments) {
    if (assignment.state !== 'assigned' || assignment.tenantId !== context.tenantId) continue;
    const person = people.get(assignment.personId);
    if (!person) continue;
    const conflicts = detectSchedulingConflicts({
      tenantId: context.tenantId,
      candidate: assignment,
      assignments: [],
      unavailable: unavailableIntervalsForPerson(person, context.tenantId),
    });
    for (const conflict of conflicts) {
      if (conflict.kind !== 'unavailable') continue;
      result.push(Object.freeze({
        assignmentId: assignment.assignmentId,
        personId: assignment.personId,
        unavailablePeriodId: conflict.sourceId,
      }));
    }
  }
  return Object.freeze(result.sort((left, right) =>
    left.assignmentId.localeCompare(right.assignmentId) ||
    left.personId.localeCompare(right.personId) ||
    left.unavailablePeriodId.localeCompare(right.unavailablePeriodId),
  ));
}

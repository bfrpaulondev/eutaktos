import type {
  AssignmentTypeId,
  CongregationPerson,
  PersonId,
  TenantId,
} from './people';
import { buildEligibilityIndex, checkEligibility } from './eligibility-constraints';
import type { AssignmentHistoryRecord } from './assignment-history';
import { assignmentCount } from './student-history-queries';
import type { ConflictAssignment, SchedulingConflict, UnavailableInterval } from './conflict-engine';
import { detectSchedulingConflicts } from './conflict-engine';
import { unavailableIntervalsForPerson } from './away-conflict-adapter';

export type CandidateRole = 'student' | 'assistant' | 'non-student';

export type CandidateReasonKind =
  | 'long_time_since_assignment'
  | 'low_recent_assignment_load'
  | 'no_history_for_assignment'
  | 'already_assigned_in_meeting'
  | 'recent_assignment_for_role'
  | 'available'
  | 'unavailable_period'
  | 'inactive';

export interface CandidateReason {
  readonly kind: CandidateReasonKind;
  readonly messageKey: string;
  readonly params: Readonly<Record<string, string | number>>;
}

export interface CandidateConflictInfo {
  readonly kind: SchedulingConflict['kind'];
  readonly sourceId: string;
}

export interface CandidateProfile {
  readonly personId: PersonId;
  readonly displayName: string;
  readonly tenantId: TenantId;
  readonly role: CandidateRole;
  readonly eligible: boolean;
  readonly available: boolean;
  readonly inactive: boolean;
  readonly conflicts: readonly CandidateConflictInfo[];
  readonly lastAssignmentDate: string | null;
  readonly daysSinceLastAssignment: number | null;
  readonly recentAssignmentCount: number;
  readonly alreadyAssignedInMeeting: boolean;
  readonly suggestionScore: number;
  readonly reasons: readonly CandidateReason[];
}

export interface CandidateQueryInput {
  readonly tenantId: TenantId;
  readonly role: CandidateRole;
  readonly assignmentTypeId: AssignmentTypeId;
  readonly referenceDate: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly recentWindowDays?: number;
  readonly personsInSameMeeting: ReadonlySet<PersonId>;
  readonly existingAssignments: readonly ConflictAssignment[];
  readonly people: readonly CongregationPerson[];
  readonly history: readonly AssignmentHistoryRecord[];
  readonly unavailable?: readonly UnavailableInterval[];
}

function requiredString(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

function parseInstant(value: string, field: string): number {
  if (typeof value !== 'string') throw new Error(`${field} must be an ISO instant`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be an ISO instant`);
  return parsed;
}

const REFERENCE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LONG_TIME_SINCE_WEEKS = 8;
const LONG_TIME_SINCE_DAYS = LONG_TIME_SINCE_WEEKS * 7;
const DEFAULT_RECENT_WINDOW_DAYS = 90;
const LOW_RECENT_LOAD_MAX = 1;

function validateReferenceDate(value: string): string {
  const ref = requiredString(value, 'referenceDate');
  if (!REFERENCE_DATE_RE.test(ref)) throw new Error(`referenceDate must be YYYY-MM-DD: ${value}`);
  const [year, month, day] = ref.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`referenceDate is not a valid calendar date: ${value}`);
  }
  return ref;
}

function validateWindow(startsAt: string, endsAt: string): void {
  if (parseInstant(endsAt, 'endsAt') <= parseInstant(startsAt, 'startsAt')) {
    throw new Error('Candidate window must end after it starts');
  }
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function daysBetween(earlier: string, later: string): number {
  const parseDate = (value: string): number => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.floor((parseDate(later) - parseDate(earlier)) / 86_400_000);
}

/**
 * Persisted history key. This deliberately separates the same meeting part when
 * a person served as the student versus the assistant, and separates operational
 * roles from student parts. Candidate recency must answer "last time in THIS
 * function", not merely "last time in this slot".
 */
export function candidateHistoryPartType(role: CandidateRole, assignmentTypeId: AssignmentTypeId): string {
  const normalized = requiredString(assignmentTypeId, 'assignmentTypeId');
  return role === 'non-student' ? `role:${normalized}` : `${role}:${normalized}`;
}

function completedHistoryForPartType(
  history: readonly AssignmentHistoryRecord[],
  personId: PersonId,
  tenantId: TenantId,
  partType: string,
): readonly AssignmentHistoryRecord[] {
  return history
    .filter(record =>
      record.tenantId === tenantId &&
      record.personId === personId &&
      record.partType === partType &&
      record.state === 'completed',
    )
    .sort((a, b) =>
      b.meetingDate.localeCompare(a.meetingDate) ||
      b.recordedAt.localeCompare(a.recordedAt) ||
      b.id.localeCompare(a.id),
    );
}

function recentWindowStart(referenceDate: string, days: number): string {
  const [year, month, day] = referenceDate.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - days * 86_400_000);
  return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
}

function computeScore(input: { readonly daysSinceLast: number | null; readonly recentCount: number; readonly alreadyInMeeting: boolean }): number {
  let score = input.daysSinceLast === null
    ? 30
    : Math.round((Math.min(input.daysSinceLast, LONG_TIME_SINCE_DAYS * 2) / LONG_TIME_SINCE_DAYS) * 40);
  if (input.recentCount <= LOW_RECENT_LOAD_MAX) score += 20;
  if (input.alreadyInMeeting) score -= 25;
  return score;
}

function reason(kind: CandidateReasonKind, messageKey: string, params: Readonly<Record<string, string | number>> = {}): CandidateReason {
  return Object.freeze({ kind, messageKey, params: Object.freeze({ ...params }) });
}

export function computeCandidate(person: CongregationPerson, input: CandidateQueryInput): Readonly<CandidateProfile> {
  requiredString(input.tenantId, 'tenantId');
  requiredString(input.assignmentTypeId, 'assignmentTypeId');
  requiredString(input.role, 'role');
  validateReferenceDate(input.referenceDate);
  validateWindow(input.startsAt, input.endsAt);

  const recentWindowDays = input.recentWindowDays ?? DEFAULT_RECENT_WINDOW_DAYS;
  if (!Number.isInteger(recentWindowDays) || recentWindowDays <= 0) throw new Error('recentWindowDays must be a positive integer');
  if (person.tenantId !== input.tenantId) throw new Error('Cross-tenant candidate access denied');

  const eligibilityIndex = buildEligibilityIndex([person], input.tenantId);
  const eligible = checkEligibility(eligibilityIndex, input.tenantId, person.id, input.assignmentTypeId);
  const inactive = !person.active;

  const unavailableForPerson = input.unavailable
    ? input.unavailable.filter(item => item.tenantId === input.tenantId && item.personId === person.id)
    : unavailableIntervalsForPerson(person, input.tenantId);

  const slotStart = parseInstant(input.startsAt, 'startsAt');
  const slotEnd = parseInstant(input.endsAt, 'endsAt');
  const hasUnavailableOverlap = unavailableForPerson.some(period => overlaps(
    slotStart,
    slotEnd,
    parseInstant(period.startsAt, 'unavailable.startsAt'),
    parseInstant(period.endsAt, 'unavailable.endsAt'),
  ));
  const available = !inactive && !hasUnavailableOverlap;

  const candidateAssignment: ConflictAssignment = Object.freeze({
    tenantId: input.tenantId,
    assignmentId: `candidate:${person.id}`,
    personId: person.id,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  const conflictInfo: CandidateConflictInfo[] = detectSchedulingConflicts({
    tenantId: input.tenantId,
    candidate: candidateAssignment,
    assignments: input.existingAssignments,
    unavailable: unavailableForPerson,
  }).map(conflict => Object.freeze({ kind: conflict.kind, sourceId: conflict.sourceId }));

  const historyPartType = candidateHistoryPartType(input.role, input.assignmentTypeId);
  const relevantHistory = completedHistoryForPartType(input.history, person.id, input.tenantId, historyPartType);
  const lastRecord = relevantHistory[0];
  const lastDate = lastRecord?.meetingDate ?? null;
  const daysSince = lastDate === null ? null : daysBetween(lastDate, input.referenceDate);
  const recentCount = assignmentCount(input.history, person.id, input.tenantId, {
    from: recentWindowStart(input.referenceDate, recentWindowDays),
    to: input.referenceDate,
    partType: historyPartType,
  });
  const alreadyInMeeting = input.personsInSameMeeting.has(person.id);

  const reasons: CandidateReason[] = [];
  if (inactive) {
    reasons.push(reason('inactive', 'midweek.candidates.reason.inactive'));
  } else if (hasUnavailableOverlap) {
    reasons.push(reason('unavailable_period', 'midweek.candidates.reason.unavailablePeriod'));
  } else if (eligible) {
    if (lastDate === null) {
      reasons.push(reason('no_history_for_assignment', 'midweek.candidates.reason.noHistoryForAssignment'));
    } else if (daysSince !== null) {
      const weeks = Math.floor(daysSince / 7);
      if (weeks >= LONG_TIME_SINCE_WEEKS) reasons.push(reason('long_time_since_assignment', 'midweek.candidates.reason.longTimeSinceAssignment', { weeks }));
      else if (weeks <= 2) reasons.push(reason('recent_assignment_for_role', 'midweek.candidates.reason.recentAssignmentForRole', { weeks }));
    }
    if (recentCount <= LOW_RECENT_LOAD_MAX) reasons.push(reason('low_recent_assignment_load', 'midweek.candidates.reason.lowRecentAssignmentLoad', { count: recentCount }));
    if (alreadyInMeeting) reasons.push(reason('already_assigned_in_meeting', 'midweek.candidates.reason.alreadyAssignedInMeeting'));
    if (reasons.length === 0) reasons.push(reason('available', 'midweek.candidates.reason.available'));
  }

  return Object.freeze({
    personId: person.id,
    displayName: person.displayName,
    tenantId: input.tenantId,
    role: input.role,
    eligible,
    available,
    inactive,
    conflicts: Object.freeze(conflictInfo),
    lastAssignmentDate: lastDate,
    daysSinceLastAssignment: daysSince,
    recentAssignmentCount: recentCount,
    alreadyAssignedInMeeting: alreadyInMeeting,
    suggestionScore: computeScore({ daysSinceLast: daysSince, recentCount, alreadyInMeeting }),
    reasons: Object.freeze(reasons),
  });
}

export function computeCandidates(input: CandidateQueryInput): readonly Readonly<CandidateProfile>[] {
  requiredString(input.tenantId, 'tenantId');
  requiredString(input.assignmentTypeId, 'assignmentTypeId');
  requiredString(input.role, 'role');
  validateReferenceDate(input.referenceDate);
  validateWindow(input.startsAt, input.endsAt);

  const results = input.people.filter(person => person.tenantId === input.tenantId).map(person => computeCandidate(person, input));
  return Object.freeze(results.sort((left, right) => {
    const leftValid = left.eligible && left.available && left.conflicts.length === 0;
    const rightValid = right.eligible && right.available && right.conflicts.length === 0;
    if (leftValid !== rightValid) return leftValid ? -1 : 1;
    if (left.suggestionScore !== right.suggestionScore) return right.suggestionScore - left.suggestionScore;
    return left.personId.localeCompare(right.personId);
  }));
}

export function selectValidCandidates(candidates: readonly Readonly<CandidateProfile>[]): readonly Readonly<CandidateProfile>[] {
  return Object.freeze(candidates.filter(candidate => candidate.eligible && candidate.available && candidate.conflicts.length === 0));
}

export function assertCandidateTenant(candidate: Readonly<CandidateProfile>, tenantId: TenantId): void {
  if (candidate.tenantId !== tenantId) throw new Error('Cross-tenant candidate access denied');
}

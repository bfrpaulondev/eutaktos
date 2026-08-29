import type {
  AssignmentTypeId,
  CongregationPerson,
  PersonId,
  TenantId,
} from './people';
import {
  buildEligibilityIndex,
  checkEligibility,
} from './eligibility-constraints';
import {
  isPersonAvailableAt,
} from './people';
import type {
  AssignmentHistoryRecord,
} from './assignment-history';
import {
  assignmentCount,
  daysSinceLastAssignment,
  lastAssignmentDate,
  lastAssignment,
} from './student-history-queries';
import type { ConflictAssignment, SchedulingConflict } from './conflict-engine';
import { detectSchedulingConflicts } from './conflict-engine';
import type { UnavailableInterval } from './conflict-engine';
import { unavailableIntervalsForPerson } from './away-conflict-adapter';

// ─── Public types ───────────────────────────────────────────────────────────

export type CandidateRole = 'student' | 'assistant' | 'non-student';

/** Structured, explainable reason for a candidate's status. */
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
  /** Translation key, never raw localized text. */
  readonly messageKey: string;
  /** Stable parameters for interpolation. */
  readonly params: Readonly<Record<string, string | number>>;
}

export interface CandidateConflictInfo {
  readonly kind: SchedulingConflict['kind'];
  readonly sourceId: string;
}

/**
 * Deterministic candidate profile for a single assignment slot.
 *
 * Pure operational signals — never a judgment of spiritual qualification.
 * `suggestionScore` is internal ranking only; it MUST NOT be exposed as a
 * human ranking in the UI (use `reasons` instead).
 */
export interface CandidateProfile {
  readonly personId: PersonId;
  readonly displayName: string;
  readonly tenantId: TenantId;
  readonly role: CandidateRole;
  /** Eligibility was explicitly configured by an authorized brother. */
  readonly eligible: boolean;
  /** Person is active and no unavailable period overlaps the slot window. */
  readonly available: boolean;
  readonly inactive: boolean;
  /** Conflicts against existing assignments/unavailability in this meeting. */
  readonly conflicts: readonly CandidateConflictInfo[];
  /** ISO date (YYYY-MM-DD) of last completed assignment for this role/partType, or null. */
  readonly lastAssignmentDate: string | null;
  /** Days since last completed assignment for this role/partType from reference, or null when no history. */
  readonly daysSinceLastAssignment: number | null;
  /** Number of completed assignments for this role/partType in window. */
  readonly recentAssignmentCount: number;
  /** True if this person is already assigned (any role) in the same meeting. */
  readonly alreadyAssignedInMeeting: boolean;
  /**
   * Internal deterministic score for ordering. Higher = suggested first.
   * Pure function of operational signals; never exposed as human ranking.
   */
  readonly suggestionScore: number;
  /** Explainable, translatable reasons. */
  readonly reasons: readonly CandidateReason[];
}

export interface CandidateQueryInput {
  readonly tenantId: TenantId;
  readonly role: CandidateRole;
  /**
   * For student/assistant: the part definition id (used as assignmentTypeId).
   * For non-student: the role string (used as assignmentTypeId).
   */
  readonly assignmentTypeId: AssignmentTypeId;
  /** Meeting date (YYYY-MM-DD) for recency calculations. */
  readonly referenceDate: string;
  /** ISO instant slot window start. */
  readonly startsAt: string;
  /** ISO instant slot window end. */
  readonly endsAt: string;
  /** Optional: rolling window in days for `recentAssignmentCount` (default 90). */
  readonly recentWindowDays?: number;
  /** Person ids already assigned in the target meeting (any role). */
  readonly personsInSameMeeting: ReadonlySet<PersonId>;
  /** Existing assignments to check overlaps against (this meeting + others). */
  readonly existingAssignments: readonly ConflictAssignment[];
  /** People to evaluate. */
  readonly people: readonly CongregationPerson[];
  /** History records for the tenant (will be filtered). */
  readonly history: readonly AssignmentHistoryRecord[];
  /** Optional precomputed unavailable intervals; if absent, derived from each person. */
  readonly unavailable?: readonly UnavailableInterval[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

function validateReferenceDate(value: string): string {
  const ref = requiredString(value, 'referenceDate');
  if (!REFERENCE_DATE_RE.test(ref)) throw new Error(`referenceDate must be YYYY-MM-DD: ${value}`);
  const [y, m, d] = ref.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`referenceDate is not a valid calendar date: ${value}`);
  }
  return ref;
}

function validateWindow(startsAt: string, endsAt: string): void {
  const start = parseInstant(startsAt, 'startsAt');
  const end = parseInstant(endsAt, 'endsAt');
  if (end <= start) throw new Error('Candidate window must end after it starts');
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Default recency threshold (in weeks) above which we highlight "long time since assignment".
 * Tunable but kept conservative: 8 weeks is roughly two midweek meeting cycles.
 */
const LONG_TIME_SINCE_WEEKS = 8;
const LONG_TIME_SINCE_DAYS = LONG_TIME_SINCE_WEEKS * 7;

/**
 * Default recent window for assignment count: 90 days.
 */
const DEFAULT_RECENT_WINDOW_DAYS = 90;

/**
 * Maximum `recentAssignmentCount` considered "low load" for suggestion purposes.
 */
const LOW_RECENT_LOAD_MAX = 1;

// ─── Scoring (internal only) ────────────────────────────────────────────────

/**
 * Deterministic scoring. Higher = suggested earlier in the list.
 *
 * The score combines:
 *  - Long time since last assignment (capped) -> up to +40
 *  - Low recent assignment load -> up to +20
 *  - No history at all -> +30 (encourage new participation)
 *  - Already in meeting -> -25 (avoid stacking)
 *
 * NEVER exposed to the UI as a human ranking. Only the derived `reasons` are.
 */
function computeScore(input: {
  readonly daysSinceLast: number | null;
  readonly recentCount: number;
  readonly alreadyInMeeting: boolean;
  readonly hasHistory: boolean;
}): number {
  let score = 0;
  if (input.daysSinceLast === null) {
    // No history — encourage new participation.
    score += 30;
  } else {
    // Long time since assignment -> up to +40, capped.
    const capped = Math.min(input.daysSinceLast, LONG_TIME_SINCE_DAYS * 2);
    score += Math.round((capped / LONG_TIME_SINCE_DAYS) * 40);
  }
  if (input.recentCount <= LOW_RECENT_LOAD_MAX) score += 20;
  if (input.alreadyInMeeting) score -= 25;
  return score;
}

// ─── Reasons (explainable, translatable) ────────────────────────────────────

function reasonLongTimeSince(days: number): CandidateReason {
  const weeks = Math.floor(days / 7);
  return Object.freeze({
    kind: 'long_time_since_assignment',
    messageKey: 'midweek.candidates.reason.longTimeSinceAssignment',
    params: Object.freeze({ weeks }),
  });
}

function reasonLowRecentLoad(count: number): CandidateReason {
  return Object.freeze({
    kind: 'low_recent_assignment_load',
    messageKey: 'midweek.candidates.reason.lowRecentAssignmentLoad',
    params: Object.freeze({ count }),
  });
}

function reasonNoHistory(): CandidateReason {
  return Object.freeze({
    kind: 'no_history_for_assignment',
    messageKey: 'midweek.candidates.reason.noHistoryForAssignment',
    params: Object.freeze({}),
  });
}

function reasonAlreadyAssignedInMeeting(): CandidateReason {
  return Object.freeze({
    kind: 'already_assigned_in_meeting',
    messageKey: 'midweek.candidates.reason.alreadyAssignedInMeeting',
    params: Object.freeze({}),
  });
}

function reasonRecentAssignmentForRole(weeks: number): CandidateReason {
  return Object.freeze({
    kind: 'recent_assignment_for_role',
    messageKey: 'midweek.candidates.reason.recentAssignmentForRole',
    params: Object.freeze({ weeks }),
  });
}

function reasonAvailable(): CandidateReason {
  return Object.freeze({
    kind: 'available',
    messageKey: 'midweek.candidates.reason.available',
    params: Object.freeze({}),
  });
}

function reasonUnavailablePeriod(): CandidateReason {
  return Object.freeze({
    kind: 'unavailable_period',
    messageKey: 'midweek.candidates.reason.unavailablePeriod',
    params: Object.freeze({}),
  });
}

function reasonInactive(): CandidateReason {
  return Object.freeze({
    kind: 'inactive',
    messageKey: 'midweek.candidates.reason.inactive',
    params: Object.freeze({}),
  });
}

// ─── Main engine ────────────────────────────────────────────────────────────

/**
 * Compute the candidate profile for a single person, given a fully-resolved query input.
 *
 * Pure, deterministic, tenant-isolated. Never trusts client-provided tenant/actor/capabilities.
 * Never infers spiritual qualification; only operational signals derived from
 * explicitly configured eligibility, availability, history and conflicts.
 */
export function computeCandidate(
  person: CongregationPerson,
  input: CandidateQueryInput,
): Readonly<CandidateProfile> {
  requiredString(input.tenantId, 'tenantId');
  requiredString(input.assignmentTypeId, 'assignmentTypeId');
  requiredString(input.role, 'role');
  validateReferenceDate(input.referenceDate);
  validateWindow(input.startsAt, input.endsAt);
  const recentWindowDays = input.recentWindowDays ?? DEFAULT_RECENT_WINDOW_DAYS;
  if (!Number.isInteger(recentWindowDays) || recentWindowDays <= 0) {
    throw new Error('recentWindowDays must be a positive integer');
  }

  if (person.tenantId !== input.tenantId) {
    throw new Error('Cross-tenant candidate access denied');
  }

  const index = buildEligibilityIndex([person], input.tenantId);
  const eligible = checkEligibility(index, input.tenantId, person.id, input.assignmentTypeId);
  const inactive = !person.active;

  // Availability: check explicit unavailable periods only.
  const unavailableForPerson = input.unavailable
    ? input.unavailable.filter(u => u.personId === person.id && u.tenantId === input.tenantId)
    : unavailableIntervalsForPerson(person, input.tenantId);

  const slotStart = parseInstant(input.startsAt, 'startsAt');
  const slotEnd = parseInstant(input.endsAt, 'endsAt');
  const hasUnavailableOverlap = unavailableForPerson.some(period => {
    const periodStart = parseInstant(period.startsAt, 'unavailable.startsAt');
    const periodEnd = parseInstant(period.endsAt, 'unavailable.endsAt');
    return overlaps(slotStart, slotEnd, periodStart, periodEnd);
  });
  const available = !inactive && !hasUnavailableOverlap;

  // Conflict detection against existing assignments (this meeting + others).
  const candidateAssignment: ConflictAssignment = Object.freeze({
    tenantId: input.tenantId,
    assignmentId: `candidate:${person.id}`,
    personId: person.id,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  const conflicts = detectSchedulingConflicts({
    tenantId: input.tenantId,
    candidate: candidateAssignment,
    assignments: input.existingAssignments,
    unavailable: unavailableForPerson,
  });
  const conflictInfo: CandidateConflictInfo[] = conflicts.map(c => Object.freeze({
    kind: c.kind,
    sourceId: c.sourceId,
  }));

  // History (this person + this partType + this tenant).
  const lastRecord = lastAssignment(input.history, person.id, input.tenantId);
  // Note: lastAssignment filters by 'completed' state already.
  const lastDate = lastAssignmentDate(input.history, person.id, input.tenantId) ?? null;
  const daysSince = daysSinceLastAssignment(input.history, person.id, input.tenantId, input.referenceDate);
  const recentWindowStart = (() => {
    const [y, m, d] = input.referenceDate.split('-').map(Number);
    const ref = Date.UTC(y, m - 1, d);
    const start = new Date(ref - recentWindowDays * 86_400_000);
    return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
  })();
  const recentCount = assignmentCount(input.history, person.id, input.tenantId, {
    from: recentWindowStart,
    to: input.referenceDate,
  });
  const alreadyInMeeting = input.personsInSameMeeting.has(person.id);

  const score = computeScore({
    daysSinceLast: daysSince,
    recentCount: recentCount,
    alreadyInMeeting: alreadyInMeeting,
    hasHistory: lastRecord !== undefined,
  });

  // Build reasons — explainable, ordered.
  const reasons: CandidateReason[] = [];
  if (inactive) {
    reasons.push(reasonInactive());
  } else if (hasUnavailableOverlap) {
    reasons.push(reasonUnavailablePeriod());
  } else if (!eligible) {
    // Eligibility is a hard gate; no suggestion reason is added for ineligible people.
  } else {
    // Eligible + available — add operational hints (subtle, never ranking).
    if (lastDate === null) {
      reasons.push(reasonNoHistory());
    } else if (daysSince !== null) {
      const weeks = Math.floor(daysSince / 7);
      if (weeks >= LONG_TIME_SINCE_WEEKS) {
        reasons.push(reasonLongTimeSince(daysSince));
      } else if (weeks <= 2) {
        reasons.push(reasonRecentAssignmentForRole(weeks));
      }
    }
    if (recentCount <= LOW_RECENT_LOAD_MAX) {
      reasons.push(reasonLowRecentLoad(recentCount));
    }
    if (alreadyInMeeting) {
      reasons.push(reasonAlreadyAssignedInMeeting());
    }
    if (reasons.length === 0) {
      reasons.push(reasonAvailable());
    }
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
    suggestionScore: score,
    reasons: Object.freeze(reasons),
  });
}

/**
 * Compute candidate profiles for a list of people.
 *
 * Filters by tenant automatically (people from other tenants are silently ignored).
 * Returns results sorted by:
 *   1. Eligible + available + no conflicts first
 *   2. Suggestion score descending
 *   3. Person id ascending (deterministic tiebreaker)
 *
 * Never excludes ineligible people from the result — they are returned with
 * `eligible: false` so the UI can render them appropriately (e.g. greyed out)
 * and the server can validate the client never selected them.
 */
export function computeCandidates(
  input: CandidateQueryInput,
): readonly Readonly<CandidateProfile>[] {
  // Validate top-level inputs once.
  requiredString(input.tenantId, 'tenantId');
  requiredString(input.assignmentTypeId, 'assignmentTypeId');
  requiredString(input.role, 'role');
  validateReferenceDate(input.referenceDate);
  validateWindow(input.startsAt, input.endsAt);

  const results: CandidateProfile[] = [];
  for (const person of input.people) {
    if (!person || typeof person !== 'object') throw new Error('person must be an object');
    if (person.tenantId !== input.tenantId) continue;
    results.push(computeCandidate(person, input));
  }

  // Deterministic sort:
  // 1. Valid (eligible + available + no conflicts) first
  // 2. Suggestion score descending
  // 3. Person id ascending
  return Object.freeze(
    results.sort((a, b) => {
      const aValid = a.eligible && a.available && a.conflicts.length === 0;
      const bValid = b.eligible && b.available && b.conflicts.length === 0;
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (a.suggestionScore !== b.suggestionScore) return b.suggestionScore - a.suggestionScore;
      return a.personId.localeCompare(b.personId);
    }),
  );
}

/**
 * Convenience filter: returns only candidates that are eligible, available and conflict-free.
 * Useful for the UI's "suggested for selection" subset.
 */
export function selectValidCandidates(
  candidates: readonly Readonly<CandidateProfile>[],
): readonly Readonly<CandidateProfile>[] {
  return Object.freeze(
    candidates.filter(c => c.eligible && c.available && c.conflicts.length === 0),
  );
}

// ─── Tenant guards ──────────────────────────────────────────────────────────

export function assertCandidateTenant(
  candidate: Readonly<CandidateProfile>,
  tenantId: TenantId,
): void {
  if (candidate.tenantId !== tenantId) {
    throw new Error('Cross-tenant candidate access denied');
  }
}

// Reference imports used only for typecheck clarity in some toolchains.
void isPersonAvailableAt;

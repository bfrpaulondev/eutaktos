import type { TenantId } from './people';
import type {
  CandidateProfile,
  CandidateReason,
  CandidateRole,
} from './candidate-engine';

// ─── Public types ───────────────────────────────────────────────────────────

/**
 * Subtle, explainable suggestion for a candidate.
 *
 * The Suggestion Engine NEVER creates new eligibility, NEVER ranks humans,
 * NEVER uses language like "best" or "most qualified". It only:
 *   1. Annotates already-valid candidates with operational facts.
 *   2. Optionally surfaces a single discrete hint when one candidate is
 *      operationally a better choice (e.g. longest time since last assignment).
 *
 * The user always has the final word. Suggestions may be ignored.
 */
export interface SuggestionHint {
  /** Translation key, never raw localized text. */
  readonly messageKey: string;
  /** Stable parameters for interpolation. */
  readonly params: Readonly<Record<string, string | number>>;
  /**
   * True if this hint suggests the candidate is operationally preferred
   * (e.g. longest time since last assignment). UI may show a subtle marker.
   * NEVER use language like "recommended" or "best"; prefer "long time since".
   */
  readonly operationallyPreferred?: boolean;
}

export interface SuggestionResult {
  readonly tenantId: TenantId;
  readonly personId: string;
  readonly role: CandidateRole;
  /** Reasons already attached to the candidate, augmented by suggestion context. */
  readonly reasons: readonly CandidateReason[];
  /** Optional single discrete hint, or undefined when no specific hint applies. */
  readonly hint?: SuggestionHint;
}

// ─── Engine ────────────────────────────────────────────────────────────────

const HINT_THRESHOLD_WEEKS = 4;

/**
 * Build a subtle suggestion result for a single candidate.
 *
 * The hint is computed only from explicit operational facts derived by the
 * Candidate Engine. It never adds new judgments or ranking.
 *
 * Examples of produced hints (translation keys, not text):
 *   - "longest_time_since_assignment" — when the candidate has the longest
 *     gap among valid candidates in the same query.
 *   - "no_history_for_assignment" — when the candidate has never received
 *     this assignment type.
 *   - "available_with_low_recent_load" — eligible, available, low recent count.
 */
export function buildSuggestion(
  candidate: Readonly<CandidateProfile>,
  context: SuggestionContext,
): Readonly<SuggestionResult> {
  if (!candidate.eligible || !candidate.available || candidate.conflicts.length > 0) {
    return Object.freeze({
      tenantId: candidate.tenantId,
      personId: candidate.personId,
      role: candidate.role,
      reasons: candidate.reasons,
    });
  }

  // Pick a single discrete hint, in priority order:
  //   1. Longest gap among valid candidates (operationally preferred).
  //   2. No history for this assignment type.
  //   3. Available with low recent load.
  let hint: SuggestionHint | undefined;

  const isLongestGap = context.maxDaysSinceLastAssignment !== null
    && candidate.daysSinceLastAssignment !== null
    && candidate.daysSinceLastAssignment === context.maxDaysSinceLastAssignment
    && candidate.daysSinceLastAssignment >= HINT_THRESHOLD_WEEKS * 7;

  if (isLongestGap) {
    hint = Object.freeze({
      messageKey: 'midweek.suggestion.longestTimeSinceAssignment',
      params: Object.freeze({
        weeks: Math.floor((candidate.daysSinceLastAssignment as number) / 7),
      }),
      operationallyPreferred: true,
    });
  } else if (candidate.lastAssignmentDate === null) {
    hint = Object.freeze({
      messageKey: 'midweek.suggestion.noHistoryForAssignment',
      params: Object.freeze({}),
    });
  } else if (candidate.recentAssignmentCount === 0) {
    hint = Object.freeze({
      messageKey: 'midweek.suggestion.availableLowRecentLoad',
      params: Object.freeze({}),
    });
  }

  return Object.freeze({
    tenantId: candidate.tenantId,
    personId: candidate.personId,
    role: candidate.role,
    reasons: candidate.reasons,
    ...(hint ? { hint } : {}),
  });
}

export interface SuggestionContext {
  /**
   * The maximum `daysSinceLastAssignment` among all *valid* candidates in the
   * same query. Used to identify the single candidate with the longest gap.
   * Null when no valid candidate has any history.
   */
  readonly maxDaysSinceLastAssignment: number | null;
  /** Total number of valid candidates (eligible + available + no conflicts). */
  readonly validCandidateCount: number;
  /** Number of candidates already assigned in this meeting. */
  readonly alreadyAssignedCount: number;
}

/**
 * Build a SuggestionContext from a list of candidate profiles.
 * Pure and deterministic.
 */
export function buildSuggestionContext(
  candidates: readonly Readonly<CandidateProfile>[],
): SuggestionContext {
  let maxDays: number | null = null;
  let validCount = 0;
  let alreadyAssignedCount = 0;
  for (const c of candidates) {
    const isValid = c.eligible && c.available && c.conflicts.length === 0;
    if (isValid) {
      validCount += 1;
      if (c.daysSinceLastAssignment !== null) {
        if (maxDays === null || c.daysSinceLastAssignment > maxDays) {
          maxDays = c.daysSinceLastAssignment;
        }
      }
    }
    if (c.alreadyAssignedInMeeting) alreadyAssignedCount += 1;
  }
  return Object.freeze({
    maxDaysSinceLastAssignment: maxDays,
    validCandidateCount: validCount,
    alreadyAssignedCount,
  });
}

/**
 * Build suggestions for all candidates in a query.
 * Returns a list aligned 1:1 with the input candidates (same order).
 */
export function buildSuggestions(
  candidates: readonly Readonly<CandidateProfile>[],
): readonly Readonly<SuggestionResult>[] {
  const context = buildSuggestionContext(candidates);
  return Object.freeze(candidates.map(c => buildSuggestion(c, context)));
}

/**
 * Tenant guard for a suggestion result.
 */
export function assertSuggestionTenant(
  suggestion: Readonly<SuggestionResult>,
  tenantId: TenantId,
): void {
  if (suggestion.tenantId !== tenantId) {
    throw new Error('Cross-tenant suggestion access denied');
  }
}

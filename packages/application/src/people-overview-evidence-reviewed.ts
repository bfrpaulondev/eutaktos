import {
  assertCapability,
  detectSchedulingConflicts,
  unavailableIntervalsForPerson,
  type AccessContext,
} from '@eutaktos/domain';
import {
  PROFILE_COMPLETENESS,
  RECENT_AVAILABILITY_CHANGES,
  completedAssignmentHistoryFromScheduling,
  deterministicRecommendationEvidence as buildRawRecommendationEvidence,
  type ActiveAssignmentEvidence,
  type AffectedAssignmentEvidence,
  type AffectedAssignmentInput,
  type AssignmentWorkloadEvidence,
  type BlockedEvidenceContract,
  type CompletedAssignmentHistoryInput,
  type DeterministicRecommendation,
  type DeterministicRecommendationInput,
  type RecommendationCandidateEvidence,
  type RecommendationHistoryEvidence,
  type RecommendationReason,
  type RecommendationReasonCode,
  type RecommendationWarning,
  type RecommendationWarningCode,
  type RecommendationInputContractVersion,
} from './people-overview-evidence';

export {
  PROFILE_COMPLETENESS,
  RECENT_AVAILABILITY_CHANGES,
  completedAssignmentHistoryFromScheduling,
};
export type {
  ActiveAssignmentEvidence,
  AffectedAssignmentEvidence,
  AffectedAssignmentInput,
  AssignmentWorkloadEvidence,
  BlockedEvidenceContract,
  CompletedAssignmentHistoryInput,
  DeterministicRecommendation,
  DeterministicRecommendationInput,
  RecommendationCandidateEvidence,
  RecommendationHistoryEvidence,
  RecommendationReason,
  RecommendationReasonCode,
  RecommendationWarning,
  RecommendationWarningCode,
  RecommendationInputContractVersion,
};

function reason(code: RecommendationReasonCode): RecommendationReason {
  return Object.freeze({ code });
}

function recommendationInstant(value: string, field: 'startsAt' | 'endsAt'): number {
  if (typeof value !== 'string' || !/T/.test(value) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new Error(`${field} must be a timezone-aware ISO instant`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${field} must be a valid ISO instant`);
  return timestamp;
}

function validateRecommendationWindow(input: DeterministicRecommendationInput): void {
  const startsAt = recommendationInstant(input.startsAt, 'startsAt');
  const endsAt = recommendationInstant(input.endsAt, 'endsAt');
  if (endsAt <= startsAt) throw new Error('recommendation window must end after it starts');
}

function normalizeLongIntervalReasons(result: DeterministicRecommendation): DeterministicRecommendation {
  const factualDays = result.candidates
    .map(candidate => candidate.history.daysSinceLastCompletedAssignment)
    .filter((value): value is number => value !== undefined);
  const longest = factualDays.length >= 2 ? Math.max(...factualDays) : undefined;
  const shortest = factualDays.length >= 2 ? Math.min(...factualDays) : undefined;
  const hasRelativeLongInterval = longest !== undefined && shortest !== undefined && longest > shortest;

  const normalize = (candidate: RecommendationCandidateEvidence, allowLongInterval: boolean): RecommendationCandidateEvidence => {
    const reasons = candidate.reasons.filter(item => item.code !== 'LONGER_SINCE_LAST_ASSIGNMENT');
    const days = candidate.history.daysSinceLastCompletedAssignment;
    if (allowLongInterval && hasRelativeLongInterval && days === longest) reasons.push(reason('LONGER_SINCE_LAST_ASSIGNMENT'));
    return Object.freeze({ ...candidate, reasons: Object.freeze(reasons) });
  };

  return Object.freeze({
    contractVersion: result.contractVersion,
    inputContractVersion: result.inputContractVersion,
    candidates: Object.freeze(result.candidates.map(candidate => normalize(candidate, true))),
    excluded: Object.freeze(result.excluded.map(candidate => normalize(candidate, false))),
  });
}

/**
 * Principal-reviewed public recommendation contract.
 * `LONGER_SINCE_LAST_ASSIGNMENT` is emitted only when completed-history evidence
 * proves that a valid candidate has the longest factual interval among at least
 * two candidates with completed history. Missing history is never converted into
 * positive long-interval evidence and excluded candidates never receive it.
 * The target instant window is validated before reading candidates so malformed
 * input cannot become conditionally valid merely because the candidate list is empty.
 */
export function deterministicRecommendationEvidence(
  context: AccessContext,
  input: DeterministicRecommendationInput,
): DeterministicRecommendation {
  validateRecommendationWindow(input);
  return normalizeLongIntervalReasons(buildRawRecommendationEvidence(context, input));
}

function assertAffectedAssignmentReadCapabilities(context: AccessContext): void {
  assertCapability(context, 'people.read');
  assertCapability(context, 'availability.read');
  assertCapability(context, 'schedule.read');
}

/**
 * Read-only evidence for absence affecting an already active assignment.
 * Eligibility is deliberately not required because this query does not evaluate
 * candidacy; it only combines authorized people, availability and schedule facts.
 */
export function affectedAssignmentsByAvailability(
  context: AccessContext,
  input: AffectedAssignmentInput,
): readonly AffectedAssignmentEvidence[] {
  assertAffectedAssignmentReadCapabilities(context);
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

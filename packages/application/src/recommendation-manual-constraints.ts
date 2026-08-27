import type { DeterministicRecommendation, RecommendationCandidateEvidence } from './people-overview-evidence-reviewed';

export const MANUAL_RECOMMENDATION_CONSTRAINT_KIND = 'exclude' as const;
export const MANUAL_RECOMMENDATION_CONSTRAINT_CODE = 'MANUAL_EXCLUSION' as const;

export interface ManualRecommendationConstraint {
  readonly id: string;
  readonly tenantId: string;
  readonly personId: string;
  readonly assignmentTypeId: string;
  readonly kind: typeof MANUAL_RECOMMENDATION_CONSTRAINT_KIND;
  readonly createdAt: string;
}

export interface ManualConstraintCandidateEvidence extends RecommendationCandidateEvidence {
  readonly manualConstraintCodes: readonly (typeof MANUAL_RECOMMENDATION_CONSTRAINT_CODE)[];
}

export interface ConstrainedRecommendation {
  readonly contractVersion: DeterministicRecommendation['contractVersion'];
  readonly inputContractVersion: DeterministicRecommendation['inputContractVersion'];
  readonly candidates: readonly Readonly<ManualConstraintCandidateEvidence>[];
  readonly excluded: readonly Readonly<ManualConstraintCandidateEvidence>[];
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) throw new Error(`${field} is invalid`);
  return normalized;
}

export function normalizeManualRecommendationConstraint(input: ManualRecommendationConstraint): Readonly<ManualRecommendationConstraint> {
  const id = required(input.id, 'constraintId');
  const tenantId = required(input.tenantId, 'tenantId');
  const personId = required(input.personId, 'personId');
  const assignmentTypeId = required(input.assignmentTypeId, 'assignmentTypeId');
  if (input.kind !== MANUAL_RECOMMENDATION_CONSTRAINT_KIND) throw new Error('Unsupported manual recommendation constraint');
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('createdAt must be a valid ISO instant');
  return Object.freeze({ id, tenantId, personId, assignmentTypeId, kind: MANUAL_RECOMMENDATION_CONSTRAINT_KIND, createdAt: input.createdAt });
}

function withoutRank(candidate: RecommendationCandidateEvidence): ManualConstraintCandidateEvidence {
  const { rank: _rank, ...rest } = candidate;
  return Object.freeze({ ...rest, status: 'excluded' as const, manualConstraintCodes: Object.freeze([MANUAL_RECOMMENDATION_CONSTRAINT_CODE]) });
}

function unchanged(candidate: RecommendationCandidateEvidence): ManualConstraintCandidateEvidence {
  return Object.freeze({ ...candidate, manualConstraintCodes: Object.freeze([]) });
}

export function applyManualRecommendationConstraints(
  recommendation: Readonly<DeterministicRecommendation>,
  tenantIdInput: string,
  assignmentTypeIdInput: string,
  constraints: readonly Readonly<ManualRecommendationConstraint>[],
): Readonly<ConstrainedRecommendation> {
  const tenantId = required(tenantIdInput, 'tenantId');
  const assignmentTypeId = required(assignmentTypeIdInput, 'assignmentTypeId');
  const excludedPersonIds = new Set(constraints
    .map(normalizeManualRecommendationConstraint)
    .filter(constraint => constraint.tenantId === tenantId && constraint.assignmentTypeId === assignmentTypeId && constraint.kind === 'exclude')
    .map(constraint => constraint.personId));

  const keptCandidates = recommendation.candidates
    .filter(candidate => !excludedPersonIds.has(candidate.personId))
    .map(unchanged)
    .map((candidate, index) => Object.freeze({ ...candidate, rank: index + 1 }));
  const manuallyExcluded = recommendation.candidates
    .filter(candidate => excludedPersonIds.has(candidate.personId))
    .map(withoutRank);
  const alreadyExcluded = recommendation.excluded.map(unchanged);
  const excluded = [...alreadyExcluded, ...manuallyExcluded].sort((left, right) => left.personId.localeCompare(right.personId));

  return Object.freeze({
    contractVersion: recommendation.contractVersion,
    inputContractVersion: recommendation.inputContractVersion,
    candidates: Object.freeze(keptCandidates),
    excluded: Object.freeze(excluded),
  });
}

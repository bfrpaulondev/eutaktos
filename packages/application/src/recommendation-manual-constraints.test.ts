import { describe, expect, it } from 'vitest';
import { applyManualRecommendationConstraints, normalizeManualRecommendationConstraint } from './recommendation-manual-constraints';
import type { DeterministicRecommendation } from './people-overview-evidence-reviewed';

function recommendation(): DeterministicRecommendation {
  return Object.freeze({
    contractVersion: 'px7-evidence-v1',
    inputContractVersion: 'px7-recommendation-input-v1',
    candidates: Object.freeze([
      Object.freeze({ personId: 'person-a', status: 'candidate' as const, rank: 1, reasons: Object.freeze([]), warnings: Object.freeze([]), history: Object.freeze({ kind: 'no-completed-history' as const }), sameWeekAssignmentCount: 0 }),
      Object.freeze({ personId: 'person-b', status: 'candidate' as const, rank: 2, reasons: Object.freeze([]), warnings: Object.freeze([]), history: Object.freeze({ kind: 'no-completed-history' as const }), sameWeekAssignmentCount: 0 }),
    ]),
    excluded: Object.freeze([
      Object.freeze({ personId: 'person-c', status: 'excluded' as const, reasons: Object.freeze([]), warnings: Object.freeze([]), history: Object.freeze({ kind: 'no-completed-history' as const }), sameWeekAssignmentCount: 0 }),
    ]),
  });
}

const constraint = Object.freeze({
  id: 'manual-constraint-1', tenantId: 'tenant-a', personId: 'person-a', assignmentTypeId: 'reading', kind: 'exclude' as const, createdAt: '2026-08-27T12:00:00.000Z',
});

describe('manual recommendation constraints', () => {
  it('moves an explicitly excluded candidate into excluded evidence and deterministically re-ranks remaining candidates', () => {
    const result = applyManualRecommendationConstraints(recommendation(), 'tenant-a', 'reading', [constraint]);
    expect(result.candidates.map(item => [item.personId, item.rank])).toEqual([['person-b', 1]]);
    expect(result.excluded.find(item => item.personId === 'person-a')).toMatchObject({ status: 'excluded', manualConstraintCodes: ['MANUAL_EXCLUSION'] });
    expect(result.excluded.find(item => item.personId === 'person-c')).toMatchObject({ manualConstraintCodes: [] });
  });

  it('ignores constraints from another tenant or assignment type', () => {
    expect(applyManualRecommendationConstraints(recommendation(), 'tenant-b', 'reading', [constraint]).candidates).toHaveLength(2);
    expect(applyManualRecommendationConstraints(recommendation(), 'tenant-a', 'talk', [constraint]).candidates).toHaveLength(2);
  });

  it('normalizes and rejects unsupported or invalid stored constraint evidence', () => {
    expect(normalizeManualRecommendationConstraint(constraint)).toEqual(constraint);
    expect(() => normalizeManualRecommendationConstraint({ ...constraint, kind: 'prefer' as never })).toThrow('Unsupported manual recommendation constraint');
    expect(() => normalizeManualRecommendationConstraint({ ...constraint, createdAt: 'invalid' })).toThrow('createdAt must be a valid ISO instant');
  });
});
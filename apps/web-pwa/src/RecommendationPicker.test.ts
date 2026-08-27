import { describe, expect, it } from 'vitest';
import { additionalEligibleCandidates, eligibleRecommendationCandidates, topRecommendationCandidates } from './RecommendationPicker';
import type { RecommendationPersonDto } from './lib/peopleRecommendationApi';

function candidate(personId: string, rank: number): RecommendationPersonDto {
  return Object.freeze({
    personId,
    displayName: `Person ${personId}`,
    status: 'candidate',
    rank,
    reasons: Object.freeze([{ code: 'ELIGIBLE' as const }, { code: 'AVAILABLE' as const }]),
    warnings: Object.freeze([]),
    manualConstraintCodes: Object.freeze([]),
    history: Object.freeze({ kind: 'no-completed-history' as const }),
    sameWeekAssignmentCount: 0,
  });
}

describe('C5.6 recommendation picker projection', () => {
  const candidates = [candidate('a', 1), candidate('b', 2), candidate('c', 3), candidate('d', 4), candidate('e', 5)];

  it('shows the first three candidates in the exact canonical server order', () => {
    expect(topRecommendationCandidates(candidates).map(item => [item.personId, item.rank])).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });

  it('exposes every additional eligible candidate without recalculating rank', () => {
    expect(additionalEligibleCandidates(candidates).map(item => [item.personId, item.rank])).toEqual([['d', 4], ['e', 5]]);
    expect(eligibleRecommendationCandidates(candidates).map(item => item.personId)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('never repairs or reorders evidence in the presentation projection', () => {
    const deliberatelyMalformedForPureHelper = [candidate('z', 2), candidate('m', 1), candidate('a', 3), candidate('x', 4)];
    expect(topRecommendationCandidates(deliberatelyMalformedForPureHelper, 3).map(item => item.personId)).toEqual(['z', 'm', 'a']);
    expect(additionalEligibleCandidates(deliberatelyMalformedForPureHelper, 3).map(item => item.personId)).toEqual(['x']);
  });

  it('fails closed for an invalid display limit', () => {
    expect(topRecommendationCandidates([candidate('a', 1)], 0)).toEqual([]);
    expect(topRecommendationCandidates([candidate('a', 1)], 1.5)).toEqual([]);
    expect(additionalEligibleCandidates([candidate('a', 1)], 0)).toEqual([]);
    expect(additionalEligibleCandidates([candidate('a', 1)], 1.5)).toEqual([]);
  });
});
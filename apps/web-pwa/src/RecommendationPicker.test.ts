import { describe, expect, it } from 'vitest';
import { topRecommendationCandidates } from './RecommendationPicker';
import type { RecommendationPersonDto } from './lib/peopleRecommendationApi';

function candidate(personId: string, rank: number): RecommendationPersonDto {
  return Object.freeze({
    personId,
    displayName: `Person ${personId}`,
    status: 'candidate',
    rank,
    reasons: Object.freeze([{ code: 'ELIGIBLE' as const }, { code: 'AVAILABLE' as const }]),
    warnings: Object.freeze([]),
    history: Object.freeze({ kind: 'no-completed-history' as const }),
    sameWeekAssignmentCount: 0,
  });
}

describe('C5.5 recommendation picker projection', () => {
  it('shows the first three candidates in the exact canonical server order', () => {
    const result = topRecommendationCandidates([
      candidate('a', 1),
      candidate('b', 2),
      candidate('c', 3),
      candidate('d', 4),
    ]);
    expect(result.map(item => [item.personId, item.rank])).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });

  it('never repairs or reorders evidence in the presentation projection', () => {
    const deliberatelyMalformedForPureHelper = [candidate('z', 2), candidate('m', 1), candidate('a', 3)];
    expect(topRecommendationCandidates(deliberatelyMalformedForPureHelper, 3).map(item => item.personId)).toEqual(['z', 'm', 'a']);
  });

  it('fails closed for an invalid display limit', () => {
    expect(topRecommendationCandidates([candidate('a', 1)], 0)).toEqual([]);
    expect(topRecommendationCandidates([candidate('a', 1)], 1.5)).toEqual([]);
  });
});

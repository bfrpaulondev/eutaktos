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
  it('shows the first three candidates by server rank without inventing a client score', () => {
    const result = topRecommendationCandidates([
      candidate('c', 3),
      candidate('a', 1),
      candidate('d', 4),
      candidate('b', 2),
    ]);
    expect(result.map(item => [item.personId, item.rank])).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });

  it('uses personId only as a deterministic display tie-break and never recalculates rank evidence', () => {
    const result = topRecommendationCandidates([candidate('z', 2), candidate('a', 2), candidate('m', 1)], 3);
    expect(result.map(item => item.personId)).toEqual(['m', 'a', 'z']);
  });

  it('fails closed for an invalid display limit', () => {
    expect(topRecommendationCandidates([candidate('a', 1)], 0)).toEqual([]);
    expect(topRecommendationCandidates([candidate('a', 1)], 1.5)).toEqual([]);
  });
});

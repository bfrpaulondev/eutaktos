import { describe, expect, it, vi } from 'vitest';
import { createPeopleRecommendationApi, parsePeopleRecommendationResponse } from './peopleRecommendationApi';

const validCandidate = {
  personId: 'person-1', displayName: 'Ana Martins', status: 'candidate', rank: 1,
  reasons: [{ code: 'ELIGIBLE' }, { code: 'AVAILABLE' }, { code: 'NO_MEETING_CONFLICT' }, { code: 'LONGER_SINCE_LAST_ASSIGNMENT' }],
  warnings: [{ code: 'HAS_WEEKLY_ASSIGNMENT' }], manualConstraintCodes: [],
  history: { kind: 'completed-history', lastCompletedMeetingDate: '2032-05-01', daysSinceLastCompletedAssignment: 40 }, sameWeekAssignmentCount: 1,
} as const;

const valid = {
  contractVersion: 'people-recommendation-v1', evidenceContractVersion: 'px7-evidence-v1', inputContractVersion: 'px7-recommendation-input-v1', canManageManualConstraints: true,
  target: { meetingId: 'meeting-1', slotId: 'slot-1', assignmentTypeId: 'builtin:apply-yourself-to-the-ministry', meetingDate: '2032-06-10', startsAt: '2032-06-10T18:30:00.000Z', endsAt: '2032-06-10T18:35:00.000Z' },
  candidates: [validCandidate],
  excluded: [{ personId: 'person-2', displayName: 'Beatriz Costa', status: 'excluded', reasons: [{ code: 'NOT_ELIGIBLE' }], warnings: [{ code: 'NO_COMPLETED_ASSIGNMENT_HISTORY' }], manualConstraintCodes: [], history: { kind: 'no-completed-history' }, sameWeekAssignmentCount: 0 }],
} as const;

describe('C5.5 People recommendation API client', () => {
  it('parses the reviewed PX7 response without changing reason, warning or rank order', () => {
    const parsed = parsePeopleRecommendationResponse(valid);
    expect(parsed.target.assignmentTypeId).toBe('builtin:apply-yourself-to-the-ministry');
    expect(parsed.canManageManualConstraints).toBe(true);
    expect(parsed.candidates[0]).toMatchObject({ personId: 'person-1', displayName: 'Ana Martins', rank: 1, sameWeekAssignmentCount: 1 });
    expect(parsed.candidates[0]?.reasons.map(item => item.code)).toEqual(['ELIGIBLE', 'AVAILABLE', 'NO_MEETING_CONFLICT', 'LONGER_SINCE_LAST_ASSIGNMENT']);
  });

  it.each([
    ['unknown reason code', { ...valid, candidates: [{ ...validCandidate, reasons: [{ code: 'MADE_UP_REASON' }] }] }],
    ['unknown warning code', { ...valid, candidates: [{ ...validCandidate, warnings: [{ code: 'MADE_UP_WARNING' }] }] }],
    ['manual exclusion on candidate', { ...valid, candidates: [{ ...validCandidate, manualConstraintCodes: ['MANUAL_EXCLUSION'] }] }],
    ['unknown manual constraint', { ...valid, excluded: [{ ...valid.excluded[0], manualConstraintCodes: ['OTHER'] }] }],
    ['candidate without rank', { ...valid, candidates: [{ ...validCandidate, rank: undefined }] }],
    ['excluded candidate with rank', { ...valid, excluded: [{ ...valid.excluded[0], rank: 9 }] }],
    ['negative workload', { ...valid, candidates: [{ ...validCandidate, sameWeekAssignmentCount: -1 }] }],
    ['fabricated completed history', { ...valid, candidates: [{ ...validCandidate, history: { kind: 'completed-history', lastCompletedMeetingDate: '2032-05-01' } }] }],
    ['non-sequential rank order', { ...valid, candidates: [{ ...validCandidate, rank: 2 }] }],
    ['duplicate candidate identity', { ...valid, candidates: [validCandidate, { ...validCandidate, rank: 2 }] }],
    ['identity repeated across candidate and excluded', { ...valid, excluded: [{ ...valid.excluded[0], personId: 'person-1' }] }],
  ])('fails closed for %s', (_label, body) => { expect(() => parsePeopleRecommendationResponse(body)).toThrow('Invalid recommendation response'); });

  it('preserves a canonical multi-candidate sequence exactly as returned by the server', () => {
    const body = { ...valid, candidates: [validCandidate, { ...validCandidate, personId: 'person-3', displayName: 'Carla Dias', rank: 2 }, { ...validCandidate, personId: 'person-4', displayName: 'Diana Lopes', rank: 3 }] };
    expect(parsePeopleRecommendationResponse(body).candidates.map(item => [item.personId, item.rank])).toEqual([['person-1', 1], ['person-3', 2], ['person-4', 3]]);
  });

  it('sends only target identity, same-origin credentials and no request body for reads', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(valid), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createPeopleRecommendationApi(fetcher as typeof fetch);
    await api.get('meeting-1', 'slot-1');
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/people/recommendations?meetingId=meeting-1&slotId=slot-1');
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } });
    expect(init.body).toBeUndefined();
  });

  it('posts only contextual resource identities and explicit exclusion intent', async () => {
    const response = { contractVersion: 'people-manual-constraint-v1', target: { meetingId: 'meeting-1', slotId: 'slot-1', assignmentTypeId: 'reading' }, personId: 'person-1', excluded: true, changed: true };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createPeopleRecommendationApi(fetcher as typeof fetch);
    await api.setManualExclusion('meeting-1', 'slot-1', 'person-1', true);
    expect(fetcher).toHaveBeenCalledWith('/api/people/recommendations', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: JSON.stringify({ meetingId: 'meeting-1', slotId: 'slot-1', personId: 'person-1', action: 'exclude' }) }));
  });

  it('fails if the server response targets a different meeting or slot', async () => {
    const mismatched = { ...valid, target: { ...valid.target, slotId: 'slot-other' } };
    const api = createPeopleRecommendationApi(async () => new Response(JSON.stringify(mismatched), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expect(api.get('meeting-1', 'slot-1')).rejects.toThrow('Recommendation target mismatch');
  });

  it('exposes status without trusting server error copy', async () => {
    const api = createPeopleRecommendationApi(async () => new Response(JSON.stringify({ error: 'sensitive server detail' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    await expect(api.get('meeting-1', 'slot-1')).rejects.toMatchObject({ status: 403, message: 'People recommendation request failed (403)' });
  });
});
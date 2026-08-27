import { describe, expect, it, vi } from 'vitest';
import { createPeopleAssistanceApi, parsePeopleAssistance } from './peopleAssistanceApi';

const response = {
  contractVersion: 'people-assistance-v1',
  affectedAssignments: {
    status: 'ready',
    totalCount: 1,
    truncated: false,
    items: [{
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      meetingDate: '2026-09-03',
      affectedDisplayName: 'Ana',
      suggestionStatus: 'ready',
      topCandidates: [
        { rank: 1, displayName: 'Bruno' },
        { rank: 2, displayName: 'Carlos' },
      ],
    }],
  },
  incompleteMeetings: {
    status: 'ready',
    meetingCount: 1,
    openPartCount: 3,
    truncated: false,
    items: [{ meetingId: 'meeting-1', meetingDate: '2026-09-03', openPartCount: 3, partsWithCandidates: 2 }],
  },
  workloadImbalance: {
    status: 'ready',
    itemCount: 1,
    truncated: false,
    items: [{
      meetingId: 'meeting-1',
      slotId: 'slot-2',
      meetingDate: '2026-09-03',
      displayName: 'Daniel',
      sameWeekAssignmentCount: 2,
      lowerWorkloadAlternativeCount: 3,
    }],
  },
  longInterval: {
    status: 'ready',
    itemCount: 1,
    truncated: false,
    items: [{
      meetingId: 'meeting-1',
      slotId: 'slot-3',
      meetingDate: '2026-09-03',
      displayName: 'Eva',
      daysSinceLastCompletedAssignment: 84,
    }],
  },
} as const;

describe('People assistance API', () => {
  it('parses the minimized v1 assistance contract', () => {
    expect(parsePeopleAssistance(response)).toEqual(response);
  });

  it('accepts unavailable capability-bound sections without inventing zero evidence', () => {
    expect(parsePeopleAssistance({
      ...response,
      affectedAssignments: { status: 'unavailable' },
      incompleteMeetings: { status: 'unavailable' },
      workloadImbalance: { status: 'unavailable' },
      longInterval: { status: 'unavailable' },
    })).toEqual({
      contractVersion: 'people-assistance-v1',
      affectedAssignments: { status: 'unavailable' },
      incompleteMeetings: { status: 'unavailable' },
      workloadImbalance: { status: 'unavailable' },
      longInterval: { status: 'unavailable' },
    });
  });

  it('rejects rank repair, unsafe identifiers and contradictory counts', () => {
    expect(() => parsePeopleAssistance({
      ...response,
      affectedAssignments: {
        ...response.affectedAssignments,
        items: [{ ...response.affectedAssignments.items[0], topCandidates: [{ rank: 2, displayName: 'Bruno' }] }],
      },
    })).toThrow('Invalid People assistance response');

    expect(() => parsePeopleAssistance({
      ...response,
      incompleteMeetings: {
        ...response.incompleteMeetings,
        items: [{ ...response.incompleteMeetings.items[0], meetingId: 'meeting/1' }],
      },
    })).toThrow('Invalid People assistance response');

    expect(() => parsePeopleAssistance({
      ...response,
      incompleteMeetings: {
        ...response.incompleteMeetings,
        items: [{ ...response.incompleteMeetings.items[0], partsWithCandidates: 4 }],
      },
    })).toThrow('Invalid People assistance response');
  });

  it('uses same-origin GET and preserves HTTP status for UI classification', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
    const api = createPeopleAssistanceApi(fetcher);

    await expect(api.get()).rejects.toThrow('Forbidden (403)');
    expect(fetcher).toHaveBeenCalledWith('/api/people/assistance', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });
});

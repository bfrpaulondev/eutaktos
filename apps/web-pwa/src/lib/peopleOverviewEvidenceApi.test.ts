import { describe, expect, it, vi } from 'vitest';
import { createPeopleOverviewEvidenceApi, parsePeopleOverviewEvidence } from './peopleOverviewEvidenceApi';

const response = {
  contractVersion: 'people-overview-evidence-v1',
  affectedAssignments: { status: 'ready', affectedPeopleCount: 2, affectedAssignmentCount: 3 },
  longInterval: { status: 'ready', candidateCount: 1, openAssignmentCount: 1, evaluatedOpenStudentAssignments: 2 },
  profileCompleteness: { status: 'blocked', requiredBoundary: 'profile requirements' },
  recentAvailabilityChanges: { status: 'blocked', requiredBoundary: 'availability history' },
} as const;

describe('People Overview evidence API', () => {
  it('parses the minimized versioned response without accepting invented fields', () => {
    expect(parsePeopleOverviewEvidence(response)).toEqual(response);
    expect(() => parsePeopleOverviewEvidence({ ...response, contractVersion: 'other' })).toThrow('Invalid People Overview evidence response');
    expect(() => parsePeopleOverviewEvidence({ ...response, longInterval: { status: 'ready', candidateCount: -1, openAssignmentCount: 0, evaluatedOpenStudentAssignments: 0 } })).toThrow('Invalid People Overview evidence response');
  });

  it('accepts explicit unavailable evidence without treating it as zero factual data', () => {
    expect(parsePeopleOverviewEvidence({
      ...response,
      affectedAssignments: { status: 'unavailable' },
      longInterval: { status: 'unavailable' },
    })).toMatchObject({
      affectedAssignments: { status: 'unavailable' },
      longInterval: { status: 'unavailable' },
    });
  });

  it('uses same-origin credentials and preserves HTTP status for classification', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
    const api = createPeopleOverviewEvidenceApi(fetcher);

    await expect(api.get()).rejects.toThrow('Forbidden (403)');
    expect(fetcher).toHaveBeenCalledWith('/api/people/overview-evidence', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });
});

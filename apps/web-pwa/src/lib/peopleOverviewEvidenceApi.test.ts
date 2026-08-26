import { describe, expect, it, vi } from 'vitest';
import { createPeopleOverviewEvidenceApi, parsePeopleOverviewEvidence } from './peopleOverviewEvidenceApi';

const response = {
  contractVersion: 'people-overview-evidence-v2',
  affectedAssignments: { status: 'ready', affectedPeopleCount: 2, affectedAssignmentCount: 3 },
  longInterval: { status: 'ready', candidateCount: 1, openAssignmentCount: 1, evaluatedOpenStudentAssignments: 2 },
  profileCompleteness: {
    status: 'ready',
    contractVersion: 'operational-profile-requirements-v1',
    scope: 'active-people',
    requirementCodes: ['PREFERRED_LOCALE'],
    evaluatedPersonCount: 3,
    incompletePersonCount: 1,
  },
  recentAvailabilityChanges: {
    status: 'ready',
    contractVersion: 'recent-availability-changes-v1',
    scope: 'active-people',
    windowDays: 14,
    changedPersonCount: 2,
    latestChangedAt: '2026-08-25T10:00:00.000Z',
  },
} as const;

describe('People Overview evidence API', () => {
  it('parses the minimized v2 response without accepting invented contracts', () => {
    expect(parsePeopleOverviewEvidence(response)).toEqual(response);
    expect(() => parsePeopleOverviewEvidence({ ...response, contractVersion: 'people-overview-evidence-v1' })).toThrow('Invalid People Overview evidence response');
    expect(() => parsePeopleOverviewEvidence({ ...response, profileCompleteness: { ...response.profileCompleteness, requirementCodes: ['PHONE'] } })).toThrow('Invalid People Overview evidence response');
    expect(() => parsePeopleOverviewEvidence({ ...response, longInterval: { status: 'ready', candidateCount: -1, openAssignmentCount: 0, evaluatedOpenStudentAssignments: 0 } })).toThrow('Invalid People Overview evidence response');
  });

  it('accepts explicit unavailable permission-bound evidence without treating it as factual zero', () => {
    expect(parsePeopleOverviewEvidence({
      ...response,
      affectedAssignments: { status: 'unavailable' },
      longInterval: { status: 'unavailable' },
      recentAvailabilityChanges: { status: 'unavailable' },
    })).toMatchObject({
      affectedAssignments: { status: 'unavailable' },
      longInterval: { status: 'unavailable' },
      recentAvailabilityChanges: { status: 'unavailable' },
      profileCompleteness: { status: 'ready', incompletePersonCount: 1 },
    });
  });

  it('rejects malformed recent availability timestamps rather than displaying ambiguous evidence', () => {
    expect(() => parsePeopleOverviewEvidence({
      ...response,
      recentAvailabilityChanges: { ...response.recentAvailabilityChanges, latestChangedAt: 'not-a-date' },
    })).toThrow('Invalid People Overview evidence response');
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

import { describe, expect, it, vi } from 'vitest';
import { createPeopleDirectoryApi, parsePeopleDirectoryResponse } from './peopleDirectoryApi';

const response = {
  contractVersion: 'people-directory-v1', generatedAt: '2026-08-25T17:00:00.000Z',
  capabilities: { writePeople: true, availability: true, eligibility: true, responsibilities: true, schedule: true },
  filters: { groups: [{ id: 'group-1', name: 'Group 1' }], responsibilityKeys: ['secretary'], assignmentTypeIds: ['builtin:reading'] },
  people: [{ id: 'person-1', displayName: 'Ana Martins', preferredLocale: 'pt-PT', active: true, groups: [{ id: 'group-1', name: 'Group 1' }], availability: { status: 'ready', current: 'available', currentReasonCodes: [], nextPeriod: { startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-03T00:00:00.000Z', reasonCode: 'away' } }, eligibility: { status: 'ready', enabledAssignmentTypeIds: ['builtin:reading'] }, responsibilities: { status: 'ready', keys: ['secretary'] }, assignmentHistory: { status: 'ready', lastCompletedMeetingDate: '2026-08-01' } }],
} as const;

describe('People directory API', () => {
  it('parses the versioned minimized projection and rejects invalid contracts', () => {
    expect(parsePeopleDirectoryResponse(response)).toEqual(response);
    expect(() => parsePeopleDirectoryResponse({ ...response, contractVersion: 'other' })).toThrow('Invalid People directory response');
    expect(() => parsePeopleDirectoryResponse({ ...response, capabilities: { ...response.capabilities, writePeople: 'yes' } })).toThrow('Invalid People directory response');
    expect(() => parsePeopleDirectoryResponse({ ...response, people: [{ ...response.people[0], active: 'yes' }] })).toThrow('Invalid People directory response');
  });

  it('preserves explicit unavailable subprojections instead of inventing empty facts', () => {
    const parsed = parsePeopleDirectoryResponse({ ...response, capabilities: { writePeople: false, availability: false, eligibility: false, responsibilities: false, schedule: false }, people: [{ ...response.people[0], availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } }] });
    expect(parsed.capabilities.writePeople).toBe(false);
    expect(parsed.people[0]).toMatchObject({ availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } });
  });

  it('uses same-origin GET and preserves HTTP status for auth/error classification', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
    const api = createPeopleDirectoryApi(fetcher);
    await expect(api.get()).rejects.toThrow('Forbidden (403)');
    expect(fetcher).toHaveBeenCalledWith('/api/people/directory', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createPeopleDirectoryApi } from './peopleDirectoryApi';

describe('People directory selector freshness', () => {
  it('bypasses stale browser caches when transfer selectors reload', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('GET');
      expect(init?.cache).toBe('no-store');
      return new Response(JSON.stringify({
        contractVersion: 'people-directory-v1',
        generatedAt: '2026-08-29T00:00:00.000Z',
        capabilities: { writePeople: true, availability: false, eligibility: false, responsibilities: false, schedule: false },
        filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [], labels: [] },
        people: [{
          id: 'p-new',
          displayName: 'QA New Person',
          active: true,
          labels: [],
          groups: [],
          availability: { status: 'unavailable' },
          eligibility: { status: 'unavailable' },
          responsibilities: { status: 'unavailable' },
          assignmentHistory: { status: 'unavailable' },
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;

    const result = await createPeopleDirectoryApi(fetcher).get();
    expect(result.people.map(person => person.id)).toEqual(['p-new']);
  });
});

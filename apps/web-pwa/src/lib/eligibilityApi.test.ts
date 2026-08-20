import { describe, expect, it, vi } from 'vitest';
import { createEligibilityApi } from './eligibilityApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('eligibilityApi', () => {
  it('loads minimized eligibility decisions from the dedicated endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([
      {
        assignmentTypeId: 'bible-reading',
        enabled: true,
        decidedAt: '2026-08-20T14:00:00.000Z',
        decidedBy: 'must-be-dropped',
        tenantId: 'must-be-dropped',
      },
    ]));
    const api = createEligibilityApi(fetcher);

    await expect(api.list('person 1')).resolves.toEqual([
      {
        assignmentTypeId: 'bible-reading',
        enabled: true,
        decidedAt: '2026-08-20T14:00:00.000Z',
      },
    ]);
    expect(fetcher).toHaveBeenCalledWith('/api/people/person%201/eligibility', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('sets eligibility without allowing tenant actor or decision metadata in the payload contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      assignmentTypeId: 'bible-reading',
      enabled: false,
      decidedAt: '2026-08-20T15:00:00.000Z',
    }));
    const api = createEligibilityApi(fetcher);

    await expect(api.set('p/1', { assignmentTypeId: 'bible-reading', enabled: false })).resolves.toEqual({
      assignmentTypeId: 'bible-reading',
      enabled: false,
      decidedAt: '2026-08-20T15:00:00.000Z',
    });

    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/people/p%2F1/eligibility');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: 'PUT',
      credentials: 'same-origin',
      body: JSON.stringify({ assignmentTypeId: 'bible-reading', enabled: false }),
    }));
  });

  it('rejects malformed responses instead of propagating broader sensitive DTOs', async () => {
    const api = createEligibilityApi(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([
      { assignmentTypeId: 'bible-reading', enabled: true },
    ])));
    await expect(api.list('person-1')).rejects.toThrow('Invalid eligibility API response');
  });

  it('surfaces safe API errors', async () => {
    const api = createEligibilityApi(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403)));
    await expect(api.list('person-1')).rejects.toThrow('Forbidden');
  });
});

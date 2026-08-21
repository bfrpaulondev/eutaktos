import { describe, expect, it, vi } from 'vitest';
import { createAvailabilityApi, parsePeriod, parseList } from './availabilityApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('availabilityApi', () => {
  it('parses a valid DTO with optional reasonCode omitted', () => {
    expect(parsePeriod({
      id: 'a1',
      startsAt: '2026-09-01T09:00:00Z',
      endsAt: '2026-09-01T17:00:00Z',
    })).toEqual({
      id: 'a1',
      startsAt: '2026-09-01T09:00:00Z',
      endsAt: '2026-09-01T17:00:00Z',
    });
  });

  it('parses a valid DTO with reasonCode', () => {
    expect(parsePeriod({
      id: 'a2',
      startsAt: '2026-09-01T09:00:00Z',
      endsAt: '2026-09-01T17:00:00Z',
      reasonCode: 'away',
    })).toEqual({
      id: 'a2',
      startsAt: '2026-09-01T09:00:00Z',
      endsAt: '2026-09-01T17:00:00Z',
      reasonCode: 'away',
    });
  });

  it('parses a list of periods', () => {
    expect(parseList([
      { id: 'a1', startsAt: '2026-09-01T09:00:00Z', endsAt: '2026-09-01T17:00:00Z' },
      { id: 'a2', startsAt: '2026-09-02T09:00:00Z', endsAt: '2026-09-02T17:00:00Z', reasonCode: 'unavailable' },
    ])).toEqual([
      { id: 'a1', startsAt: '2026-09-01T09:00:00Z', endsAt: '2026-09-01T17:00:00Z' },
      { id: 'a2', startsAt: '2026-09-02T09:00:00Z', endsAt: '2026-09-02T17:00:00Z', reasonCode: 'unavailable' },
    ]);
  });

  it('loads availability periods via fetch', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([
      { id: 'a1', startsAt: '2026-09-01T09:00:00Z', endsAt: '2026-09-01T17:00:00Z', reasonCode: 'away' },
    ]));
    const api = createAvailabilityApi(fetcher);

    await expect(api.list('person 1')).resolves.toEqual([
      { id: 'a1', startsAt: '2026-09-01T09:00:00Z', endsAt: '2026-09-01T17:00:00Z', reasonCode: 'away' },
    ]);
    expect(fetcher).toHaveBeenCalledWith('/api/people/person%201/availability', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('adds an availability period via fetch and returns the created period', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      id: 'a2',
      startsAt: '2026-09-02T09:00:00Z',
      endsAt: '2026-09-02T17:00:00Z',
      reasonCode: 'unavailable',
    }, 201));
    const api = createAvailabilityApi(fetcher);

    await expect(api.add('p/1', {
      startsAt: '2026-09-02T09:00:00Z',
      endsAt: '2026-09-02T17:00:00Z',
      reasonCode: 'unavailable',
    })).resolves.toEqual({
      id: 'a2',
      startsAt: '2026-09-02T09:00:00Z',
      endsAt: '2026-09-02T17:00:00Z',
      reasonCode: 'unavailable',
    });

    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/people/p%2F1/availability');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify({ startsAt: '2026-09-02T09:00:00Z', endsAt: '2026-09-02T17:00:00Z', reasonCode: 'unavailable' }),
    }));
  });

  it('removes an availability period via fetch', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const api = createAvailabilityApi(fetcher);

    await expect(api.remove('p/1', 'a/2')).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/people/p%2F1/availability/a%2F2');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ method: 'DELETE', credentials: 'same-origin' }));
  });

  it('surfaces safe API errors from the response body', async () => {
    const api = createAvailabilityApi(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403)));
    await expect(api.list('person-1')).rejects.toThrow('Forbidden');
  });

  it('rejects malformed responses instead of propagating unknown DTOs', async () => {
    const api = createAvailabilityApi(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([
      { id: 'a1', startsAt: '2026-09-01' },
    ])));
    await expect(api.list('person-1')).rejects.toThrow('Invalid availability API response');
  });

  it('handles 404 with a descriptive error', async () => {
    const api = createAvailabilityApi(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Person not found' }, 404)));
    await expect(api.list('missing')).rejects.toThrow('Person not found');
  });
});

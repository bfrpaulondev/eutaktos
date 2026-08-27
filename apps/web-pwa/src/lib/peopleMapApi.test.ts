import { describe, expect, it, vi } from 'vitest';
import {
  createPeopleMapApi,
  parsePeopleMap,
  parsePeopleMapLocationMutation,
  PeopleMapApiError,
} from './peopleMapApi';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

const map = {
  contractVersion: 'people-map-v1',
  points: [{ personId: 'person-1', displayName: 'Ana Example', latitude: 38.72, longitude: -9.14 }],
} as const;

const location = {
  contractVersion: 'people-map-location-v1',
  changed: true,
  location: { latitude: 38.72, longitude: -9.14 },
} as const;

describe('peopleMapApi', () => {
  it('loads the exact map endpoint with abort support and only the minimum projection', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(map));
    const api = createPeopleMapApi(fetcher);
    const controller = new AbortController();

    await expect(api.list(controller.signal)).resolves.toEqual(map);
    expect(fetcher).toHaveBeenCalledWith('/api/people/map', expect.objectContaining({
      method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: controller.signal,
    }));
  });

  it('uses an encoded PUT path and sends only coordinates', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(location));
    const api = createPeopleMapApi(fetcher);

    await expect(api.setLocation('person / a', 38.720123, -9.140456)).resolves.toEqual(location);
    const [path, init] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe('/api/people/person%20%2F%20a/map-location');
    expect(init).toEqual(expect.objectContaining({ method: 'PUT', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }));
    expect(JSON.parse(String(init?.body))).toEqual({ latitude: 38.720123, longitude: -9.140456 });
    expect(JSON.stringify(init)).not.toContain('tenantId');
    expect(JSON.stringify(init)).not.toContain('actorId');
    expect(JSON.stringify(init)).not.toContain('capabilities');
  });

  it('uses an encoded DELETE path without a body or authority data', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ...location, changed: false, location: null }));
    const api = createPeopleMapApi(fetcher);

    await expect(api.removeLocation('person / a')).resolves.toEqual({ ...location, changed: false, location: null });
    const [path, init] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe('/api/people/person%20%2F%20a/map-location');
    expect(init).toEqual({ method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json' } });
  });

  it('normalizes HTTP failures and fails closed on malformed or over-precise responses', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'Forbidden' }, 403))
      .mockResolvedValueOnce(jsonResponse({ contractVersion: 'people-map-v1', points: [{ personId: 'person-1', displayName: 'Ana', latitude: 38.721, longitude: -9.14 }] }))
      .mockResolvedValueOnce(jsonResponse({ ...location, tenantId: 'must-not-exist' }));
    const api = createPeopleMapApi(fetcher);

    await expect(api.list()).rejects.toEqual(expect.objectContaining({ name: 'PeopleMapApiError', status: 403 } satisfies Partial<PeopleMapApiError>));
    await expect(api.list()).rejects.toThrow('Invalid People Map API response');
    await expect(api.setLocation('person-1', 38.72, -9.14)).rejects.toThrow('Invalid People Map API response');
  });

  it('rejects unexpected DTO keys and invalid person references before network calls', async () => {
    expect(() => parsePeopleMap({ ...map, tenantId: 'tenant-a' })).toThrow('Invalid People Map API response');
    expect(() => parsePeopleMapLocationMutation({ ...location, location: { latitude: 38.72, longitude: -9.14, source: 'manual' } })).toThrow('Invalid People Map API response');
    const fetcher = vi.fn<typeof fetch>();
    const api = createPeopleMapApi(fetcher);
    await expect(api.setLocation('   ', 0, 0)).rejects.toThrow('personId is required');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

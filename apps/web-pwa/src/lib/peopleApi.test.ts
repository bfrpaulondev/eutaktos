import { describe, expect, it, vi } from 'vitest';
import { createPeopleApi, parsePeopleResponse } from './peopleApi';

describe('People API client', () => {
  it('parses and minimizes directory DTOs', () => {
    expect(parsePeopleResponse([{ id: 'p1', displayName: 'Ana Costa', preferredLocale: 'pt-PT', active: true }])).toEqual([
      { id: 'p1', displayName: 'Ana Costa', preferredLocale: 'pt-PT', active: true },
    ]);
    expect(parsePeopleResponse([{ id: 'p1', displayName: 'Ana', active: true, eligibility: [], availability: [] }])).toEqual([
      { id: 'p1', displayName: 'Ana', active: true },
    ]);
    expect(() => parsePeopleResponse([{ id: 'p1', displayName: 'Ana' }])).toThrow('Invalid People API response');
  });

  it('uses same-origin credentials and surfaces safe API errors', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
    const api = createPeopleApi(fetcher);

    await expect(api.list()).rejects.toThrow('Forbidden');
    expect(fetcher).toHaveBeenCalledWith('/api/people', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('creates a person using the transport payload contract', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ displayName: 'Ana Costa', preferredLocale: 'pt-PT' });
      return new Response(JSON.stringify({ id: 'p1', displayName: 'Ana Costa', preferredLocale: 'pt-PT', active: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const api = createPeopleApi(fetcher);

    await expect(api.create({ displayName: 'Ana Costa', preferredLocale: 'pt-PT' })).resolves.toMatchObject({ id: 'p1' });
  });

  it('updates only the editable profile fields over PATCH', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('/api/people/person-1');
      expect(init?.method).toBe('PATCH');
      expect(init?.credentials).toBe('same-origin');
      expect(JSON.parse(String(init?.body))).toEqual({ displayName: 'Ana C.', preferredLocale: null, active: false });
      return new Response(JSON.stringify({ id: 'person-1', displayName: 'Ana C.', active: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const api = createPeopleApi(fetcher);

    await expect(api.update('person-1', { displayName: 'Ana C.', preferredLocale: null, active: false })).resolves.toEqual({
      id: 'person-1', displayName: 'Ana C.', active: false,
    });
  });

  it('does not leak arbitrary runtime fields in profile updates', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({ active: false });
      return new Response(JSON.stringify({ id: 'person-1', displayName: 'Ana', active: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const api = createPeopleApi(fetcher);
    await api.update('person-1', { active: false, tenantId: 'evil', capabilities: ['access.manage'] } as never);
  });
});
import { describe, expect, it, vi } from 'vitest';
import { createPeopleApi, parsePeopleResponse } from './peopleApi';

describe('People labels API client', () => {
  it('parses explicit labels without widening other private profile data', () => {
    expect(parsePeopleResponse([{
      id: 'p1', displayName: 'Ana', active: true, labels: ['Apoio', 'Visita'],
      ordinaryContact: { phone: 'secret' }, eligibility: [{ enabled: true }],
    }])).toEqual([{ id: 'p1', displayName: 'Ana', active: true, labels: ['Apoio', 'Visita'] }]);
  });

  it('forces canonical list reads to bypass stale browser caches', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('GET');
      expect(init?.cache).toBe('no-store');
      return new Response(JSON.stringify([{ id: 'p1', displayName: 'Ana', active: true, labels: ['Apoio'] }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await expect(createPeopleApi(fetcher).list()).resolves.toEqual([
      { id: 'p1', displayName: 'Ana', active: true, labels: ['Apoio'] },
    ]);
  });

  it('sends labels only in the existing authenticated PATCH body', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('/api/people/p1');
      expect(init?.method).toBe('PATCH');
      expect(init?.credentials).toBe('same-origin');
      expect(JSON.parse(String(init?.body))).toEqual({ labels: ['Apoio'] });
      return new Response(JSON.stringify({ id: 'p1', displayName: 'Ana', active: true, labels: ['Apoio'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await expect(createPeopleApi(fetcher).update('p1', { labels: ['Apoio'] })).resolves.toEqual({
      id: 'p1', displayName: 'Ana', active: true, labels: ['Apoio'],
    });
  });
});

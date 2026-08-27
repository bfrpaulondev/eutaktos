import { describe, expect, it, vi } from 'vitest';
import { PeopleMapDatabase } from './_people-map-db';

const config = { url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' } as const;

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('PeopleMapDatabase', () => {
  it('lists only the minimum-data projection for the server-owned tenant', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{
      person_id: 'person-1', display_name: 'Ana', latitude: 38.72, longitude: -9.14,
      email: 'must-not-escape@example.test', address: 'must not escape', actor_id: 'actor-hidden',
    }]));
    const result = await new PeopleMapDatabase(config, fetcher).list('tenant-a');
    expect(result).toEqual([{ personId: 'person-1', displayName: 'Ana', latitude: 38.72, longitude: -9.14 }]);
    expect(JSON.stringify(result)).not.toContain('must-not-escape');
    expect(JSON.stringify(result)).not.toContain('actor-hidden');
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ p_tenant_id: 'tenant-a' });
  });

  it('sets only normalized coordinates with server-owned tenant and actor and returns no provenance metadata', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{
      changed: true, latitude: 38.72, longitude: -9.14, precision: 'approximate', source: 'manual', updated_at: '2026-08-27T20:30:00.000Z',
    }]));
    const database = new PeopleMapDatabase(config, fetcher);
    const result = await database.set({ tenantId: 'tenant-a', personId: 'person-1', actorId: 'actor-a', latitude: 38.72, longitude: -9.14, updatedAt: '2026-08-27T20:30:00.000Z' });
    expect(result).toEqual({ changed: true, latitude: 38.72, longitude: -9.14 });
    expect(JSON.stringify(result)).not.toContain('updatedAt');
    expect(JSON.stringify(result)).not.toContain('source');
    expect(fetcher).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/eutaktos_set_people_map_location', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      p_tenant_id: 'tenant-a', p_person_id: 'person-1', p_actor_id: 'actor-a', p_latitude: 38.72, p_longitude: -9.14, p_updated_at: '2026-08-27T20:30:00.000Z',
    });
  });

  it('removes idempotently through the dedicated RPC without coordinates', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(false));
    const result = await new PeopleMapDatabase(config, fetcher).remove({ tenantId: 'tenant-a', personId: 'person-1', actorId: 'actor-a', removedAt: '2026-08-27T20:31:00.000Z' });
    expect(result).toBe(false);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ p_tenant_id: 'tenant-a', p_person_id: 'person-1', p_actor_id: 'actor-a', p_removed_at: '2026-08-27T20:31:00.000Z' });
    expect(body).not.toHaveProperty('latitude');
    expect(body).not.toHaveProperty('longitude');
  });

  it('fails closed for malformed response bodies, unexpected content types and unapproved coordinate precision', async () => {
    const malformed = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ person_id: 'person-1', display_name: 'Ana', latitude: 38.721, longitude: -9.14 }]))
      .mockResolvedValueOnce(new Response('{}', { status: 200, headers: { 'Content-Type': 'text/plain' } }))
      .mockResolvedValueOnce(jsonResponse([{ changed: true, latitude: 38.721, longitude: -9.14, precision: 'approximate', source: 'manual', updated_at: '2026-08-27T20:30:00.000Z' }]));
    const database = new PeopleMapDatabase(config, malformed);

    await expect(database.list('tenant-a')).rejects.toMatchObject({ status: 502 });
    await expect(database.list('tenant-a')).rejects.toMatchObject({ status: 502 });
    await expect(database.set({ tenantId: 'tenant-a', personId: 'person-1', actorId: 'actor-a', latitude: 38.72, longitude: -9.14, updatedAt: '2026-08-27T20:30:00.000Z' })).rejects.toMatchObject({ status: 502 });
  });
});

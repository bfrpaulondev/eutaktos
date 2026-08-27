import { describe, expect, it, vi } from 'vitest';
import { PeopleTransfersDatabase } from './_people-transfers-db';

const config = { url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' } as const;

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('PeopleTransfersDatabase', () => {
  it('creates through the dedicated RPC and never requires a raw code', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const database = new PeopleTransfersDatabase(config, fetcher);
    await database.create({ p_transfer_id: 'people-transfer-1', p_token_hash: 'a'.repeat(64), p_payload: [{ displayName: 'Ana' }] });
    expect(fetcher).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/eutaktos_create_people_transfer', expect.objectContaining({ method: 'POST' }));
    const init = fetcher.mock.calls[0]?.[1];
    expect(String(init?.body)).toContain('a'.repeat(64));
    expect(String(init?.body)).not.toContain('code');
  });

  it('lists only normalized outbound metadata and strips pending Contact values', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{
      id: 'people-transfer-1', source_tenant_id: 'tenant-a', created_at: '2026-08-27T12:00:00.000Z', expires_at: '2026-08-30T12:00:00.000Z',
      claimed_at: null, cancelled_at: null, payload: [{ displayName: 'Ana', ordinaryContact: { phone: '+351 210000000' } }],
    }]));
    const result = await new PeopleTransfersDatabase(config, fetcher).list('tenant-a');
    expect(result).toEqual([{ id: 'people-transfer-1', sourceTenantId: 'tenant-a', createdAt: '2026-08-27T12:00:00.000Z', expiresAt: '2026-08-30T12:00:00.000Z', people: [{ displayName: 'Ana' }] }]);
    expect(JSON.stringify(result)).not.toContain('210000000');
  });

  it('parses preview and idempotent claim results from dedicated RPCs', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ transfer_id: 'people-transfer-1', expires_at: '2026-08-30T12:00:00.000Z', people: [{ displayName: 'Ana' }] }]))
      .mockResolvedValueOnce(jsonResponse([{ outcome: 'already-claimed', transfer_id: 'people-transfer-1', people: [{ personId: 'person-new', displayName: 'Ana' }] }]));
    const database = new PeopleTransfersDatabase(config, fetcher);
    expect(await database.preview('a'.repeat(64), '2026-08-27T12:00:00.000Z')).toEqual({ transferId: 'people-transfer-1', expiresAt: '2026-08-30T12:00:00.000Z', people: [{ displayName: 'Ana' }] });
    expect(await database.claim('a'.repeat(64), 'tenant-b', 'actor-b', '2026-08-27T12:01:00.000Z')).toEqual({ outcome: 'already-claimed', transferId: 'people-transfer-1', people: [{ personId: 'person-new', displayName: 'Ana' }] });
  });
});
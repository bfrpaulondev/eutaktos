import { describe, expect, it, vi } from 'vitest';
import { createAuditHistoryApi, parseAuditHistoryResponse } from './auditHistoryApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const item = {
  id: 'audit-1',
  resourceType: 'person' as const,
  resourceId: 'person-1',
  action: 'update' as const,
  actorId: 'actor-1',
  occurredAt: '2026-08-20T10:00:00.000Z',
  changedFields: ['displayName'],
};

describe('auditHistoryApi', () => {
  it('loads protected history using same-origin credentials and allowlisted filters only', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([item]));
    const api = createAuditHistoryApi(fetcher);

    await expect(api.list({
      resourceType: 'person',
      action: 'update',
      actorId: ' actor-1 ',
      resourceId: ' person-1 ',
      limit: 25,
    })).resolves.toEqual([item]);

    expect(fetcher).toHaveBeenCalledWith(
      '/api/audit/history?resourceType=person&resourceId=person-1&action=update&actorId=actor-1&limit=25',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it('rejects response fields that would widen the privacy boundary', () => {
    expect(() => parseAuditHistoryResponse([{ ...item, tenantId: 'tenant-a' }]))
      .toThrow('Invalid audit history API response');
    expect(() => parseAuditHistoryResponse([{ ...item, displayName: 'Private Person' }]))
      .toThrow('Invalid audit history API response');
  });

  it('rejects malformed enums, timestamps and changed fields', () => {
    expect(() => parseAuditHistoryResponse([{ ...item, resourceType: 'secret' }]))
      .toThrow('Invalid audit history API response');
    expect(() => parseAuditHistoryResponse([{ ...item, occurredAt: 'not-a-date' }]))
      .toThrow('Invalid audit history API response');
    expect(() => parseAuditHistoryResponse([{ ...item, changedFields: ['displayName', ''] }]))
      .toThrow('Invalid audit history API response');
  });

  it('rejects unsafe client limits before making a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = createAuditHistoryApi(fetcher);

    await expect(api.list({ limit: 0 })).rejects.toThrow('Invalid audit history limit');
    await expect(api.list({ limit: 201 })).rejects.toThrow('Invalid audit history limit');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('surfaces only the server-safe error field', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Forbidden', debug: 'private' }, 403));
    const api = createAuditHistoryApi(fetcher);
    await expect(api.list()).rejects.toThrow('Forbidden');
  });
});

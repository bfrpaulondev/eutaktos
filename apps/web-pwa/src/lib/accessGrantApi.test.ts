import { describe, expect, it, vi } from 'vitest';
import { createAccessGrantApi, parseAccessGrant } from './accessGrantApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const grant = {
  id: 'grant-1', subjectId: 'person-a', capability: 'people.read' as const,
  grantedAt: '2026-08-20T10:00:00.000Z',
};

describe('accessGrantApi', () => {
  it('lists grants using encoded subject ids and same-origin credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([grant]));
    const api = createAccessGrantApi(fetcher);

    await expect(api.list('person/a')).resolves.toEqual([grant]);
    expect(fetcher).toHaveBeenCalledWith('/api/access/subjects/person%2Fa/grants', expect.objectContaining({
      method: 'GET', credentials: 'same-origin',
    }));
  });

  it('sends only subjectId and capability when granting access', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(grant));
    const api = createAccessGrantApi(fetcher);

    await api.grant(' person-a ', 'people.read');
    const init = fetcher.mock.calls[0]?.[1];
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/access/grants');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual({ subjectId: 'person-a', capability: 'people.read' });
  });

  it('revokes with a bodyless DELETE and same-origin credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ...grant, revokedAt: '2026-08-20T11:00:00.000Z' }));
    const api = createAccessGrantApi(fetcher);

    await api.revoke('grant/1');
    expect(fetcher).toHaveBeenCalledWith('/api/access/grants/grant%2F1', expect.objectContaining({
      method: 'DELETE', credentials: 'same-origin',
    }));
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it('rejects widened DTOs and unsupported capabilities', () => {
    expect(() => parseAccessGrant({ ...grant, tenantId: 'tenant-a' })).toThrow('Invalid access grant API response');
    expect(() => parseAccessGrant({ ...grant, grantedBy: 'admin-a' })).toThrow('Invalid access grant API response');
    expect(() => parseAccessGrant({ ...grant, capability: 'root.all' })).toThrow('Invalid access grant API response');
  });

  it('validates identifiers and capabilities before network writes', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = createAccessGrantApi(fetcher);
    await expect(api.grant('   ', 'people.read')).rejects.toThrow('Invalid subjectId');
    await expect(api.grant('person-a', 'root.all' as never)).rejects.toThrow('Invalid capability');
    await expect(api.revoke('')).rejects.toThrow('Invalid grantId');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('surfaces server-safe errors only', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Forbidden', debug: 'private' }, 403));
    await expect(createAccessGrantApi(fetcher).list('person-a')).rejects.toThrow('Forbidden');
  });
});

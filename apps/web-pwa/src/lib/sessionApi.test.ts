import { describe, expect, it, vi } from 'vitest';
import { createSessionApi, parseCurrentSession } from './sessionApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

const session = {
  actorId: 'person-a',
  capabilities: ['audit.read', 'people.read'] as const,
};

describe('sessionApi', () => {
  it('loads the current session using same-origin credentials and no request body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(session));
    const api = createSessionApi(fetcher);

    await expect(api.current()).resolves.toEqual(session);
    expect(fetcher).toHaveBeenCalledWith('/api/session', expect.objectContaining({
      method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' },
    }));
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it('rejects widened identity/session responses instead of propagating tenant or private fields', () => {
    expect(() => parseCurrentSession({ ...session, tenantId: 'tenant-a' })).toThrow('Invalid session API response');
    expect(() => parseCurrentSession({ ...session, email: 'person@example.test' })).toThrow('Invalid session API response');
    expect(() => parseCurrentSession({ ...session, capabilities: ['people.read', 'root.all'] })).toThrow('Invalid session API response');
  });

  it('rejects duplicate capabilities and malformed actor identifiers', () => {
    expect(() => parseCurrentSession({ actorId: '', capabilities: [] })).toThrow('Invalid session API response');
    expect(() => parseCurrentSession({ actorId: 'person-a', capabilities: ['people.read', 'people.read'] })).toThrow('Invalid session API response');
    expect(() => parseCurrentSession({ actorId: 'person-a', capabilities: 'people.read' })).toThrow('Invalid session API response');
  });

  it('rotates the opaque session cookie with a bodyless same-origin mutation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(emptyResponse());
    await createSessionApi(fetcher).rotate();

    expect(fetcher).toHaveBeenCalledWith('/api/session/rotate', expect.objectContaining({
      method: 'POST', credentials: 'same-origin',
    }));
    expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it('supports current-session and all-session logout without sending tenant, actor or capabilities', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(emptyResponse());
    const api = createSessionApi(fetcher);

    await api.logout();
    await api.logoutAll();

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/session/logout', expect.objectContaining({
      method: 'POST', credentials: 'same-origin',
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/session/logout-all', expect.objectContaining({
      method: 'POST', credentials: 'same-origin',
    }));
    for (const [, init] of fetcher.mock.calls) expect(init).not.toHaveProperty('body');
  });

  it('uses bounded server messages only for client errors and hides server debug errors', async () => {
    const forbidden = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Forbidden', debug: 'private' }, 403));
    await expect(createSessionApi(forbidden).current()).rejects.toThrow('Forbidden');

    const failure = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'database connection detail' }, 500));
    await expect(createSessionApi(failure).current()).rejects.toThrow('Session request failed (500)');
  });

  it('fails closed when a successful current-session response is not JSON', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
    await expect(createSessionApi(fetcher).current()).rejects.toThrow('Invalid session API response');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createPeopleArchiveApi, parsePeopleArchiveState } from './peopleArchiveApi';

describe('peopleArchiveApi', () => {
  it('parses archived state without exposing actor identity', () => {
    expect(parsePeopleArchiveState({
      status: 'archived',
      current: { archivedAt: '2026-08-27T10:00:00.000Z', reason: 'Moved congregation' },
      history: [
        { action: 'archived', occurredAt: '2026-08-27T10:00:00.000Z', reason: 'Moved congregation' },
        { action: 'restored', occurredAt: '2026-08-27T10:05:00.000Z' },
        { action: 'archived', occurredAt: '2026-08-27T10:10:00.000Z', reason: 'Moved congregation' },
      ],
      capabilities: { write: true },
    })).toEqual({
      status: 'archived',
      current: { archivedAt: '2026-08-27T10:00:00.000Z', reason: 'Moved congregation' },
      history: [
        { action: 'archived', occurredAt: '2026-08-27T10:00:00.000Z', reason: 'Moved congregation' },
        { action: 'restored', occurredAt: '2026-08-27T10:05:00.000Z' },
        { action: 'archived', occurredAt: '2026-08-27T10:10:00.000Z', reason: 'Moved congregation' },
      ],
      capabilities: { write: true },
    });
  });

  it('rejects an active response that smuggles current archive data', () => {
    expect(() => parsePeopleArchiveState({ status: 'active', current: { archivedAt: '2026-08-27T10:00:00Z', reason: 'x' }, history: [], capabilities: { write: false } })).toThrow('Invalid People archive response');
  });

  it('uses same-origin no-store requests and only sends action/reason', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'active', history: [], capabilities: { write: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'archived', current: { archivedAt: '2026-08-27T10:00:00Z', reason: 'Administrative reason' }, history: [{ action: 'archived', occurredAt: '2026-08-27T10:00:00Z', reason: 'Administrative reason' }], capabilities: { write: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'active', history: [{ action: 'archived', occurredAt: '2026-08-27T10:00:00Z', reason: 'Administrative reason' }, { action: 'restored', occurredAt: '2026-08-27T10:05:00Z' }], capabilities: { write: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createPeopleArchiveApi(fetcher as unknown as typeof fetch);

    await api.get('person-1');
    await api.archive('person-1', 'Administrative reason');
    await api.restore('person-1');

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/people/person-1/archive', expect.objectContaining({ method: 'GET', credentials: 'same-origin', cache: 'no-store' }));
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/people/person-1/archive', expect.objectContaining({ method: 'POST', credentials: 'same-origin', cache: 'no-store', body: JSON.stringify({ action: 'archive', reason: 'Administrative reason' }) }));
    expect(fetcher).toHaveBeenNthCalledWith(3, '/api/people/person-1/archive', expect.objectContaining({ method: 'POST', credentials: 'same-origin', cache: 'no-store', body: JSON.stringify({ action: 'restore' }) }));
  });

  it('fails closed on invalid person identifiers', async () => {
    const fetcher = vi.fn();
    const api = createPeopleArchiveApi(fetcher as unknown as typeof fetch);
    await expect(api.get('../other')).rejects.toThrow('Invalid personId');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

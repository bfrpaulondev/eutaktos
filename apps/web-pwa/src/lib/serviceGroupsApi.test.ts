import { describe, expect, it, vi } from 'vitest';
import { createServiceGroupsApi, parseServiceGroupList } from './serviceGroupsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const sampleDto = { id: 'sg1', name: 'Midweek Group A', memberIds: ['p1', 'p2'], overseerId: 'p3' };

function sampleWithExtras(): Record<string, unknown> {
  return { ...sampleDto, assistantId: 'p4', tenantId: 'must-be-dropped', createdAt: '2026-01-01' };
}

describe('serviceGroupsApi', () => {
  it('parses a service group DTO and strips extra fields', () => {
    expect(parseServiceGroupList([sampleWithExtras()])).toEqual([
      { id: 'sg1', name: 'Midweek Group A', memberIds: ['p1', 'p2'], overseerId: 'p3', assistantId: 'p4' },
    ]);
  });

  it('rejects invalid DTO shapes', () => {
    expect(() => parseServiceGroupList([{ id: 'sg1', name: 'Group' }])).toThrow('Invalid Service Groups API response');
    expect(() => parseServiceGroupList([{ id: 'sg1', name: 123, memberIds: ['p1'] }])).toThrow('Invalid Service Groups API response');
    expect(() => parseServiceGroupList('not-array')).toThrow('Invalid Service Groups API response');
  });

  it('lists service groups via GET', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([sampleDto]));
    const api = createServiceGroupsApi(fetcher);

    await expect(api.list()).resolves.toEqual([sampleDto]);
    expect(fetcher).toHaveBeenCalledWith('/api/service-groups', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('creates a service group via POST', async () => {
    const input = { name: 'Midweek Group A', memberIds: ['p1', 'p2'], overseerId: 'p3' };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(sampleDto, 201));
    const api = createServiceGroupsApi(fetcher);

    await expect(api.create(input)).resolves.toEqual(sampleDto);
    expect(fetcher).toHaveBeenCalledWith('/api/service-groups', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify(input),
    }));
  });

  it('updates a service group via PUT with encoded id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ...sampleDto, name: 'Updated' }));
    const api = createServiceGroupsApi(fetcher);

    await expect(api.update('sg/1', { name: 'Updated' })).resolves.toMatchObject({ name: 'Updated' });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/service-groups/sg%2F1');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: 'PUT',
      credentials: 'same-origin',
      body: JSON.stringify({ name: 'Updated' }),
    }));
  });

  it('deletes a service group expecting 204 no content', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const api = createServiceGroupsApi(fetcher);

    await expect(api.delete('sg1')).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('/api/service-groups/sg1', expect.objectContaining({
      method: 'DELETE',
      credentials: 'same-origin',
    }));
  });

  it('surfaces safe API errors from error body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Conflict' }, 409));
    const api = createServiceGroupsApi(fetcher);

    await expect(api.list()).rejects.toThrow('Conflict');
  });

  it('rejects malformed response from the server', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ id: 'sg1', name: 'Group' }]));
    const api = createServiceGroupsApi(fetcher);

    await expect(api.list()).rejects.toThrow('Invalid Service Groups API response');
  });
});

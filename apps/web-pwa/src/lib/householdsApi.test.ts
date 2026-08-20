import { describe, expect, it, vi } from 'vitest';
import { createHouseholdsApi, parseHouseholdList } from './householdsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const sampleDto = { id: 'h1', name: 'Costa Family', memberIds: ['p1', 'p2'] };

describe('householdsApi', () => {
  it('parses a household DTO and strips extra fields', () => {
    expect(parseHouseholdList([{
      ...sampleDto,
      tenantId: 'must-be-dropped',
      createdAt: '2026-01-01',
    }])).toEqual([sampleDto]);
  });

  it('rejects invalid DTO shapes', () => {
    expect(() => parseHouseholdList([{ id: 'h1', name: 'Family' }])).toThrow('Invalid Households API response');
    expect(() => parseHouseholdList([{ id: 'h1', name: 123, memberIds: ['p1'] }])).toThrow('Invalid Households API response');
    expect(() => parseHouseholdList('not-array')).toThrow('Invalid Households API response');
  });

  it('lists households via GET', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([sampleDto]));
    const api = createHouseholdsApi(fetcher);

    await expect(api.list()).resolves.toEqual([sampleDto]);
    expect(fetcher).toHaveBeenCalledWith('/api/households', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('creates a household via POST', async () => {
    const input = { name: 'Costa Family', memberIds: ['p1', 'p2'] };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(sampleDto, 201));
    const api = createHouseholdsApi(fetcher);

    await expect(api.create(input)).resolves.toEqual(sampleDto);
    expect(fetcher).toHaveBeenCalledWith('/api/households', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify(input),
    }));
  });

  it('updates a household via PUT with encoded id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ...sampleDto, name: 'Updated' }));
    const api = createHouseholdsApi(fetcher);

    await expect(api.update('h/1', { name: 'Updated' })).resolves.toMatchObject({ name: 'Updated' });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/households/h%2F1');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: 'PUT',
      credentials: 'same-origin',
      body: JSON.stringify({ name: 'Updated' }),
    }));
  });

  it('deletes a household expecting 204 no content', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const api = createHouseholdsApi(fetcher);

    await expect(api.delete('h1')).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('/api/households/h1', expect.objectContaining({
      method: 'DELETE',
      credentials: 'same-origin',
    }));
  });

  it('surfaces safe API errors from error body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403));
    const api = createHouseholdsApi(fetcher);

    await expect(api.list()).rejects.toThrow('Forbidden');
  });

  it('rejects malformed response from the server', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ id: 'h1', name: 'Family' }]));
    const api = createHouseholdsApi(fetcher);

    await expect(api.list()).rejects.toThrow('Invalid Households API response');
  });
});

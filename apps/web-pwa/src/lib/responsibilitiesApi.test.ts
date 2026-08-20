import { describe, expect, it, vi } from 'vitest';
import { createResponsibilitiesApi, parseResponsibilityList } from './responsibilitiesApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const sampleDto = { id: 'r1', personId: 'p1', responsibilityKey: 'elder', startsAt: '2026-01-01T00:00:00.000Z' };

const sampleDtoWithEnd = { ...sampleDto, endsAt: '2026-06-01T00:00:00.000Z' };

describe('responsibilitiesApi', () => {
  it('parses a responsibility DTO and strips extra fields', () => {
    expect(parseResponsibilityList([{
      ...sampleDtoWithEnd,
      tenantId: 'must-be-dropped',
      assignedBy: 'must-be-dropped',
    }])).toEqual([sampleDtoWithEnd]);
  });

  it('rejects invalid DTO shapes', () => {
    expect(() => parseResponsibilityList([{ id: 'r1', personId: 'p1' }])).toThrow('Invalid Responsibilities API response');
    expect(() => parseResponsibilityList([{ id: 'r1', personId: 'p1', responsibilityKey: 'elder', startsAt: 123 }])).toThrow('Invalid Responsibilities API response');
    expect(() => parseResponsibilityList('not-array')).toThrow('Invalid Responsibilities API response');
  });

  it('lists responsibilities via GET', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([sampleDto]));
    const api = createResponsibilitiesApi(fetcher);

    await expect(api.list()).resolves.toEqual([sampleDto]);
    expect(fetcher).toHaveBeenCalledWith('/api/responsibilities', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('assigns a responsibility via POST', async () => {
    const input = { personId: 'p1', responsibilityKey: 'elder', startsAt: '2026-01-01T00:00:00.000Z' };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(sampleDto, 201));
    const api = createResponsibilitiesApi(fetcher);

    await expect(api.assign(input)).resolves.toEqual(sampleDto);
    expect(fetcher).toHaveBeenCalledWith('/api/responsibilities', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify(input),
    }));
  });

  it('ends a responsibility via PUT with encoded id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(sampleDtoWithEnd));
    const api = createResponsibilitiesApi(fetcher);
    const endInput = { endsAt: '2026-06-01T00:00:00.000Z' };

    await expect(api.end('r/1', endInput)).resolves.toEqual(sampleDtoWithEnd);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/responsibilities/r%2F1/end');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: 'PUT',
      credentials: 'same-origin',
      body: JSON.stringify(endInput),
    }));
  });

  it('surfaces safe API errors from error body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Not Found' }, 404));
    const api = createResponsibilitiesApi(fetcher);

    await expect(api.list()).rejects.toThrow('Not Found');
  });

  it('gets a single responsibility with encoded id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(sampleDtoWithEnd));
    const api = createResponsibilitiesApi(fetcher);

    await expect(api.get('r/1')).resolves.toEqual(sampleDtoWithEnd);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/responsibilities/r%2F1');
    expect(fetcher.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('rejects malformed response from the server', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ id: 'r1', personId: 'p1', responsibilityKey: 'elder' }]));
    const api = createResponsibilitiesApi(fetcher);

    await expect(api.list()).rejects.toThrow('Invalid Responsibilities API response');
  });
});

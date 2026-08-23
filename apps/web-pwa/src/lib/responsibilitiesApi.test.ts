import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResponsibilitiesApi } from './responsibilitiesApi';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => vi.useRealTimers());

describe('responsibilitiesApi', () => {
  it('normalizes date-only assignment fields to ISO instants', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        personId: 'person-1',
        responsibilityKey: 'sound',
        startsAt: '2026-08-23T00:00:00.000Z',
        endsAt: '2026-08-31T23:59:59.999Z',
      });
      return json({
        id: 'responsibility-1', personId: 'person-1', responsibilityKey: 'sound',
        startsAt: '2026-08-23T00:00:00.000Z', endsAt: '2026-08-31T23:59:59.999Z',
      }, 201);
    });
    await createResponsibilitiesApi(fetcher).assign({
      personId: 'person-1', responsibilityKey: 'sound', startsAt: '2026-08-23', endsAt: '2026-08-31',
    });
  });

  it('ends a date-only responsibility at the actual click instant', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T15:45:12.000Z'));
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({ endsAt: '2026-08-23T15:45:12.000Z' });
      return json({
        id: 'responsibility-1', personId: 'person-1', responsibilityKey: 'sound',
        startsAt: '2026-08-23T00:00:00.000Z', endsAt: '2026-08-23T15:45:12.000Z',
      });
    });
    await createResponsibilitiesApi(fetcher).end('responsibility-1', { endsAt: '2026-08-23' });
  });
});

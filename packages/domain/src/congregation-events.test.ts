import { describe, it, expect } from 'vitest';
import { createCongregationEvent, assertCongregationEventTenant, normalizeCongregationEvent } from './congregation-events';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make(overrides?: Partial<Parameters<typeof createCongregationEvent>[0]>) {
  return createCongregationEvent({
    id: 'ce-1', tenantId: T, title: 'Picnic', description: 'Congregation picnic',
    startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T16:00:00Z',
    location: 'Park', now: NOW, ...overrides,
  });
}

describe('createCongregationEvent', () => {
  it('creates valid', () => { const e = make(); expect(e.title).toBe('Picnic'); expect(e.url).toBeNull(); expect(Object.isFrozen(e)).toBe(true); });
  it('throws on endsAt before startsAt', () => { expect(() => make({ endsAt: '2026-09-01T09:00:00Z' })).toThrow('endsAt must be after'); });
  it('throws on title too long', () => { expect(() => make({ title: 'x'.repeat(301) })).toThrow('title is too long'); });
  it('throws on description too long', () => { expect(() => make({ description: 'x'.repeat(5001) })).toThrow('description is too long'); });
  it('accepts valid URL', () => { expect(make({ url: 'https://example.com' }).url).toBe('https://example.com'); });
  it('rejects invalid URL', () => { expect(() => make({ url: 'ftp://bad.com' })).toThrow('Invalid URL'); });
  it('accepts visibilityFrom', () => { expect(make({ visibilityFrom: '2026-08-25T00:00:00Z' }).visibilityFrom).toBe('2026-08-25T00:00:00Z'); });
  it('rejects invalid visibilityFrom', () => { expect(() => make({ visibilityFrom: 'bad' })).toThrow('Invalid ISO date'); });
});

describe('tenant isolation', () => {
  it('assertCongregationEventTenant', () => { expect(() => assertCongregationEventTenant(make(), T)).not.toThrow(); expect(() => assertCongregationEventTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeCongregationEvent', () => {
  it('normalizes valid', () => { expect(normalizeCongregationEvent(make()).id).toBe('ce-1'); });
  it('throws on invalid URL', () => { expect(() => normalizeCongregationEvent({ ...make(), url: 'bad' } as any)).toThrow('Invalid URL'); });
});

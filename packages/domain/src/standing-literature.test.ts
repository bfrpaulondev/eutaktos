import { describe, it, expect } from 'vitest';
import {
  createStandingRequest, isStandingRequestActive, deactivateStandingRequest,
  assertStandingRequestTenant, normalizeStandingRequest,
} from './standing-literature';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make(overrides?: Partial<Parameters<typeof createStandingRequest>[0]>) {
  return createStandingRequest({
    id: 'sr-1', tenantId: T, itemCode: 'bm', quantity: 10,
    effectiveFrom: '2026-08-01T00:00:00Z', effectiveUntil: '2026-12-31T23:59:59Z',
    requesterId: 'p1', now: NOW, ...overrides,
  });
}

describe('createStandingRequest', () => {
  it('creates active', () => { const r = make(); expect(r.active).toBe(true); expect(Object.isFrozen(r)).toBe(true); });
  it('throws on invalid interval', () => { expect(() => make({ effectiveUntil: '2026-07-01T00:00:00Z' })).toThrow('effectiveUntil must be after'); });
  it('allows null effectiveUntil', () => { expect(make({ effectiveUntil: null }).effectiveUntil).toBeNull(); });
  it('throws on bad quantity', () => { expect(() => make({ quantity: 0 })).toThrow('quantity must be'); });
});

describe('isStandingRequestActive', () => {
  it('active within window', () => { expect(isStandingRequestActive(make(), '2026-09-01T12:00:00Z')).toBe(true); });
  it('before effectiveFrom', () => { expect(isStandingRequestActive(make(), '2026-07-01T12:00:00Z')).toBe(false); });
  it('after effectiveUntil', () => { expect(isStandingRequestActive(make(), '2027-01-01T00:00:00Z')).toBe(false); });
  it('inactive', () => { expect(isStandingRequestActive(deactivateStandingRequest(make()), '2026-09-01T12:00:00Z')).toBe(false); });
  it('null effectiveUntil', () => { expect(isStandingRequestActive(make({ effectiveUntil: null }), '2030-01-01T00:00:00Z')).toBe(true); });
});

describe('tenant isolation', () => {
  it('assertStandingRequestTenant', () => { expect(() => assertStandingRequestTenant(make(), T)).not.toThrow(); expect(() => assertStandingRequestTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeStandingRequest', () => {
  it('normalizes valid', () => { expect(normalizeStandingRequest(make()).id).toBe('sr-1'); });
});

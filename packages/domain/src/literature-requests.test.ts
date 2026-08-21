import { describe, it, expect } from 'vitest';
import { createLiteratureRequest, transitionLiteratureRequest, assertLiteratureRequestTenant, normalizeLiteratureRequest } from './literature-requests';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make(overrides?: Partial<Parameters<typeof createLiteratureRequest>[0]>) {
  return createLiteratureRequest({ id: 'lr-1', tenantId: T, requesterId: 'p1', itemCode: 'bm', itemDescription: 'Bible Teach book', quantity: 5, now: NOW, ...overrides });
}

describe('createLiteratureRequest', () => {
  it('creates pending', () => { const r = make(); expect(r.status).toBe('pending'); expect(Object.isFrozen(r)).toBe(true); });
  it('throws on invalid quantity', () => { expect(() => make({ quantity: 0 })).toThrow('quantity must be'); expect(() => make({ quantity: 10000 })).toThrow('quantity must be'); });
  it('throws on description too long', () => { expect(() => make({ itemDescription: 'x'.repeat(501) })).toThrow('itemDescription too long'); });
  it('throws on empty itemCode', () => { expect(() => make({ itemCode: '' })).toThrow('itemCode is required'); });
});

describe('transitionLiteratureRequest', () => {
  it('pending → approved', () => { expect(transitionLiteratureRequest(make(), 'approved').status).toBe('approved'); });
  it('approved → fulfilled', () => { let r = make(); r = transitionLiteratureRequest(r, 'approved'); expect(transitionLiteratureRequest(r, 'fulfilled').status).toBe('fulfilled'); });
  it('pending → cancelled', () => { expect(transitionLiteratureRequest(make(), 'cancelled').status).toBe('cancelled'); });
  it('rejects invalid', () => { expect(() => transitionLiteratureRequest(make(), 'fulfilled')).toThrow('Invalid transition'); });
  it('fulfilled is terminal', () => { let r = make(); r = transitionLiteratureRequest(r, 'approved'); r = transitionLiteratureRequest(r, 'fulfilled'); expect(() => transitionLiteratureRequest(r, 'cancelled')).toThrow('Invalid transition'); });
});

describe('tenant isolation', () => {
  it('assertLiteratureRequestTenant', () => { expect(() => assertLiteratureRequestTenant(make(), T)).not.toThrow(); expect(() => assertLiteratureRequestTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeLiteratureRequest', () => {
  it('normalizes valid', () => { expect(normalizeLiteratureRequest(make()).id).toBe('lr-1'); });
  it('throws on invalid status', () => { expect(() => normalizeLiteratureRequest({ ...make(), status: 'x' } as any)).toThrow('Invalid status'); });
});

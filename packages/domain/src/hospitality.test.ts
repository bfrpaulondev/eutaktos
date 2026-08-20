import { describe, it, expect } from 'vitest';
import {
  createHospitalityRequest, transitionHospitalityStatus, assignHosts,
  assertHospitalityTenant, normalizeHospitalityRequest,
} from './hospitality';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make(overrides?: Partial<Parameters<typeof createHospitalityRequest>[0]>) {
  return createHospitalityRequest({
    id: 'hr-1', tenantId: T, meetingReference: 'mtg-1',
    date: '2026-09-01T10:00:00Z', requestedCapacity: 4, now: NOW, ...overrides,
  });
}

describe('createHospitalityRequest', () => {
  it('creates pending', () => { const r = make(); expect(r.status).toBe('pending'); expect(r.assignedHostReferences).toEqual([]); expect(Object.isFrozen(r)).toBe(true); });
  it('throws on invalid capacity', () => { expect(() => make({ requestedCapacity: 0 })).toThrow('requestedCapacity must be'); });
  it('accepts eventReference', () => { expect(make({ eventReference: 'evt-1' }).eventReference).toBe('evt-1'); });
});

describe('transitionHospitalityStatus', () => {
  it('pending → assigned', () => { expect(transitionHospitalityStatus(make(), 'assigned').status).toBe('assigned'); });
  it('assigned → fulfilled', () => { let r = make(); r = transitionHospitalityStatus(r, 'assigned'); expect(transitionHospitalityStatus(r, 'fulfilled').status).toBe('fulfilled'); });
  it('pending → cancelled', () => { expect(transitionHospitalityStatus(make(), 'cancelled').status).toBe('cancelled'); });
  it('rejects invalid', () => { expect(() => transitionHospitalityStatus(make(), 'fulfilled')).toThrow('Invalid transition'); });
});

describe('assignHosts', () => {
  it('assigns hosts', () => { const r = assignHosts(make(), ['h1', 'h2']); expect(r.assignedHostReferences).toEqual(['h1', 'h2']); expect(r.status).toBe('assigned'); });
  it('throws on empty', () => { expect(() => assignHosts(make(), [])).toThrow('At least one host'); });
  it('throws on fulfilled', () => { let r = make(); r = transitionHospitalityStatus(r, 'assigned'); r = transitionHospitalityStatus(r, 'fulfilled'); expect(() => assignHosts(r, ['h1'])).toThrow('Can only assign'); });
});

describe('tenant isolation', () => {
  it('assertHospitalityTenant', () => { expect(() => assertHospitalityTenant(make(), T)).not.toThrow(); expect(() => assertHospitalityTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeHospitalityRequest', () => {
  it('normalizes valid', () => { expect(normalizeHospitalityRequest(make()).id).toBe('hr-1'); });
  it('throws on invalid status', () => { expect(() => normalizeHospitalityRequest({ ...make(), status: 'x' } as any)).toThrow('Invalid status'); });
});

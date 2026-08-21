import { describe, it, expect } from 'vitest';
import {
  createGroundsSchedule, isGroundsScheduleValid, setGroundsActive,
  assertGroundsTenant, normalizeGroundsSchedule,
} from './grounds';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make(overrides?: Partial<Parameters<typeof createGroundsSchedule>[0]>) {
  return createGroundsSchedule({
    id: 'g1', tenantId: T, area: 'Front lawn', scheduleReference: 's1',
    assigneeReferences: ['p1'], validFrom: '2026-08-01T00:00:00Z', validUntil: '2026-12-31T23:59:59Z',
    now: NOW, ...overrides,
  });
}

describe('createGroundsSchedule', () => {
  it('creates valid schedule', () => { const g = make(); expect(g.area).toBe('Front lawn'); expect(g.active).toBe(true); expect(Object.isFrozen(g)).toBe(true); });
  it('throws on empty assignees', () => { expect(() => make({ assigneeReferences: [] })).toThrow('At least one'); });
  it('throws on area too long', () => { expect(() => make({ area: 'x'.repeat(201) })).toThrow('area is too long'); });
  it('allows null validUntil', () => { expect(make({ validUntil: null }).validUntil).toBeNull(); });
  it('throws on invalid date', () => { expect(() => make({ validFrom: 'bad' })).toThrow('Invalid ISO date'); });
});

describe('isGroundsScheduleValid', () => {
  it('valid within window', () => { expect(isGroundsScheduleValid(make(), '2026-09-01T12:00:00Z')).toBe(true); });
  it('before validFrom', () => { expect(isGroundsScheduleValid(make(), '2026-07-01T12:00:00Z')).toBe(false); });
  it('after validUntil', () => { expect(isGroundsScheduleValid(make(), '2027-01-01T00:00:00Z')).toBe(false); });
  it('inactive is invalid', () => { expect(isGroundsScheduleValid(setGroundsActive(make(), false), '2026-09-01T12:00:00Z')).toBe(false); });
  it('no validUntil = valid forever from validFrom', () => { expect(isGroundsScheduleValid(make({ validUntil: null }), '2030-01-01T00:00:00Z')).toBe(true); });
});

describe('tenant isolation', () => {
  it('assertGroundsTenant', () => { expect(() => assertGroundsTenant(make(), T)).not.toThrow(); expect(() => assertGroundsTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeGroundsSchedule', () => {
  it('normalizes valid', () => { expect(normalizeGroundsSchedule(make()).id).toBe('g1'); });
});

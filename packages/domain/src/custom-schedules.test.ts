import { describe, it, expect } from 'vitest';
import {
  createCustomSchedule, orderScheduleSlots, assertCustomScheduleTenant,
  normalizeCustomSchedule,
} from './custom-schedules';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

const SLOT_1 = { date: '2026-03-14', startsAt: '2026-03-14T19:00:00Z', endsAt: '2026-03-14T21:00:00Z', locationReference: 'kh-1' };
const SLOT_2 = { date: '2026-03-14', startsAt: '2026-03-14T15:00:00Z', endsAt: '2026-03-14T17:00:00Z', locationReference: null };
const SLOT_3 = { date: '2026-04-01', startsAt: '2026-04-01T19:00:00Z', endsAt: '2026-04-01T21:00:00Z', locationReference: 'kh-2' };

function make(overrides?: Partial<Parameters<typeof createCustomSchedule>[0]>) {
  return createCustomSchedule({
    id: 'cs-1', tenantId: T, scheduleType: 'memorial', name: 'Memorial 2026',
    slots: [SLOT_1], now: NOW, ...overrides,
  });
}

describe('createCustomSchedule', () => {
  it('creates valid', () => { const s = make(); expect(s.scheduleType).toBe('memorial'); expect(Object.isFrozen(s)).toBe(true); expect(Object.isFrozen(s.slots)).toBe(true); });
  it('rejects invalid type', () => { expect(() => make({ scheduleType: 'other' as any })).toThrow('Invalid scheduleType'); });
  it('rejects empty slots', () => { expect(() => make({ slots: [] })).toThrow('At least one slot'); });
  it('rejects invalid slot', () => { expect(() => make({ slots: [{ date: '2026-03-14', startsAt: '2026-03-14T19:00:00Z', endsAt: '2026-03-14T18:00:00Z', locationReference: null }] })).toThrow('endsAt must be after'); });
  it('rejects blank locationReference', () => { expect(() => make({ slots: [{ date: '2026-03-14', startsAt: '2026-03-14T19:00:00Z', endsAt: '2026-03-14T21:00:00Z', locationReference: '  ' }] })).toThrow('locationReference must not be blank'); });
});

describe('orderScheduleSlots', () => {
  it('sorts by date then startsAt', () => {
    const s = make({ slots: [SLOT_1, SLOT_2, SLOT_3] });
    const ordered = orderScheduleSlots(s);
    expect(ordered.map(sl => sl.date + sl.startsAt)).toEqual([
      '2026-03-142026-03-14T15:00:00Z',
      '2026-03-142026-03-14T19:00:00Z',
      '2026-04-012026-04-01T19:00:00Z',
    ]);
  });
});

describe('tenant isolation', () => {
  it('assertCustomScheduleTenant', () => { expect(() => assertCustomScheduleTenant(make(), T)).not.toThrow(); expect(() => assertCustomScheduleTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeCustomSchedule', () => {
  it('normalizes valid', () => { expect(normalizeCustomSchedule(make()).id).toBe('cs-1'); });
  it('throws on invalid type', () => { expect(() => normalizeCustomSchedule({ ...make(), scheduleType: 'x' } as any)).toThrow('Invalid scheduleType'); });
});

import { describe, it, expect } from 'vitest';
import {
  createCleaningArrangement, setCleaningActive, updateCleaningAssignees,
  assertCleaningTenant, normalizeCleaningArrangement, CLEANING_TYPES,
} from './cleaning';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make() {
  return createCleaningArrangement({ id: 'c1', tenantId: T, scheduleReference: 'sched-1', assigneeReferences: ['p1', 'p2'], type: 'weekly', now: NOW });
}

describe('createCleaningArrangement', () => {
  it('creates with defaults', () => { const c = make(); expect(c.active).toBe(true); expect(c.type).toBe('weekly'); expect(Object.isFrozen(c)).toBe(true); expect(Object.isFrozen(c.assigneeReferences)).toBe(true); });
  it('throws on empty assignees', () => { expect(() => createCleaningArrangement({ id: 'c1', tenantId: T, scheduleReference: 's', assigneeReferences: [], type: 'weekly', now: NOW })).toThrow('At least one'); });
  it('throws on invalid type', () => { expect(() => createCleaningArrangement({ id: 'c1', tenantId: T, scheduleReference: 's', assigneeReferences: ['p1'], type: 'deep' as any, now: NOW })).toThrow('Invalid cleaning type'); });
  it('supports all types', () => {
    for (const t of CLEANING_TYPES) {
      expect(() => createCleaningArrangement({ id: 'c', tenantId: T, scheduleReference: 's', assigneeReferences: ['p1'], type: t, now: NOW })).not.toThrow();
    }
  });
});

describe('setCleaningActive', () => {
  it('toggles active', () => { expect(setCleaningActive(make(), false).active).toBe(false); });
  it('is idempotent', () => { const c = make(); const r = setCleaningActive(c, true); expect(r.active).toBe(true); expect(r.id).toBe('c1'); });
});

describe('updateCleaningAssignees', () => {
  it('updates assignees', () => { const c = updateCleaningAssignees(make(), ['p3']); expect(c.assigneeReferences).toEqual(['p3']); });
  it('throws on empty', () => { expect(() => updateCleaningAssignees(make(), [])).toThrow('At least one'); });
});

describe('tenant isolation', () => {
  it('assertCleaningTenant', () => { expect(() => assertCleaningTenant(make(), T)).not.toThrow(); expect(() => assertCleaningTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeCleaningArrangement', () => {
  it('normalizes valid', () => { expect(normalizeCleaningArrangement(make()).id).toBe('c1'); });
  it('throws on invalid', () => { expect(() => normalizeCleaningArrangement({ ...make(), type: 'x' } as any)).toThrow('Invalid cleaning type'); });
});

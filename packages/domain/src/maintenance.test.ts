import { describe, it, expect } from 'vitest';
import {
  createMaintenanceTask, transitionMaintenanceStatus, assertMaintenanceTenant,
  normalizeMaintenanceTask, MAINTENANCE_CATEGORIES, MAINTENANCE_PRIORITIES,
} from './maintenance';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make(overrides?: Partial<Parameters<typeof createMaintenanceTask>[0]>) {
  return createMaintenanceTask({ id: 'm1', tenantId: T, category: 'building', title: 'Fix roof', dueAt: '2026-09-01T00:00:00Z', priority: 'high', now: NOW, ...overrides });
}

describe('createMaintenanceTask', () => {
  it('creates with defaults', () => { const t = make(); expect(t.status).toBe('open'); expect(t.completedAt).toBeNull(); expect(Object.isFrozen(t)).toBe(true); });
  it('throws on invalid category', () => { expect(() => make({ category: 'x' as any })).toThrow('Invalid category'); });
  it('throws on invalid priority', () => { expect(() => make({ priority: 'x' as any })).toThrow('Invalid priority'); });
  it('throws on title too long', () => { expect(() => make({ title: 'x'.repeat(501) })).toThrow('title is too long'); });
  it('allows null dueAt', () => { expect(make({ dueAt: null }).dueAt).toBeNull(); });
  it('accepts all categories', () => { for (const c of MAINTENANCE_CATEGORIES) expect(() => make({ category: c })).not.toThrow(); });
  it('accepts all priorities', () => { for (const p of MAINTENANCE_PRIORITIES) expect(() => make({ priority: p })).not.toThrow(); });
});

describe('transitionMaintenanceStatus', () => {
  it('open → in_progress', () => { expect(transitionMaintenanceStatus(make(), 'in_progress', NOW).status).toBe('in_progress'); });
  it('open → cancelled', () => { expect(transitionMaintenanceStatus(make(), 'cancelled', NOW).status).toBe('cancelled'); });
  it('in_progress → completed', () => { let t = make(); t = transitionMaintenanceStatus(t, 'in_progress', NOW); const c = transitionMaintenanceStatus(t, 'completed', '2026-08-22T10:00:00Z'); expect(c.status).toBe('completed'); expect(c.completedAt).toBe('2026-08-22T10:00:00Z'); });
  it('rejects invalid', () => { expect(() => transitionMaintenanceStatus(make(), 'completed', NOW)).toThrow('Invalid transition'); });
  it('completed is terminal', () => { let t = make(); t = transitionMaintenanceStatus(t, 'in_progress', NOW); t = transitionMaintenanceStatus(t, 'completed', NOW); expect(() => transitionMaintenanceStatus(t, 'open', NOW)).toThrow('Invalid transition'); });
});

describe('tenant isolation', () => {
  it('assertMaintenanceTenant', () => { expect(() => assertMaintenanceTenant(make(), T)).not.toThrow(); expect(() => assertMaintenanceTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeMaintenanceTask', () => {
  it('normalizes valid', () => { expect(normalizeMaintenanceTask(make()).id).toBe('m1'); });
  it('throws on invalid status', () => { expect(() => normalizeMaintenanceTask({ ...make(), status: 'x' } as any)).toThrow('Invalid status'); });
});

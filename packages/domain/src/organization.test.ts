import { describe, expect, it } from 'vitest';
import {
  assertSameTenant,
  createHousehold,
  createServiceGroup,
  isResponsibilityActiveAt,
  validateResponsibilityAssignment,
} from './organization';

describe('organization domain', () => {
  it('normalizes households and rejects duplicate membership', () => {
    expect(createHousehold({
      id: 'h-1', tenantId: 't-1', name: '  Família   Silva ', memberIds: ['p-1', 'p-2'],
    }).name).toBe('Família Silva');

    expect(() => createHousehold({
      id: 'h-1', tenantId: 't-1', name: 'Silva', memberIds: ['p-1', 'p-1'],
    })).toThrow(/Duplicate/);
  });

  it('requires service-group leaders to be members and distinct', () => {
    expect(() => createServiceGroup({
      id: 'g-1', tenantId: 't-1', name: 'Grupo 1', memberIds: ['p-1'], overseerId: 'p-2',
    })).toThrow(/leaders/);

    expect(() => createServiceGroup({
      id: 'g-1', tenantId: 't-1', name: 'Grupo 1', memberIds: ['p-1'], overseerId: 'p-1', assistantId: 'p-1',
    })).toThrow(/different/);
  });

  it('validates responsibility history and active boundaries', () => {
    const assignment = validateResponsibilityAssignment({
      id: 'r-1', tenantId: 't-1', personId: 'p-1', responsibilityKey: 'sound',
      startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-09-01T00:00:00Z',
      assignedBy: 'p-9', assignedAt: '2026-07-20T12:00:00Z',
    });

    expect(isResponsibilityActiveAt(assignment, '2026-08-31T23:59:59Z')).toBe(true);
    expect(isResponsibilityActiveAt(assignment, '2026-09-01T00:00:00Z')).toBe(false);

    expect(() => validateResponsibilityAssignment({
      ...assignment, assignedAt: '2026-08-02T00:00:00Z',
    })).toThrow(/assigned after/);
  });

  it('rejects cross-tenant organization reads', () => {
    expect(() => assertSameTenant('t-1',
      { tenantId: 't-1' },
      { tenantId: 't-2' },
    )).toThrow(/Cross-tenant/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  assertDutyAssignmentTenant,
  cancelDutyAssignment,
  createDutyAssignment,
  createDutyDefinition,
  dutyAssignmentsForTenant,
  replaceDutyAssignment,
} from './duty-assignment';

const now = '2026-08-22T10:00:00.000Z';
function assignment(tenantId = 'tenant-a') {
  return createDutyAssignment({ id: 'duty-1', tenantId, definitionId: 'sound', personId: 'person-1', startsAt: '2026-08-23T09:00:00.000Z', endsAt: '2026-08-23T10:00:00.000Z', assignedAt: now });
}

describe('DutyAssignment', () => {
  it('creates tenant-scoped custom definitions and assignments', () => {
    expect(createDutyDefinition({ id: 'sound', tenantId: 'tenant-a', key: 'sound', label: 'Sound' })).toMatchObject({ tenantId: 'tenant-a', key: 'sound' });
    expect(assignment()).toMatchObject({ tenantId: 'tenant-a', state: 'assigned', cancelledAt: null });
  });
  it('rejects invalid or inverted windows without coercion', () => {
    expect(() => createDutyAssignment({ id: 'x', tenantId: 'tenant-a', definitionId: 'sound', personId: 'p', startsAt: 'bad', endsAt: '2026-08-23T10:00:00.000Z', assignedAt: now })).toThrow('startsAt');
    expect(() => createDutyAssignment({ id: 'x', tenantId: 'tenant-a', definitionId: 'sound', personId: 'p', startsAt: '2026-08-23T10:00:00.000Z', endsAt: '2026-08-23T09:00:00.000Z', assignedAt: now })).toThrow('Duty must end');
  });
  it('cancels and replaces only assigned duties', () => {
    const cancelled = cancelDutyAssignment(assignment(), now);
    expect(cancelled.state).toBe('cancelled');
    expect(() => cancelDutyAssignment(cancelled, now)).toThrow('Invalid duty transition');
    expect(replaceDutyAssignment(assignment(), 'person-2', now)).toMatchObject({ personId: 'person-2', state: 'assigned' });
  });
  it('filters and asserts tenant boundaries even when identifiers coincide', () => {
    const own = assignment('tenant-a'); const foreign = assignment('tenant-b');
    expect(dutyAssignmentsForTenant([own, foreign], 'tenant-a')).toEqual([own]);
    expect(() => assertDutyAssignmentTenant(foreign, 'tenant-a')).toThrow('Cross-tenant');
  });
});

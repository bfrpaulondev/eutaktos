import { describe, expect, it } from 'vitest';
import {
  assertAssignmentReminderTenant,
  createAssignmentReminderRecord,
  latestAssignmentReminder,
} from './assignment-reminder';

describe('assignment reminder ledger', () => {
  it('normalizes and freezes a reminder correlation without PII payload values', () => {
    const record = createAssignmentReminderRecord({
      id: 'delivery-1',
      tenantId: 'tenant-a',
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      deliveryId: 'delivery-1',
      queuedAt: '2026-08-27T06:00:00.000Z',
    });

    expect(record).toEqual({
      id: 'delivery-1',
      tenantId: 'tenant-a',
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      deliveryId: 'delivery-1',
      queuedAt: '2026-08-27T06:00:00.000Z',
    });
    expect(Object.isFrozen(record)).toBe(true);
  });

  it('returns only the latest reminder for the exact tenant, assignment and recipient', () => {
    const records = [
      createAssignmentReminderRecord({ id: 'd1', tenantId: 'tenant-a', assignmentId: 'a1', recipientId: 'p1', deliveryId: 'd1', queuedAt: '2026-08-27T05:00:00.000Z' }),
      createAssignmentReminderRecord({ id: 'd2', tenantId: 'tenant-a', assignmentId: 'a1', recipientId: 'p1', deliveryId: 'd2', queuedAt: '2026-08-27T06:00:00.000Z' }),
      createAssignmentReminderRecord({ id: 'd3', tenantId: 'tenant-b', assignmentId: 'a1', recipientId: 'p1', deliveryId: 'd3', queuedAt: '2026-08-27T07:00:00.000Z' }),
      createAssignmentReminderRecord({ id: 'd4', tenantId: 'tenant-a', assignmentId: 'a2', recipientId: 'p1', deliveryId: 'd4', queuedAt: '2026-08-27T08:00:00.000Z' }),
    ];

    expect(latestAssignmentReminder(records, 'tenant-a', 'a1', 'p1')?.id).toBe('d2');
    expect(latestAssignmentReminder(records, 'tenant-a', 'missing', 'p1')).toBeUndefined();
  });

  it('fails closed for cross-tenant access and invalid timestamps', () => {
    const record = createAssignmentReminderRecord({ id: 'd1', tenantId: 'tenant-a', assignmentId: 'a1', recipientId: 'p1', deliveryId: 'd1', queuedAt: '2026-08-27T06:00:00.000Z' });
    expect(() => assertAssignmentReminderTenant(record, 'tenant-b')).toThrow('Cross-tenant');
    expect(() => createAssignmentReminderRecord({ ...record, id: 'd2', deliveryId: 'd2', queuedAt: 'invalid' })).toThrow('valid ISO instant');
  });
});

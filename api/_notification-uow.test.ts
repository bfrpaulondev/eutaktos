import { describe, expect, it, vi } from 'vitest';
import { NotificationIntentService } from '@eutaktos/application';
import {
  createAccessContext,
  createDeliveryAttempt,
  createNotificationPreferences,
} from '@eutaktos/domain';
import type { EntityRow } from './_db';
import { SupabaseRestDatabase } from './_db';
import { NotificationIntentSnapshotUnitOfWork } from './_notification-uow';

function row(entityType: string, entityId: string, data: unknown): EntityRow {
  return { tenant_id: 'tenant-a', entity_type: entityType, entity_id: entityId, data, version: 1 };
}

function runtime() {
  let delivery = 0;
  let audit = 0;
  let event = 0;
  return {
    now: () => '2026-08-27T08:30:00.000Z',
    nextId(scope: 'delivery' | 'audit' | 'event') {
      if (scope === 'delivery') return `delivery-${++delivery}`;
      if (scope === 'audit') return `audit-${++audit}`;
      return `event-${++event}`;
    },
  };
}

const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-1', capabilities: ['schedule.write'] });
const preference = createNotificationPreferences({ id: 'prefs-1', tenantId: 'tenant-a', personId: 'person-1', now: '2026-08-27T08:00:00.000Z' });

describe('NotificationIntentSnapshotUnitOfWork', () => {
  it('loads tenant-scoped preferences and atomically flushes delivery, reminder, audit and event', async () => {
    const unitOfWork = new NotificationIntentSnapshotUnitOfWork('tenant-a', [row('notification-preference', 'prefs-1', preference)], []);
    const service = new NotificationIntentService(unitOfWork, runtime());
    const delivery = service.queueAssignmentIntent(context, {
      sourceEventId: 'response-1:pending:2026-08-27T08:00:00.000Z',
      kind: 'reminder',
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      locale: 'pt-PT',
    });
    expect(delivery?.templateKey).toBe('assignment.reminder');

    const commitNotificationIntent = vi.fn(async (input: Readonly<Record<string, unknown>>) => input.p_delivery as Readonly<Record<string, unknown>>);
    const database = { commitNotificationIntent } as unknown as SupabaseRestDatabase;
    const persisted = await unitOfWork.flush(database);

    expect(persisted?.id).toBe(delivery?.id);
    expect(commitNotificationIntent).toHaveBeenCalledTimes(1);
    const input = commitNotificationIntent.mock.calls[0]?.[0];
    expect(input?.p_tenant_id).toBe('tenant-a');
    expect((input?.p_reminder as { assignmentId?: string }).assignmentId).toBe('assignment-1');
    expect((input?.p_event as { payload?: unknown }).payload).toEqual({
      deliveryId: 'delivery-1',
      recipientId: 'person-1',
      channel: 'in-app',
      templateKey: 'assignment.reminder',
      locale: 'pt-PT',
    });
    expect((input?.p_audit as { tenantId?: string }).tenantId).toBe('tenant-a');
  });

  it('reuses an already persisted idempotency key without staging a duplicate mutation', async () => {
    const existing = createDeliveryAttempt({
      id: 'delivery-existing', tenantId: 'tenant-a', idempotencyKey: 'source-1:person-1:in-app',
      notificationPreferenceId: 'prefs-1', recipientId: 'person-1', channel: 'in-app',
      templateKey: 'assignment.reminder', locale: 'pt-PT', now: '2026-08-27T08:10:00.000Z',
    });
    const unitOfWork = new NotificationIntentSnapshotUnitOfWork(
      'tenant-a',
      [row('notification-preference', 'prefs-1', preference)],
      [row('notification-delivery', existing.id, existing)],
    );
    const service = new NotificationIntentService(unitOfWork, runtime());

    const result = service.queueAssignmentIntent(context, {
      sourceEventId: 'source-1', kind: 'reminder', assignmentId: 'assignment-1', recipientId: 'person-1', locale: 'pt-PT',
    });
    expect(result?.id).toBe('delivery-existing');

    const commitNotificationIntent = vi.fn();
    const database = { commitNotificationIntent } as unknown as SupabaseRestDatabase;
    expect(await unitOfWork.flush(database)).toBeUndefined();
    expect(commitNotificationIntent).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant reads and commits', () => {
    const unitOfWork = new NotificationIntentSnapshotUnitOfWork('tenant-a', [row('notification-preference', 'prefs-1', preference)], []);
    const other = createAccessContext({ tenantId: 'tenant-b', actorId: 'admin-2', capabilities: ['schedule.write'] });
    expect(() => unitOfWork.findPreferences(other, 'person-1')).toThrow('Cross-tenant notification access denied');
  });
});

import { describe, expect, it } from 'vitest';
import { createAccessContext, createNotificationPreferences, type DeliveryAttempt } from '@eutaktos/domain';
import {
  NotificationIntentService,
  type NotificationIntentChange,
  type NotificationIntentUnitOfWork,
} from './notification-intent-service';

class MemoryUow implements NotificationIntentUnitOfWork {
  readonly preferences = createNotificationPreferences({ id: 'prefs-1', tenantId: 'tenant-a', personId: 'person-1', now: '2026-08-27T06:00:00.000Z' });
  readonly deliveries: DeliveryAttempt[] = [];
  readonly changes: NotificationIntentChange[] = [];

  findPreferences(context: { tenantId: string }, recipientId: string) {
    return context.tenantId === this.preferences.tenantId && recipientId === this.preferences.personId ? this.preferences : undefined;
  }

  findDeliveryByIdempotencyKey(context: { tenantId: string }, idempotencyKey: string) {
    return this.deliveries.find(item => item.tenantId === context.tenantId && item.idempotencyKey === idempotencyKey);
  }

  commit(_context: unknown, change: NotificationIntentChange) {
    this.changes.push(change);
    this.deliveries.push(change.delivery as DeliveryAttempt);
  }
}

function runtime() {
  let delivery = 0;
  let audit = 0;
  let event = 0;
  return {
    now: () => '2026-08-27T06:30:00.000Z',
    nextId: (scope: 'delivery' | 'audit' | 'event') => {
      if (scope === 'delivery') return `delivery-${++delivery}`;
      if (scope === 'audit') return `audit-${++audit}`;
      return `event-${++event}`;
    },
  };
}

describe('NotificationIntentService assignment reminder correlation', () => {
  it('commits an assignment reminder record atomically with a reminder delivery intent', () => {
    const uow = new MemoryUow();
    const service = new NotificationIntentService(uow, runtime());
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-1', capabilities: ['schedule.write'] });

    const delivery = service.queueAssignmentIntent(context, {
      sourceEventId: 'source-1',
      kind: 'reminder',
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      locale: 'pt-PT',
    });

    expect(delivery?.templateKey).toBe('assignment.reminder');
    expect(uow.changes).toHaveLength(1);
    expect(uow.changes[0]?.reminderRecord).toEqual({
      id: 'delivery-1',
      tenantId: 'tenant-a',
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      deliveryId: 'delivery-1',
      queuedAt: '2026-08-27T06:30:00.000Z',
    });
  });

  it('does not create reminder ledger data for non-reminder intents', () => {
    const uow = new MemoryUow();
    const service = new NotificationIntentService(uow, runtime());
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-1', capabilities: ['schedule.write'] });

    service.queueAssignmentIntent(context, {
      sourceEventId: 'source-2',
      kind: 'created',
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      locale: 'pt-PT',
    });

    expect(uow.changes[0]?.reminderRecord).toBeUndefined();
  });

  it('keeps retries idempotent and does not append a second reminder record', () => {
    const uow = new MemoryUow();
    const service = new NotificationIntentService(uow, runtime());
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-1', capabilities: ['schedule.write'] });
    const input = { sourceEventId: 'source-1', kind: 'reminder' as const, assignmentId: 'assignment-1', recipientId: 'person-1', locale: 'pt-PT' };

    const first = service.queueAssignmentIntent(context, input);
    const second = service.queueAssignmentIntent(context, input);

    expect(second?.id).toBe(first?.id);
    expect(uow.changes).toHaveLength(1);
  });
});

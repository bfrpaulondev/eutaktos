import { describe, expect, it } from 'vitest';
import { NotificationIntentService } from '@eutaktos/application';
import {
  createAccessContext,
  createNotificationPreferences,
  type DeliveryAttempt,
  type NotificationPreferences,
} from '@eutaktos/domain';
import { SupabaseRestDatabase, type EntityRow } from './_db';
import { ReminderNotificationIntentSnapshotUnitOfWork } from './_notification-intent-uow';

const tenantId = 'tenant-a';
const now = '2026-08-27T08:20:00.000Z';

function row(entityType: string, value: { id: string; tenantId: string }, version = 1): EntityRow {
  return { tenant_id: value.tenantId, entity_type: entityType, entity_id: value.id, data: value, version };
}

function preferences(): Readonly<NotificationPreferences> {
  return createNotificationPreferences({ id: 'prefs-1', tenantId, personId: 'person-1', now });
}

function context(tenant = tenantId) {
  return createAccessContext({ tenantId: tenant, actorId: 'actor-1', capabilities: ['schedule.write'] });
}

function runtime() {
  let counter = 0;
  return {
    now: () => '2026-08-27T08:21:00.000Z',
    nextId: (scope: 'delivery' | 'audit' | 'event') => `${scope}-${++counter}`,
  };
}

describe('ReminderNotificationIntentSnapshotUnitOfWork', () => {
  it('queues one reminder and flushes delivery, ledger, audit and event through the dedicated atomic RPC', async () => {
    const unit = new ReminderNotificationIntentSnapshotUnitOfWork(tenantId, {
      preferences: [row('notification-preferences', preferences())],
      deliveries: [],
    });
    const service = new NotificationIntentService(unit, runtime());
    const delivery = service.queueAssignmentIntent(context(), {
      sourceEventId: 'reminder-request-1',
      kind: 'reminder',
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      locale: 'pt-PT',
    });
    expect(delivery?.templateKey).toBe('assignment.reminder');

    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
      return new Response(JSON.stringify(delivery?.id), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const database = new SupabaseRestDatabase({ url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }, fetcher);
    expect(await unit.flush(database)).toBe(delivery?.id);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('/rest/v1/rpc/eutaktos_apply_assignment_reminder_intent');
    expect(calls[0]?.body).toMatchObject({ p_tenant_id: tenantId });
    expect(calls[0]?.body.p_delivery).toMatchObject({ tenantId, recipientId: 'person-1', templateKey: 'assignment.reminder', locale: 'pt-PT' });
    expect(calls[0]?.body.p_reminder).toMatchObject({ tenantId, assignmentId: 'assignment-1', recipientId: 'person-1', deliveryId: delivery?.id });
    expect(calls[0]?.body.p_audit).toMatchObject({ tenantId, resourceType: 'notification-intent', resourceId: delivery?.id });
    expect(calls[0]?.body.p_event).toMatchObject({ tenantId, type: 'NotificationIntentQueued', aggregateId: 'assignment-1' });
  });

  it('reuses a loaded delivery for the same idempotency key and stages no second atomic write', async () => {
    const firstUnit = new ReminderNotificationIntentSnapshotUnitOfWork(tenantId, {
      preferences: [row('notification-preferences', preferences())],
      deliveries: [],
    });
    const input = { sourceEventId: 'stable-source', kind: 'reminder' as const, assignmentId: 'assignment-1', recipientId: 'person-1', locale: 'pt-PT' };
    const created = new NotificationIntentService(firstUnit, runtime()).queueAssignmentIntent(context(), input) as Readonly<DeliveryAttempt>;

    const retryUnit = new ReminderNotificationIntentSnapshotUnitOfWork(tenantId, {
      preferences: [row('notification-preferences', preferences())],
      deliveries: [row('notification-delivery', created)],
    });
    const retry = new NotificationIntentService(retryUnit, runtime()).queueAssignmentIntent(context(), input);
    expect(retry?.id).toBe(created.id);

    let called = false;
    const database = new SupabaseRestDatabase({ url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }, async () => { called = true; return new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }); });
    expect(await retryUnit.flush(database)).toBeUndefined();
    expect(called).toBe(false);
  });

  it('rejects cross-tenant rows and contexts before persistence', () => {
    const prefs = preferences();
    expect(() => new ReminderNotificationIntentSnapshotUnitOfWork(tenantId, {
      preferences: [{ ...row('notification-preferences', prefs), tenant_id: 'tenant-b' }],
      deliveries: [],
    })).toThrow(/Invalid stored/);

    const unit = new ReminderNotificationIntentSnapshotUnitOfWork(tenantId, {
      preferences: [row('notification-preferences', prefs)],
      deliveries: [],
    });
    expect(() => unit.findPreferences(context('tenant-b'), 'person-1')).toThrow(/Cross-tenant/);
  });

  it('fails closed when production notification preferences are absent', () => {
    const unit = new ReminderNotificationIntentSnapshotUnitOfWork(tenantId, { preferences: [], deliveries: [] });
    const service = new NotificationIntentService(unit, runtime());
    expect(() => service.queueAssignmentIntent(context(), {
      sourceEventId: 'source-1',
      kind: 'reminder',
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      locale: 'pt-PT',
    })).toThrow('Notification preferences not found');
  });
});

import {
  assertCapability,
  assertDeliveryTenant,
  createAssignmentReminderRecord,
  createAuditEvent,
  createDeliveryAttempt,
  createDomainEvent,
  resolvePreferredChannel,
  type AccessContext,
  type AssignmentReminderRecord,
  type AuditEvent,
  type DeliveryAttempt,
  type DomainEvent,
  type NotificationPreferences,
} from '@eutaktos/domain';
import { eventCorrelation, type RequestMetadata } from './people-service';

export type AssignmentNotificationKind = 'created' | 'updated' | 'cancelled' | 'reminder';

export interface NotificationIntentChange {
  readonly delivery: Readonly<DeliveryAttempt>;
  readonly reminderRecord?: Readonly<AssignmentReminderRecord>;
  readonly auditEvents: readonly Readonly<AuditEvent>[];
  readonly domainEvents: readonly Readonly<DomainEvent>[];
}

export interface NotificationIntentUnitOfWork {
  findPreferences(context: AccessContext, recipientId: string): Readonly<NotificationPreferences> | undefined;
  findDeliveryByIdempotencyKey(context: AccessContext, idempotencyKey: string): Readonly<DeliveryAttempt> | undefined;
  commit(context: AccessContext, change: NotificationIntentChange): void;
}

export interface NotificationIntentRuntime {
  now(): string;
  nextId(scope: 'delivery' | 'audit' | 'event'): string;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

const TEMPLATE_BY_KIND: Readonly<Record<AssignmentNotificationKind, string>> = Object.freeze({
  created: 'assignment.created',
  updated: 'assignment.updated',
  cancelled: 'assignment.cancelled',
  reminder: 'assignment.reminder',
});

export class NotificationIntentService {
  readonly #uow: NotificationIntentUnitOfWork;
  readonly #runtime: NotificationIntentRuntime;

  constructor(uow: NotificationIntentUnitOfWork, runtime: NotificationIntentRuntime) {
    this.#uow = uow;
    this.#runtime = runtime;
  }

  queueAssignmentIntent(
    context: AccessContext,
    input: { sourceEventId: string; kind: AssignmentNotificationKind; assignmentId: string; recipientId: string; locale: string },
    metadata: RequestMetadata = {},
  ): Readonly<DeliveryAttempt> | undefined {
    assertCapability(context, 'schedule.write');
    const sourceEventId = required(input.sourceEventId, 'sourceEventId');
    const assignmentId = required(input.assignmentId, 'assignmentId');
    const recipientId = required(input.recipientId, 'recipientId');
    const locale = required(input.locale, 'locale');
    const preferences = this.#uow.findPreferences(context, recipientId);
    if (!preferences) throw new Error('Notification preferences not found');
    if (preferences.tenantId !== context.tenantId || preferences.personId !== recipientId) {
      throw new Error('Cross-tenant notification preferences access denied');
    }

    const channel = resolvePreferredChannel(preferences);
    if (!channel) return undefined;
    const idempotencyKey = `${sourceEventId}:${recipientId}:${channel}`;
    const existing = this.#uow.findDeliveryByIdempotencyKey(context, idempotencyKey);
    if (existing) {
      assertDeliveryTenant(existing, context.tenantId);
      if (existing.recipientId !== recipientId) throw new Error('Notification idempotency identity mismatch');
      return existing;
    }

    const at = this.#runtime.now();
    const delivery = createDeliveryAttempt({
      id: this.#runtime.nextId('delivery'),
      tenantId: context.tenantId,
      idempotencyKey,
      notificationPreferenceId: preferences.id,
      recipientId,
      channel,
      templateKey: TEMPLATE_BY_KIND[input.kind],
      locale,
      now: at,
    });
    const reminderRecord = input.kind === 'reminder'
      ? createAssignmentReminderRecord({
          id: delivery.id,
          tenantId: context.tenantId,
          assignmentId,
          recipientId,
          deliveryId: delivery.id,
          queuedAt: at,
        })
      : undefined;
    const audit = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'notification-intent',
      resourceId: delivery.id,
      action: 'create',
      actorId: context.actorId,
      occurredAt: at,
      changedFields: ['recipientId', 'channel', 'templateKey'],
    });
    const event = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'NotificationIntentQueued',
      aggregateId: assignmentId,
      actorId: context.actorId,
      occurredAt: at,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });
    this.#uow.commit(context, {
      delivery,
      ...(reminderRecord ? { reminderRecord } : {}),
      auditEvents: [audit],
      domainEvents: [event],
    });
    return delivery;
  }
}

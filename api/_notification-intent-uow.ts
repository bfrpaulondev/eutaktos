import type {
  AccessContext,
  DeliveryAttempt,
  NotificationPreferences,
} from '@eutaktos/domain';
import {
  normalizeDeliveryAttempt,
  normalizeNotificationPreferences,
} from '@eutaktos/domain';
import type {
  NotificationIntentChange,
  NotificationIntentUnitOfWork,
} from '@eutaktos/application';
import type { EntityRow } from './_db';
import { SupabaseRestDatabase } from './_db';

type TenantEntity = { readonly id: string; readonly tenantId: string };

function storedEntity<T extends TenantEntity>(row: EntityRow, tenantId: string, entityType: string): T {
  if (row.tenant_id !== tenantId || row.entity_type !== entityType || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error(`Invalid stored ${entityType} entity`);
  }
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error(`Invalid stored ${entityType} entity identity`);
  return structuredClone(data) as T;
}

function ensureTenant(context: AccessContext, tenantId: string): void {
  if (context.tenantId !== tenantId) throw new Error('Cross-tenant notification intent access denied');
}

export class ReminderNotificationIntentSnapshotUnitOfWork implements NotificationIntentUnitOfWork {
  readonly #tenantId: string;
  readonly #preferencesByPerson = new Map<string, Readonly<NotificationPreferences>>();
  readonly #deliveriesByIdempotencyKey = new Map<string, Readonly<DeliveryAttempt>>();
  #pending?: Readonly<NotificationIntentChange>;

  constructor(
    tenantId: string,
    input: {
      readonly preferences: readonly EntityRow[];
      readonly deliveries: readonly EntityRow[];
    },
  ) {
    this.#tenantId = tenantId;
    for (const row of input.preferences) {
      const value = normalizeNotificationPreferences(
        storedEntity<NotificationPreferences>(row, tenantId, 'notification-preferences'),
      );
      if (this.#preferencesByPerson.has(value.personId)) throw new Error('Duplicate notification preferences for person');
      this.#preferencesByPerson.set(value.personId, value);
    }
    for (const row of input.deliveries) {
      const value = normalizeDeliveryAttempt(
        storedEntity<DeliveryAttempt>(row, tenantId, 'notification-delivery'),
      );
      if (this.#deliveriesByIdempotencyKey.has(value.idempotencyKey)) throw new Error('Duplicate notification delivery idempotency key');
      this.#deliveriesByIdempotencyKey.set(value.idempotencyKey, value);
    }
  }

  findPreferences(context: AccessContext, recipientId: string): Readonly<NotificationPreferences> | undefined {
    ensureTenant(context, this.#tenantId);
    return this.#preferencesByPerson.get(recipientId);
  }

  findDeliveryByIdempotencyKey(context: AccessContext, idempotencyKey: string): Readonly<DeliveryAttempt> | undefined {
    ensureTenant(context, this.#tenantId);
    return this.#deliveriesByIdempotencyKey.get(idempotencyKey);
  }

  commit(context: AccessContext, change: NotificationIntentChange): void {
    ensureTenant(context, this.#tenantId);
    if (this.#pending) throw new Error('Only one notification intent mutation is allowed per request');
    if (!change.reminderRecord) throw new Error('Reminder notification adapter requires reminder ledger data');
    if (change.delivery.tenantId !== this.#tenantId || change.reminderRecord.tenantId !== this.#tenantId) {
      throw new Error('Cross-tenant reminder notification commit denied');
    }
    if (change.delivery.id !== change.reminderRecord.deliveryId || change.delivery.id !== change.reminderRecord.id) {
      throw new Error('Reminder delivery correlation mismatch');
    }
    if (change.delivery.recipientId !== change.reminderRecord.recipientId || change.delivery.templateKey !== 'assignment.reminder') {
      throw new Error('Reminder delivery identity mismatch');
    }
    if (change.auditEvents.length !== 1 || change.domainEvents.length !== 1) {
      throw new Error('Reminder notification commit requires one audit event and one domain event');
    }
    this.#pending = Object.freeze(change);
    this.#deliveriesByIdempotencyKey.set(change.delivery.idempotencyKey, change.delivery);
  }

  async flush(database: SupabaseRestDatabase): Promise<string | undefined> {
    const pending = this.#pending;
    if (!pending) return undefined;
    const reminder = pending.reminderRecord;
    if (!reminder) throw new Error('Reminder ledger data disappeared before flush');
    const persistedDeliveryId = await database.applyAssignmentReminderIntent({
      p_tenant_id: this.#tenantId,
      p_delivery: pending.delivery,
      p_reminder: reminder,
      p_audit: pending.auditEvents[0],
      p_event: pending.domainEvents[0],
    });
    this.#pending = undefined;
    return persistedDeliveryId;
  }
}

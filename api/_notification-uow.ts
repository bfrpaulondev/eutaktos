import type { NotificationIntentChange, NotificationIntentUnitOfWork } from '@eutaktos/application';
import {
  normalizeDeliveryAttempt,
  normalizeNotificationPreferences,
  type AccessContext,
  type DeliveryAttempt,
  type NotificationPreferences,
} from '@eutaktos/domain';
import type { EntityRow } from './_db';
import { SupabaseRestDatabase } from './_db';

function stored<T>(row: EntityRow, tenantId: string): T {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) throw new Error('Invalid stored notification entity');
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored notification entity identity');
  return data as T;
}

function ensureTenant(context: AccessContext, tenantId: string): void {
  if (context.tenantId !== tenantId) throw new Error('Cross-tenant notification access denied');
}

export class NotificationIntentSnapshotUnitOfWork implements NotificationIntentUnitOfWork {
  readonly #tenantId: string;
  readonly #preferences = new Map<string, Readonly<NotificationPreferences>>();
  readonly #deliveries = new Map<string, Readonly<DeliveryAttempt>>();
  #pending?: NotificationIntentChange;

  constructor(tenantId: string, preferenceRows: readonly EntityRow[], deliveryRows: readonly EntityRow[]) {
    this.#tenantId = tenantId;
    for (const row of preferenceRows) {
      const preference = normalizeNotificationPreferences(stored<NotificationPreferences>(row, tenantId));
      this.#preferences.set(preference.personId, preference);
    }
    for (const row of deliveryRows) {
      const delivery = normalizeDeliveryAttempt(stored<DeliveryAttempt>(row, tenantId));
      this.#deliveries.set(delivery.idempotencyKey, delivery);
    }
  }

  findPreferences(context: AccessContext, recipientId: string): Readonly<NotificationPreferences> | undefined {
    ensureTenant(context, this.#tenantId);
    return this.#preferences.get(recipientId);
  }

  findDeliveryByIdempotencyKey(context: AccessContext, idempotencyKey: string): Readonly<DeliveryAttempt> | undefined {
    ensureTenant(context, this.#tenantId);
    return this.#deliveries.get(idempotencyKey);
  }

  commit(context: AccessContext, change: NotificationIntentChange): void {
    ensureTenant(context, this.#tenantId);
    if (change.delivery.tenantId !== this.#tenantId) throw new Error('Cross-tenant notification delivery denied');
    if (change.reminderRecord && change.reminderRecord.tenantId !== this.#tenantId) throw new Error('Cross-tenant reminder ledger denied');
    if (change.auditEvents.length !== 1 || change.domainEvents.length !== 1) throw new Error('Notification intent requires one audit event and one domain event');
    if (this.#pending) throw new Error('Only one notification intent is allowed per request');
    this.#pending = change;
    this.#deliveries.set(change.delivery.idempotencyKey, change.delivery);
  }

  async flush(database: SupabaseRestDatabase): Promise<Readonly<DeliveryAttempt> | undefined> {
    const pending = this.#pending;
    if (!pending) return undefined;
    const value = await database.commitNotificationIntent({
      p_tenant_id: this.#tenantId,
      p_delivery: pending.delivery,
      p_reminder: pending.reminderRecord ?? null,
      p_audit: pending.auditEvents[0],
      p_event: pending.domainEvents[0],
    });
    const persisted = normalizeDeliveryAttempt(value as DeliveryAttempt);
    if (persisted.tenantId !== this.#tenantId || persisted.idempotencyKey !== pending.delivery.idempotencyKey) {
      throw new Error('Invalid persisted notification delivery identity');
    }
    this.#deliveries.set(persisted.idempotencyKey, persisted);
    this.#pending = undefined;
    return persisted;
  }
}

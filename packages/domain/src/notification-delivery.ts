import type { TenantId, PersonId } from './people';

export type DeliveryId = string;
export type IdempotencyKey = string;
export type DeliveryStatus = 'pending' | 'processing' | 'delivered' | 'retryable_failure' | 'permanent_failure';

export const DELIVERY_STATUSES: readonly DeliveryStatus[] = Object.freeze([
  'pending', 'processing', 'delivered', 'retryable_failure', 'permanent_failure',
] as const);

export interface DeliveryEventMetadata {
  readonly deliveryId: DeliveryId;
  readonly tenantId: TenantId;
  readonly channel: string;
  readonly status: DeliveryStatus;
  readonly retryCount: number;
  readonly timestamp: string;
}

export interface DeliveryAttempt {
  readonly id: DeliveryId;
  readonly tenantId: TenantId;
  readonly idempotencyKey: IdempotencyKey;
  readonly notificationPreferenceId: string;
  readonly recipientId: PersonId;
  readonly channel: string;
  readonly templateKey: string;
  readonly locale: string;
  readonly status: DeliveryStatus;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly createdAt: string;
  readonly lastAttemptAt: string | null;
  readonly deliveredAt: string | null;
  readonly failedAt: string | null;
  readonly failureReason: string | null;
  readonly eventMetadata: DeliveryEventMetadata;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function validStatus(value: string): DeliveryStatus {
  if (!DELIVERY_STATUSES.includes(value as DeliveryStatus)) throw new Error(`Invalid delivery status: ${value}`);
  return value as DeliveryStatus;
}
function validRetryCount(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
}
function eventMetadata(attempt: Omit<DeliveryAttempt, 'eventMetadata'>, timestamp: string): DeliveryEventMetadata {
  return Object.freeze({
    deliveryId: attempt.id,
    tenantId: attempt.tenantId,
    channel: attempt.channel,
    status: attempt.status,
    retryCount: attempt.retryCount,
    timestamp,
  });
}

export function createDeliveryAttempt(input: {
  id: DeliveryId; tenantId: TenantId; idempotencyKey: IdempotencyKey;
  notificationPreferenceId: string; recipientId: PersonId; channel: string;
  templateKey: string; locale: string; now: string; maxRetries?: number;
}): Readonly<DeliveryAttempt> {
  validateInstant(input.now);
  const maxRetries = input.maxRetries ?? 3;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 10) throw new Error('maxRetries must be an integer between 0 and 10');
  const core: Omit<DeliveryAttempt, 'eventMetadata'> = {
    id: required(input.id, 'deliveryId'), tenantId: required(input.tenantId, 'tenantId'),
    idempotencyKey: required(input.idempotencyKey, 'idempotencyKey'),
    notificationPreferenceId: required(input.notificationPreferenceId, 'notificationPreferenceId'),
    recipientId: required(input.recipientId, 'recipientId'), channel: required(input.channel, 'channel'),
    templateKey: required(input.templateKey, 'templateKey'), locale: required(input.locale, 'locale'),
    status: 'pending', retryCount: 0, maxRetries, createdAt: input.now,
    lastAttemptAt: null, deliveredAt: null, failedAt: null, failureReason: null,
  };
  return Object.freeze({ ...core, eventMetadata: eventMetadata(core, input.now) });
}

const VALID_TRANSITIONS: Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>> = {
  pending: ['processing', 'permanent_failure'],
  processing: ['delivered', 'retryable_failure', 'permanent_failure'],
  delivered: [], retryable_failure: ['processing'], permanent_failure: [],
};

export function transitionDeliveryStatus(
  attempt: Readonly<DeliveryAttempt>, newStatus: DeliveryStatus, now: string, reason?: string,
): Readonly<DeliveryAttempt> {
  validateInstant(now); validStatus(attempt.status); validStatus(newStatus);
  if (!VALID_TRANSITIONS[attempt.status].includes(newStatus)) throw new Error(`Invalid transition: ${attempt.status} → ${newStatus}`);
  if (attempt.status === 'retryable_failure' && newStatus === 'processing' && !canRetry(attempt)) {
    throw new Error('Retry limit reached');
  }

  let retryCount = attempt.retryCount;
  let lastAttemptAt = attempt.lastAttemptAt;
  let deliveredAt = attempt.deliveredAt;
  let failedAt = attempt.failedAt;
  let failureReason = attempt.failureReason;
  if (newStatus === 'processing') { retryCount += 1; lastAttemptAt = now; failureReason = null; }
  if (newStatus === 'delivered') { deliveredAt = now; failureReason = null; }
  if (newStatus === 'retryable_failure' || newStatus === 'permanent_failure') {
    failedAt = now;
    failureReason = reason === undefined ? null : reason.trim().slice(0, 500) || null;
  }

  const core: Omit<DeliveryAttempt, 'eventMetadata'> = {
    ...attempt, status: newStatus, retryCount, lastAttemptAt, deliveredAt, failedAt, failureReason,
  };
  return Object.freeze({ ...core, eventMetadata: eventMetadata(core, now) });
}

export function canRetry(attempt: Readonly<DeliveryAttempt>): boolean {
  return attempt.status === 'retryable_failure' && attempt.retryCount < attempt.maxRetries;
}
export function isTerminal(attempt: Readonly<DeliveryAttempt>): boolean {
  return attempt.status === 'delivered' || attempt.status === 'permanent_failure';
}
export function extractEventMetadata(attempt: Readonly<DeliveryAttempt>): DeliveryEventMetadata { return attempt.eventMetadata; }

export function deduplicateDeliveryAttempts(attempts: readonly Readonly<DeliveryAttempt>[]): readonly Readonly<DeliveryAttempt>[] {
  const seen = new Set<IdempotencyKey>();
  return attempts.filter((attempt) => seen.has(attempt.idempotencyKey) ? false : (seen.add(attempt.idempotencyKey), true));
}
export function findByIdempotencyKey(attempts: readonly Readonly<DeliveryAttempt>[], key: IdempotencyKey) {
  return attempts.find((attempt) => attempt.idempotencyKey === key);
}
export function assertDeliveryTenant(attempt: Readonly<DeliveryAttempt>, tenantId: TenantId): void {
  if (attempt.tenantId !== tenantId) throw new Error('Cross-tenant delivery access denied');
}
export function filterDeliveriesByTenant(attempts: readonly Readonly<DeliveryAttempt>[], tenantId: TenantId) {
  return attempts.filter((attempt) => attempt.tenantId === tenantId);
}

export function normalizeDeliveryAttempt(input: DeliveryAttempt): Readonly<DeliveryAttempt> {
  const id = required(input.id, 'deliveryId');
  const tenantId = required(input.tenantId, 'tenantId');
  const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey');
  const notificationPreferenceId = required(input.notificationPreferenceId, 'notificationPreferenceId');
  const recipientId = required(input.recipientId, 'recipientId');
  const channel = required(input.channel, 'channel');
  const templateKey = required(input.templateKey, 'templateKey');
  const locale = required(input.locale, 'locale');
  const status = validStatus(input.status);
  validateInstant(input.createdAt); validRetryCount(input.retryCount, 'retryCount');
  if (!Number.isInteger(input.maxRetries) || input.maxRetries < 0 || input.maxRetries > 10) throw new Error('maxRetries must be an integer between 0 and 10');
  for (const value of [input.lastAttemptAt, input.deliveredAt, input.failedAt]) if (value !== null) validateInstant(value);
  if (input.failureReason !== null && input.failureReason.length > 500) throw new Error('failureReason is too long (max 500)');
  if (status === 'processing' && input.lastAttemptAt === null) throw new Error('processing delivery requires lastAttemptAt');
  if (status === 'delivered' && input.deliveredAt === null) throw new Error('delivered delivery requires deliveredAt');
  if ((status === 'retryable_failure' || status === 'permanent_failure') && input.failedAt === null) throw new Error('failed delivery requires failedAt');

  const core: Omit<DeliveryAttempt, 'eventMetadata'> = {
    id, tenantId, idempotencyKey, notificationPreferenceId, recipientId, channel, templateKey, locale,
    status, retryCount: input.retryCount, maxRetries: input.maxRetries, createdAt: input.createdAt,
    lastAttemptAt: input.lastAttemptAt, deliveredAt: input.deliveredAt, failedAt: input.failedAt,
    failureReason: input.failureReason === null ? null : input.failureReason.trim().slice(0, 500) || null,
  };
  const timestamp = input.deliveredAt ?? input.failedAt ?? input.lastAttemptAt ?? input.createdAt;
  return Object.freeze({ ...core, eventMetadata: eventMetadata(core, timestamp) });
}

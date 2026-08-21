import type { TenantId, PersonId } from './people';

// ── Types ──────────────────────────────────────────────────────────────────

export type DeliveryId = string;
export type IdempotencyKey = string;

export type DeliveryStatus =
  | 'pending'
  | 'processing'
  | 'delivered'
  | 'retryable_failure'
  | 'permanent_failure';

export const DELIVERY_STATUSES: readonly DeliveryStatus[] = Object.freeze([
  'pending',
  'processing',
  'delivered',
  'retryable_failure',
  'permanent_failure',
] as const);

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
  /** Minimal metadata for dedup — no message body or PII */
  readonly eventMetadata: DeliveryEventMetadata;
}

/**
 * Minimal metadata for logging/events. Deliberately excludes message body,
 * personal names, and other PII.
 */
export interface DeliveryEventMetadata {
  readonly deliveryId: DeliveryId;
  readonly tenantId: TenantId;
  readonly channel: string;
  readonly status: DeliveryStatus;
  readonly retryCount: number;
  readonly timestamp: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
}

function assertValidStatus(status: string): DeliveryStatus {
  if (!DELIVERY_STATUSES.includes(status as DeliveryStatus)) {
    throw new Error(`Invalid delivery status: ${status}`);
  }
  return status as DeliveryStatus;
}

function validateRetryCount(count: number, field: string): void {
  if (!Number.isInteger(count) || count < 0) throw new Error(`${field} must be a non-negative integer`);
}

// ── Construction ───────────────────────────────────────────────────────────

export function createDeliveryAttempt(input: {
  id: DeliveryId;
  tenantId: TenantId;
  idempotencyKey: IdempotencyKey;
  notificationPreferenceId: string;
  recipientId: PersonId;
  channel: string;
  templateKey: string;
  locale: string;
  now: string;
  maxRetries?: number;
}): Readonly<DeliveryAttempt> {
  const id = required(input.id, 'deliveryId');
  const tenantId = required(input.tenantId, 'tenantId');
  const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey');
  const recipientId = required(input.recipientId, 'recipientId');
  const channel = required(input.channel, 'channel');
  const templateKey = required(input.templateKey, 'templateKey');
  const locale = required(input.locale, 'locale');
  const now = input.now;
  validateInstant(now);

  const maxRetries = input.maxRetries ?? 3;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 10) {
    throw new Error('maxRetries must be an integer between 0 and 10');
  }

  const attempt: DeliveryAttempt = {
    id,
    tenantId,
    idempotencyKey,
    notificationPreferenceId: required(input.notificationPreferenceId, 'notificationPreferenceId'),
    recipientId,
    channel,
    templateKey,
    locale,
    status: 'pending',
    retryCount: 0,
    maxRetries,
    createdAt: now,
    lastAttemptAt: null,
    deliveredAt: null,
    failedAt: null,
    failureReason: null,
    eventMetadata: Object.freeze({
      deliveryId: id,
      tenantId,
      channel,
      status: 'pending',
      retryCount: 0,
      timestamp: now,
    }),
  };

  return Object.freeze(attempt);
}

// ── State transitions ──────────────────────────────────────────────────────

const VALID_TRANSITIONS: Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>> = {
  pending: ['processing', 'permanent_failure'],
  processing: ['delivered', 'retryable_failure', 'permanent_failure'],
  delivered: [],
  retryable_failure: ['processing'],
  permanent_failure: [],
};

export function transitionDeliveryStatus(
  attempt: Readonly<DeliveryAttempt>,
  newStatus: DeliveryStatus,
  now: string,
  reason?: string,
): Readonly<DeliveryAttempt> {
  validateInstant(now);
  assertValidStatus(newStatus);

  const allowed = VALID_TRANSITIONS[attempt.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid transition: ${attempt.status} → ${newStatus}`,
    );
  }

  let retryCount = attempt.retryCount;
  let lastAttemptAt = attempt.lastAttemptAt;
  let deliveredAt = attempt.deliveredAt;
  let failedAt = attempt.failedAt;
  let failureReason = attempt.failureReason;

  if (newStatus === 'processing') {
    retryCount++;
    lastAttemptAt = now;
  }

  if (newStatus === 'delivered') {
    deliveredAt = now;
  }

  if (newStatus === 'retryable_failure' || newStatus === 'permanent_failure') {
    failedAt = now;
    failureReason = reason !== undefined ? reason.trim().slice(0, 500) || null : null;
  }

  return Object.freeze({
    ...attempt,
    status: newStatus,
    retryCount,
    lastAttemptAt,
    deliveredAt,
    failedAt,
    failureReason,
    eventMetadata: Object.freeze({
      deliveryId: attempt.id,
      tenantId: attempt.tenantId,
      channel: attempt.channel,
      status: newStatus,
      retryCount,
      timestamp: now,
    }),
  });
}

// ── Queries ────────────────────────────────────────────────────────────────

export function canRetry(attempt: Readonly<DeliveryAttempt>): boolean {
  return attempt.status === 'retryable_failure' && attempt.retryCount < attempt.maxRetries;
}

export function isTerminal(attempt: Readonly<DeliveryAttempt>): boolean {
  return attempt.status === 'delivered' || attempt.status === 'permanent_failure';
}

export function extractEventMetadata(
  attempt: Readonly<DeliveryAttempt>,
): DeliveryEventMetadata {
  return attempt.eventMetadata;
}

// ── Deduplication ──────────────────────────────────────────────────────────

export function deduplicateDeliveryAttempts(
  attempts: readonly Readonly<DeliveryAttempt>[],
): readonly Readonly<DeliveryAttempt>[] {
  const seen = new Set<IdempotencyKey>();
  return attempts.filter(a => {
    if (seen.has(a.idempotencyKey)) return false;
    seen.add(a.idempotencyKey);
    return true;
  });
}

export function findByIdempotencyKey(
  attempts: readonly Readonly<DeliveryAttempt>[],
  key: IdempotencyKey,
): Readonly<DeliveryAttempt> | undefined {
  return attempts.find(a => a.idempotencyKey === key);
}

// ── Tenant isolation ───────────────────────────────────────────────────────

export function assertDeliveryTenant(
  attempt: Readonly<DeliveryAttempt>,
  tenantId: TenantId,
): void {
  if (attempt.tenantId !== tenantId) throw new Error('Cross-tenant delivery access denied');
}

export function filterDeliveriesByTenant(
  attempts: readonly Readonly<DeliveryAttempt>[],
  tenantId: TenantId,
): readonly Readonly<DeliveryAttempt>[] {
  return attempts.filter(a => a.tenantId === tenantId);
}

// ── Normalization ──────────────────────────────────────────────────────────

export function normalizeDeliveryAttempt(
  input: DeliveryAttempt,
): Readonly<DeliveryAttempt> {
  required(input.id, 'deliveryId');
  required(input.tenantId, 'tenantId');
  required(input.idempotencyKey, 'idempotencyKey');
  required(input.recipientId, 'recipientId');
  required(input.channel, 'channel');
  required(input.templateKey, 'templateKey');
  required(input.locale, 'locale');
  validateInstant(input.createdAt);
  assertValidStatus(input.status);
  validateRetryCount(input.retryCount, 'retryCount');

  if (!Number.isInteger(input.maxRetries) || input.maxRetries < 0 || input.maxRetries > 10) {
    throw new Error('maxRetries must be an integer between 0 and 10');
  }

  if (input.lastAttemptAt !== null) validateInstant(input.lastAttemptAt);
  if (input.deliveredAt !== null) validateInstant(input.deliveredAt);
  if (input.failedAt !== null) validateInstant(input.failedAt);
  if (input.failureReason !== null && input.failureReason.length > 500) {
    throw new Error('failureReason is too long (max 500)');
  }

  return Object.freeze({ ...input });
}

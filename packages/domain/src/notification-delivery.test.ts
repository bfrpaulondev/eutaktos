import { describe, it, expect } from 'vitest';
import {
  createDeliveryAttempt,
  transitionDeliveryStatus,
  canRetry,
  isTerminal,
  extractEventMetadata,
  deduplicateDeliveryAttempts,
  findByIdempotencyKey,
  assertDeliveryTenant,
  filterDeliveriesByTenant,
  normalizeDeliveryAttempt,
  DELIVERY_STATUSES,
} from './notification-delivery';

const NOW = '2026-08-21T12:00:00.000Z';
const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';
const PERSON_1 = 'person-001';

function makeAttempt(overrides?: Partial<Parameters<typeof createDeliveryAttempt>[0]>) {
  return createDeliveryAttempt({
    id: 'del-1',
    tenantId: TENANT_A,
    idempotencyKey: 'idem-1',
    notificationPreferenceId: 'np-1',
    recipientId: PERSON_1,
    channel: 'in-app',
    templateKey: 'assignment.reminder',
    locale: 'en',
    now: NOW,
    ...overrides,
  });
}

// ── createDeliveryAttempt ─────────────────────────────────────────────

describe('createDeliveryAttempt', () => {
  it('creates with defaults', () => {
    const a = makeAttempt();
    expect(a.status).toBe('pending');
    expect(a.retryCount).toBe(0);
    expect(a.maxRetries).toBe(3);
    expect(a.lastAttemptAt).toBeNull();
    expect(a.deliveredAt).toBeNull();
    expect(a.failedAt).toBeNull();
    expect(a.failureReason).toBeNull();
  });

  it('freezes the result', () => {
    expect(Object.isFrozen(makeAttempt())).toBe(true);
  });

  it('freezes eventMetadata', () => {
    expect(Object.isFrozen(makeAttempt().eventMetadata)).toBe(true);
  });

  it('throws on empty id', () => {
    expect(() => makeAttempt({ id: '  ' })).toThrow('deliveryId is required');
  });

  it('throws on invalid date', () => {
    expect(() => makeAttempt({ now: 'bad' })).toThrow('Invalid ISO date');
  });

  it('throws on invalid maxRetries', () => {
    expect(() => makeAttempt({ maxRetries: -1 })).toThrow('maxRetries must be');
    expect(() => makeAttempt({ maxRetries: 11 })).toThrow('maxRetries must be');
    expect(() => makeAttempt({ maxRetries: 1.5 as unknown as number })).toThrow('maxRetries must be');
  });

  it('accepts custom maxRetries', () => {
    const a = makeAttempt({ maxRetries: 5 });
    expect(a.maxRetries).toBe(5);
  });
});

// ── transitionDeliveryStatus ──────────────────────────────────────────

describe('transitionDeliveryStatus', () => {
  it('pending → processing', () => {
    const a = transitionDeliveryStatus(makeAttempt(), 'processing', '2026-08-21T12:01:00.000Z');
    expect(a.status).toBe('processing');
    expect(a.retryCount).toBe(1);
    expect(a.lastAttemptAt).toBe('2026-08-21T12:01:00.000Z');
  });

  it('processing → delivered', () => {
    let a = makeAttempt();
    a = transitionDeliveryStatus(a, 'processing', '2026-08-21T12:01:00.000Z');
    a = transitionDeliveryStatus(a, 'delivered', '2026-08-21T12:02:00.000Z');
    expect(a.status).toBe('delivered');
    expect(a.deliveredAt).toBe('2026-08-21T12:02:00.000Z');
  });

  it('processing → retryable_failure', () => {
    let a = makeAttempt();
    a = transitionDeliveryStatus(a, 'processing', '2026-08-21T12:01:00.000Z');
    a = transitionDeliveryStatus(a, 'retryable_failure', '2026-08-21T12:02:00.000Z', 'Timeout');
    expect(a.status).toBe('retryable_failure');
    expect(a.failureReason).toBe('Timeout');
    expect(a.failedAt).toBe('2026-08-21T12:02:00.000Z');
  });

  it('processing → permanent_failure', () => {
    let a = makeAttempt();
    a = transitionDeliveryStatus(a, 'processing', '2026-08-21T12:01:00.000Z');
    a = transitionDeliveryStatus(a, 'permanent_failure', '2026-08-21T12:02:00.000Z', 'Invalid recipient');
    expect(a.status).toBe('permanent_failure');
    expect(a.failureReason).toBe('Invalid recipient');
  });

  it('retryable_failure → processing increments retryCount', () => {
    let a = makeAttempt({ maxRetries: 3 });
    a = transitionDeliveryStatus(a, 'processing', '2026-08-21T12:01:00.000Z');
    a = transitionDeliveryStatus(a, 'retryable_failure', '2026-08-21T12:02:00.000Z', 'err');
    a = transitionDeliveryStatus(a, 'processing', '2026-08-21T12:03:00.000Z');
    expect(a.retryCount).toBe(2);
  });

  it('rejects invalid transitions', () => {
    const a = makeAttempt();
    expect(() => transitionDeliveryStatus(a, 'delivered', NOW)).toThrow('Invalid transition');
    expect(() => transitionDeliveryStatus(a, 'retryable_failure', NOW)).toThrow('Invalid transition');
  });

  it('rejects transition from terminal states', () => {
    let a = makeAttempt();
    a = transitionDeliveryStatus(a, 'processing', '2026-08-21T12:01:00.000Z');
    a = transitionDeliveryStatus(a, 'delivered', '2026-08-21T12:02:00.000Z');
    expect(() => transitionDeliveryStatus(a, 'processing', '2026-08-21T12:03:00.000Z')).toThrow('Invalid transition');
  });

  it('trims and limits failureReason', () => {
    let a = makeAttempt();
    a = transitionDeliveryStatus(a, 'processing', '2026-08-21T12:01:00.000Z');
    a = transitionDeliveryStatus(a, 'permanent_failure', '2026-08-21T12:02:00.000Z', '  x  '.repeat(200));
    expect(a.failureReason!.length).toBeLessThanOrEqual(500);
  });

  it('nullifies failureReason on non-failure transitions', () => {
    let a = makeAttempt();
    a = transitionDeliveryStatus(a, 'processing', '2026-08-21T12:01:00.000Z');
    expect(a.failureReason).toBeNull();
  });

  it('updates eventMetadata on transition', () => {
    let a = makeAttempt();
    a = transitionDeliveryStatus(a, 'processing', '2026-08-21T12:01:00.000Z');
    expect(a.eventMetadata.status).toBe('processing');
    expect(a.eventMetadata.retryCount).toBe(1);
    expect(a.eventMetadata.timestamp).toBe('2026-08-21T12:01:00.000Z');
  });
});

// ── canRetry / isTerminal ─────────────────────────────────────────────

describe('canRetry', () => {
  it('returns true when retryable and under max', () => {
    let a = makeAttempt({ maxRetries: 3 });
    a = transitionDeliveryStatus(a, 'processing', NOW);
    a = transitionDeliveryStatus(a, 'retryable_failure', NOW, 'err');
    expect(canRetry(a)).toBe(true);
  });

  it('returns false when retryable but at max', () => {
    let a = makeAttempt({ maxRetries: 1 });
    a = transitionDeliveryStatus(a, 'processing', NOW);
    a = transitionDeliveryStatus(a, 'retryable_failure', NOW, 'err');
    expect(canRetry(a)).toBe(false);
  });

  it('returns false when not retryable_failure', () => {
    const a = makeAttempt();
    expect(canRetry(a)).toBe(false);
  });
});

describe('isTerminal', () => {
  it('delivered is terminal', () => {
    let a = makeAttempt();
    a = transitionDeliveryStatus(a, 'processing', NOW);
    a = transitionDeliveryStatus(a, 'delivered', NOW);
    expect(isTerminal(a)).toBe(true);
  });

  it('permanent_failure is terminal', () => {
    let a = makeAttempt();
    a = transitionDeliveryStatus(a, 'processing', NOW);
    a = transitionDeliveryStatus(a, 'permanent_failure', NOW);
    expect(isTerminal(a)).toBe(true);
  });

  it('pending is not terminal', () => {
    expect(isTerminal(makeAttempt())).toBe(false);
  });
});

// ── Idempotency ───────────────────────────────────────────────────────

describe('deduplication', () => {
  it('deduplicates by idempotencyKey', () => {
    const a1 = makeAttempt({ id: 'del-1', idempotencyKey: 'key-1' });
    const a2 = makeAttempt({ id: 'del-2', idempotencyKey: 'key-1' });
    const a3 = makeAttempt({ id: 'del-3', idempotencyKey: 'key-2' });
    const deduped = deduplicateDeliveryAttempts([a1, a2, a3]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].id).toBe('del-1');
    expect(deduped[1].id).toBe('del-3');
  });

  it('findByIdempotencyKey', () => {
    const a1 = makeAttempt({ id: 'del-1', idempotencyKey: 'key-1' });
    const a2 = makeAttempt({ id: 'del-2', idempotencyKey: 'key-2' });
    expect(findByIdempotencyKey([a1, a2], 'key-1')?.id).toBe('del-1');
    expect(findByIdempotencyKey([a1, a2], 'key-3')).toBeUndefined();
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('assertDeliveryTenant', () => {
    const a = makeAttempt({ tenantId: TENANT_A });
    expect(() => assertDeliveryTenant(a, TENANT_A)).not.toThrow();
    expect(() => assertDeliveryTenant(a, TENANT_B)).toThrow('Cross-tenant');
  });

  it('filterDeliveriesByTenant', () => {
    const a1 = makeAttempt({ id: 'd1', tenantId: TENANT_A });
    const a2 = makeAttempt({ id: 'd2', tenantId: TENANT_B });
    const filtered = filterDeliveriesByTenant([a1, a2], TENANT_A);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tenantId).toBe(TENANT_A);
  });
});

// ── extractEventMetadata ──────────────────────────────────────────────

describe('extractEventMetadata', () => {
  it('returns metadata without PII', () => {
    const a = makeAttempt();
    const meta = extractEventMetadata(a);
    expect(meta.deliveryId).toBe('del-1');
    expect(meta.tenantId).toBe(TENANT_A);
    expect(meta.channel).toBe('in-app');
    expect(meta.status).toBe('pending');
    expect('recipientId' in meta).toBe(false);
    expect('templateKey' in meta).toBe(false);
    expect('failureReason' in meta).toBe(false);
  });
});

// ── normalizeDeliveryAttempt ──────────────────────────────────────────

describe('normalizeDeliveryAttempt', () => {
  it('normalizes valid attempt', () => {
    const a = makeAttempt();
    const n = normalizeDeliveryAttempt(a);
    expect(n.id).toBe(a.id);
    expect(Object.isFrozen(n)).toBe(true);
  });

  it('throws on invalid status', () => {
    const bad = { ...makeAttempt(), status: 'unknown' } as any;
    expect(() => normalizeDeliveryAttempt(bad)).toThrow('Invalid delivery status');
  });

  it('throws on failureReason too long', () => {
    const bad = { ...makeAttempt(), status: 'permanent_failure', failureReason: 'x'.repeat(501) } as any;
    expect(() => normalizeDeliveryAttempt(bad)).toThrow('failureReason is too long');
  });
});

// ── DELIVERY_STATUSES ─────────────────────────────────────────────────

describe('DELIVERY_STATUSES', () => {
  it('contains all expected statuses', () => {
    expect(DELIVERY_STATUSES).toEqual([
      'pending', 'processing', 'delivered', 'retryable_failure', 'permanent_failure',
    ]);
    expect(Object.isFrozen(DELIVERY_STATUSES)).toBe(true);
  });
});


it('records notification intent as pending and cannot claim delivery before provider processing', () => {
  const intent = makeAttempt({ channel: 'email', templateKey: 'assignment.created' });
  expect(intent).toMatchObject({ status: 'pending', deliveredAt: null, lastAttemptAt: null });
  expect(() => transitionDeliveryStatus(intent, 'delivered', NOW)).toThrow('Invalid transition');
});

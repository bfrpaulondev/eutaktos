import { describe, expect, it } from 'vitest';
import { assertEventTenant, createDomainEvent, orderDomainEvents } from './domain-events';

describe('domain events', () => {
  const base = {
    id: 'evt-2',
    tenantId: 'tenant-a',
    type: 'EligibilityChanged' as const,
    aggregateId: 'person-a',
    actorId: 'person-elder',
    occurredAt: '2026-08-20T10:00:00Z',
    schemaVersion: 1 as const,
  };

  it('creates an immutable privacy-minimized event envelope', () => {
    const event = createDomainEvent(base);
    expect(event).toEqual(base);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.keys(event).sort()).toEqual([
      'actorId', 'aggregateId', 'id', 'occurredAt', 'schemaVersion', 'tenantId', 'type',
    ]);
  });

  it('preserves only bounded primitive event payload data and freezes the payload', () => {
    const event = createDomainEvent({ ...base, payload: { deliveryId: 'delivery-1', retryCount: 0, external: false, failure: null } });
    expect(event.payload).toEqual({ deliveryId: 'delivery-1', retryCount: 0, external: false, failure: null });
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(() => createDomainEvent({ ...base, payload: { nested: { value: 'forbidden' } } as never })).toThrow('Invalid domain event payload value');
    expect(() => createDomainEvent({ ...base, payload: { invalid: Number.NaN } as never })).toThrow('Invalid domain event payload value');
  });

  it('enforces tenant boundaries', () => {
    const event = createDomainEvent(base);
    expect(() => assertEventTenant(event, 'tenant-b')).toThrow('Cross-tenant domain event access denied');
    expect(() => assertEventTenant(event, 'tenant-a')).not.toThrow();
  });

  it('orders deterministically by time and id', () => {
    const events = [
      createDomainEvent(base),
      createDomainEvent({ ...base, id: 'evt-3', occurredAt: '2026-08-21T10:00:00Z' }),
      createDomainEvent({ ...base, id: 'evt-1' }),
    ];
    expect(orderDomainEvents(events).map(event => event.id)).toEqual(['evt-1', 'evt-2', 'evt-3']);
  });

  it('rejects unsupported schemas and malformed identity fields', () => {
    expect(() => createDomainEvent({ ...base, schemaVersion: 2 as never })).toThrow('Unsupported domain event schema version');
    expect(() => createDomainEvent({ ...base, actorId: ' ' })).toThrow('actorId is required');
    expect(() => createDomainEvent({ ...base, occurredAt: 'not-a-date' })).toThrow('Invalid ISO date');
  });
});

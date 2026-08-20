import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  createAuditEvent,
  type AccessContext,
  type AuditEvent,
} from '@eutaktos/domain';
import { AuditHistoryService, type AuditHistorySource } from './audit-history-service';

function context(capabilities: AccessContext['capabilities'] = ['audit.read']) {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'reviewer-a', capabilities });
}

function event(overrides: Partial<AuditEvent> = {}): Readonly<AuditEvent> {
  return createAuditEvent({
    id: overrides.id ?? 'audit-1',
    tenantId: overrides.tenantId ?? 'tenant-a',
    resourceType: overrides.resourceType ?? 'person',
    resourceId: overrides.resourceId ?? 'person-1',
    action: overrides.action ?? 'update',
    actorId: overrides.actorId ?? 'actor-1',
    occurredAt: overrides.occurredAt ?? '2026-08-20T10:00:00.000Z',
    changedFields: overrides.changedFields ?? ['displayName'],
  });
}

class FakeSource implements AuditHistorySource {
  constructor(readonly values: readonly Readonly<AuditEvent>[]) {}
  listAudit(_context: AccessContext): readonly Readonly<AuditEvent>[] {
    return this.values;
  }
}

describe('AuditHistoryService', () => {
  it('requires the dedicated sensitive audit.read capability', () => {
    const service = new AuditHistoryService(new FakeSource([]));
    expect(() => service.list(context(['tenant.manage']))).toThrow('missing capability audit.read');
  });

  it('returns newest-first immutable history with deterministic tie ordering', () => {
    const service = new AuditHistoryService(new FakeSource([
      event({ id: 'audit-a', occurredAt: '2026-08-20T10:00:00.000Z' }),
      event({ id: 'audit-b', occurredAt: '2026-08-20T11:00:00.000Z' }),
      event({ id: 'audit-c', occurredAt: '2026-08-20T11:00:00.000Z' }),
    ]));

    const result = service.list(context());
    expect(result.map(item => item.id)).toEqual(['audit-c', 'audit-b', 'audit-a']);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(Object.isFrozen(result[0]?.changedFields)).toBe(true);
  });

  it('supports exact resource/action/actor filters and half-open time windows', () => {
    const service = new AuditHistoryService(new FakeSource([
      event({ id: 'one', resourceType: 'person', resourceId: 'person-1', actorId: 'actor-1', action: 'update', occurredAt: '2026-08-20T10:00:00.000Z' }),
      event({ id: 'two', resourceType: 'eligibility', resourceId: 'person-1:talk', actorId: 'actor-2', action: 'grant', occurredAt: '2026-08-20T11:00:00.000Z' }),
      event({ id: 'three', resourceType: 'eligibility', resourceId: 'person-1:talk', actorId: 'actor-2', action: 'revoke', occurredAt: '2026-08-20T12:00:00.000Z' }),
    ]));

    expect(service.list(context(), {
      resourceType: 'eligibility',
      resourceId: 'person-1:talk',
      actorId: 'actor-2',
      action: 'grant',
      from: '2026-08-20T11:00:00.000Z',
      to: '2026-08-20T12:00:00.000Z',
    }).map(item => item.id)).toEqual(['two']);
  });

  it('applies a bounded result limit after deterministic ordering', () => {
    const service = new AuditHistoryService(new FakeSource([
      event({ id: 'a', occurredAt: '2026-08-20T09:00:00.000Z' }),
      event({ id: 'b', occurredAt: '2026-08-20T10:00:00.000Z' }),
      event({ id: 'c', occurredAt: '2026-08-20T11:00:00.000Z' }),
    ]));

    expect(service.list(context(), { limit: 2 }).map(item => item.id)).toEqual(['c', 'b']);
    expect(() => service.list(context(), { limit: 0 })).toThrow('limit must be an integer');
    expect(() => service.list(context(), { limit: 201 })).toThrow('limit must be an integer');
  });

  it('rejects invalid ranges and blank identifiers', () => {
    const service = new AuditHistoryService(new FakeSource([]));
    expect(() => service.list(context(), { from: 'bad-date' })).toThrow('from must be a valid ISO date');
    expect(() => service.list(context(), { from: '2026-08-21T00:00:00Z', to: '2026-08-20T00:00:00Z' }))
      .toThrow('from must be earlier than to');
    expect(() => service.list(context(), { actorId: '   ' })).toThrow('actorId is required');
  });

  it('fails closed if a faulty source returns a foreign tenant event', () => {
    const service = new AuditHistoryService(new FakeSource([
      event({ tenantId: 'tenant-b', id: 'foreign' }),
    ]));
    expect(() => service.list(context())).toThrow('Cross-tenant audit access denied');
  });
});

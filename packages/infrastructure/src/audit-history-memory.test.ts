import { describe, expect, it, vi } from 'vitest';
import {
  createAccessContext,
  createAuditEvent,
  type AccessContext,
  type AuditEvent,
} from '@eutaktos/domain';
import { CompositeAuditHistorySource, type AuditReadableSource } from './audit-history-memory';

function context(capabilities: AccessContext['capabilities'] = ['audit.read']) {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'reviewer-a', capabilities });
}

function event(id: string, tenantId = 'tenant-a'): Readonly<AuditEvent> {
  return createAuditEvent({
    id,
    tenantId,
    resourceType: 'person',
    resourceId: 'person-1',
    action: 'update',
    actorId: 'actor-1',
    occurredAt: '2026-08-20T10:00:00.000Z',
    changedFields: ['displayName'],
  });
}

function source(values: readonly Readonly<AuditEvent>[]): AuditReadableSource {
  return { listAudit: vi.fn(() => values) };
}

describe('CompositeAuditHistorySource', () => {
  it('merges tenant-scoped audit streams as immutable defensive clones', () => {
    const first = source([event('a')]);
    const second = source([event('b')]);
    const repository = new CompositeAuditHistorySource([first, second]);

    const result = repository.listAudit(context());
    expect(result.map(item => item.id)).toEqual(['a', 'b']);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(first.listAudit).toHaveBeenCalledTimes(1);
    expect(second.listAudit).toHaveBeenCalledTimes(1);
  });

  it('requires audit.read before consulting any underlying source', () => {
    const underlying = source([event('a')]);
    const repository = new CompositeAuditHistorySource([underlying]);

    expect(() => repository.listAudit(context(['tenant.manage']))).toThrow('missing capability audit.read');
    expect(underlying.listAudit).not.toHaveBeenCalled();
  });

  it('fails closed if an underlying adapter leaks another tenant', () => {
    const repository = new CompositeAuditHistorySource([source([event('foreign', 'tenant-b')])]);
    expect(() => repository.listAudit(context())).toThrow('Cross-tenant audit access denied');
  });

  it('rejects duplicate event ids across sources instead of returning ambiguous history', () => {
    const repository = new CompositeAuditHistorySource([
      source([event('same')]),
      source([event('same')]),
    ]);
    expect(() => repository.listAudit(context())).toThrow('Duplicate audit event id across sources');
  });
});

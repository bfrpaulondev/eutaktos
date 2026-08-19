import { describe, expect, it } from 'vitest';
import { assertAuditTenant, createAuditEvent, hasAuditEventFor, orderAuditEvents } from './audit';

describe('audit domain', () => {
  it('creates immutable normalized audit events', () => {
    const event = createAuditEvent({
      id: 'a-1', tenantId: 't-1', resourceType: 'eligibility', resourceId: 'p-1:reading',
      action: 'grant', actorId: 'p-9', occurredAt: '2026-08-19T20:00:00Z',
      changedFields: [' enabled ', 'assignmentTypeId', 'enabled'],
    });

    expect(event.changedFields).toEqual(['assignmentTypeId', 'enabled']);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.changedFields)).toBe(true);
  });

  it('requires changed fields for updates', () => {
    expect(() => createAuditEvent({
      id: 'a-1', tenantId: 't-1', resourceType: 'person', resourceId: 'p-1',
      action: 'update', actorId: 'p-9', occurredAt: '2026-08-19T20:00:00Z', changedFields: [],
    })).toThrow(/changedFields/);
  });

  it('orders events deterministically and finds resource history', () => {
    const later = createAuditEvent({
      id: 'a-2', tenantId: 't-1', resourceType: 'person', resourceId: 'p-1',
      action: 'update', actorId: 'p-9', occurredAt: '2026-08-19T21:00:00Z', changedFields: ['displayName'],
    });
    const earlier = createAuditEvent({
      id: 'a-1', tenantId: 't-1', resourceType: 'person', resourceId: 'p-1',
      action: 'create', actorId: 'p-9', occurredAt: '2026-08-19T20:00:00Z', changedFields: ['displayName'],
    });

    expect(orderAuditEvents([later, earlier]).map(event => event.id)).toEqual(['a-1', 'a-2']);
    expect(hasAuditEventFor([later, earlier], 'person', 'p-1')).toBe(true);
  });

  it('rejects cross-tenant audit access', () => {
    const event = createAuditEvent({
      id: 'a-1', tenantId: 't-1', resourceType: 'person', resourceId: 'p-1',
      action: 'create', actorId: 'p-9', occurredAt: '2026-08-19T20:00:00Z', changedFields: ['displayName'],
    });

    expect(() => assertAuditTenant(event, 't-2')).toThrow(/Cross-tenant/);
  });
});

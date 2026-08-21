import { describe, expect, it } from 'vitest';
import {
  addMeetingSlot,
  createAccessContext,
  createAuditEvent,
  createDomainEvent,
  createMidweekMeeting,
  createStudentAssignment,
  type Capability,
  type MidweekMeeting,
} from '@eutaktos/domain';
import { InMemoryMidweekSchedulingUnitOfWork } from './midweek-memory';

const context = (tenantId: string, capabilities: readonly Capability[] = ['schedule.write']) =>
  createAccessContext({ tenantId, actorId: 'actor-1', capabilities });

function meeting(tenantId: string, id = 'meeting-1'): Readonly<MidweekMeeting> {
  const base = createMidweekMeeting({
    id, tenantId, date: '2026-08-21', localTime: '19:00', timezone: 'Europe/Lisbon', now: '2026-08-20T10:00:00.000Z',
  });
  return addMeetingSlot(base, { id: 'slot-1', position: 0, durationMinutes: 10, titleKey: 'slot.one' });
}

const resolve = () => ({ startsAt: '2026-08-21T18:00:00.000Z', endsAt: '2026-08-21T18:10:00.000Z' });

describe('InMemoryMidweekSchedulingUnitOfWork', () => {
  it('isolates identical ids across tenants', () => {
    const uow = new InMemoryMidweekSchedulingUnitOfWork({ meetings: [meeting('a'), meeting('b')], resolveSlotWindow: resolve });
    expect(uow.findMeeting(context('a'), 'meeting-1')?.tenantId).toBe('a');
    expect(uow.findMeeting(context('b'), 'meeting-1')?.tenantId).toBe('b');
  });

  it('returns defensive immutable meeting copies', () => {
    const uow = new InMemoryMidweekSchedulingUnitOfWork({ meetings: [meeting('a')], resolveSlotWindow: resolve });
    const found = uow.findMeeting(context('a'), 'meeting-1')!;
    expect(Object.isFrozen(found)).toBe(true);
    expect(Object.isFrozen(found.slots)).toBe(true);
    expect(Object.isFrozen(found.slots[0])).toBe(true);
  });

  it('lists only active conflict assignments for the requested tenant', () => {
    const aMeeting = meeting('a');
    const bMeeting = meeting('b');
    const aAssignment = createStudentAssignment({
      id: 'assignment-1', tenantId: 'a', meetingId: aMeeting.id, slotId: 'slot-1', studentId: 'same-person', assistantIsRequired: false, now: '2026-08-20T10:00:00.000Z',
    });
    const bAssignment = createStudentAssignment({
      id: 'assignment-1', tenantId: 'b', meetingId: bMeeting.id, slotId: 'slot-1', studentId: 'same-person', assistantIsRequired: false, now: '2026-08-20T10:00:00.000Z',
    });
    const uow = new InMemoryMidweekSchedulingUnitOfWork({ meetings: [aMeeting, bMeeting], studentAssignments: [aAssignment, bAssignment], resolveSlotWindow: resolve });
    const conflicts = uow.listConflictAssignments(context('a'), ['same-person']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].tenantId).toBe('a');
  });

  it('rejects cross-tenant resources before mutating storage', () => {
    const uow = new InMemoryMidweekSchedulingUnitOfWork({ meetings: [meeting('a')], resolveSlotWindow: resolve });
    const ctx = context('a');
    expect(() => uow.commit(ctx, { meeting: meeting('b', 'foreign'), auditEvents: [], domainEvents: [] }))
      .toThrow('Cross-tenant access denied');
    expect(uow.findMeeting(ctx, 'foreign')).toBeUndefined();
  });

  it('prevalidates duplicate audit ids so the business entity is not partially committed', () => {
    const ctx = context('a');
    const uow = new InMemoryMidweekSchedulingUnitOfWork({ meetings: [meeting('a')], resolveSlotWindow: resolve });
    const audit = createAuditEvent({
      id: 'audit-1', tenantId: 'a', resourceType: 'midweek-meeting', resourceId: 'meeting-1', action: 'update', actorId: 'actor-1', occurredAt: '2026-08-21T10:00:00.000Z', changedFields: ['state'],
    });
    uow.commit(ctx, { auditEvents: [audit], domainEvents: [] });
    const newMeeting = meeting('a', 'meeting-new');
    expect(() => uow.commit(ctx, { meeting: newMeeting, auditEvents: [audit], domainEvents: [] })).toThrow('Duplicate audit event id');
    expect(uow.findMeeting(ctx, 'meeting-new')).toBeUndefined();
  });

  it('stores audit and outbox events only in their tenant', () => {
    const writer = context('a');
    const uow = new InMemoryMidweekSchedulingUnitOfWork({ resolveSlotWindow: resolve });
    const audit = createAuditEvent({ id: 'audit-1', tenantId: 'a', resourceType: 'midweek-meeting', resourceId: 'm1', action: 'create', actorId: 'actor-1', occurredAt: '2026-08-21T10:00:00.000Z', changedFields: ['date'] });
    const event = createDomainEvent({ id: 'event-1', tenantId: 'a', type: 'MidweekMeetingCreated', aggregateId: 'm1', actorId: 'actor-1', occurredAt: '2026-08-21T10:00:00.000Z', schemaVersion: 1 });
    uow.commit(writer, { auditEvents: [audit], domainEvents: [event] });
    expect(uow.listAudit(context('a', ['audit.read']))).toHaveLength(1);
    expect(uow.listOutbox(context('a', ['tenant.manage']))).toHaveLength(1);
    expect(uow.listAudit(context('b', ['audit.read']))).toHaveLength(0);
  });

  it('fails closed when the trusted scheduling window resolver is absent', () => {
    const m = meeting('a');
    const uow = new InMemoryMidweekSchedulingUnitOfWork({ meetings: [m] });
    expect(() => uow.resolveSlotWindow(context('a'), m, 'slot-1')).toThrow('resolver is not configured');
  });
});

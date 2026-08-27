import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  createAssignmentReminderRecord,
  createAssignmentResponse,
  transitionAssignmentResponse,
  type AssignmentReminderRecord,
  type AssignmentResponse,
} from '@eutaktos/domain';
import { AssignmentReminderReviewService, type AssignmentReminderReviewReadModel } from './assignment-reminder-review-service';

class MemoryReadModel implements AssignmentReminderReviewReadModel {
  constructor(
    readonly responses: readonly Readonly<AssignmentResponse>[],
    readonly reminders: readonly Readonly<AssignmentReminderRecord>[],
  ) {}

  listAssignmentResponses() { return this.responses; }
  listAssignmentReminderRecords() { return this.reminders; }
}

function pending(id: string, tenantId: string, assignmentId: string, personId: string, createdAt: string) {
  return createAssignmentResponse({ id, tenantId, assignmentId, personId, now: createdAt });
}

describe('AssignmentReminderReviewService', () => {
  it('returns only pending responses with deterministic reason and latest exact reminder', () => {
    const p1 = pending('r-1', 'tenant-a', 'a-1', 'p-1', '2026-08-27T05:00:00.000Z');
    const p2 = pending('r-2', 'tenant-a', 'a-2', 'p-2', '2026-08-27T04:00:00.000Z');
    const confirmed = transitionAssignmentResponse(
      pending('r-3', 'tenant-a', 'a-3', 'p-3', '2026-08-27T03:00:00.000Z'),
      'confirmed',
      '2026-08-27T03:30:00.000Z',
    );
    const reminders = [
      createAssignmentReminderRecord({ id: 'd-1', tenantId: 'tenant-a', assignmentId: 'a-1', recipientId: 'p-1', deliveryId: 'd-1', queuedAt: '2026-08-27T05:30:00.000Z' }),
      createAssignmentReminderRecord({ id: 'd-2', tenantId: 'tenant-a', assignmentId: 'a-1', recipientId: 'p-1', deliveryId: 'd-2', queuedAt: '2026-08-27T06:30:00.000Z' }),
      createAssignmentReminderRecord({ id: 'd-3', tenantId: 'tenant-a', assignmentId: 'a-1', recipientId: 'other', deliveryId: 'd-3', queuedAt: '2026-08-27T07:30:00.000Z' }),
    ];
    const service = new AssignmentReminderReviewService(new MemoryReadModel([p1, p2, confirmed], reminders));
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-1', capabilities: ['schedule.read'] });

    expect(service.list(context)).toEqual([
      {
        responseId: 'r-2',
        assignmentId: 'a-2',
        recipientId: 'p-2',
        reason: 'awaiting-response',
        pendingSince: '2026-08-27T04:00:00.000Z',
        lastReminderAt: null,
      },
      {
        responseId: 'r-1',
        assignmentId: 'a-1',
        recipientId: 'p-1',
        reason: 'awaiting-response',
        pendingSince: '2026-08-27T05:00:00.000Z',
        lastReminderAt: '2026-08-27T06:30:00.000Z',
      },
    ]);
  });

  it('requires schedule.read capability', () => {
    const service = new AssignmentReminderReviewService(new MemoryReadModel([], []));
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-1', capabilities: [] });
    expect(() => service.list(context)).toThrow();
  });

  it('fails closed when response evidence contains another tenant', () => {
    const service = new AssignmentReminderReviewService(new MemoryReadModel([
      pending('r-1', 'tenant-b', 'a-1', 'p-1', '2026-08-27T05:00:00.000Z'),
    ], []));
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-1', capabilities: ['schedule.read'] });
    expect(() => service.list(context)).toThrow('Cross-tenant');
  });

  it('fails closed when reminder evidence contains another tenant', () => {
    const reminder = createAssignmentReminderRecord({ id: 'd-1', tenantId: 'tenant-b', assignmentId: 'a-1', recipientId: 'p-1', deliveryId: 'd-1', queuedAt: '2026-08-27T06:00:00.000Z' });
    const service = new AssignmentReminderReviewService(new MemoryReadModel([], [reminder]));
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-1', capabilities: ['schedule.read'] });
    expect(() => service.list(context)).toThrow('Cross-tenant');
  });
});

import { describe, expect, it } from 'vitest';
import {
  createAssignmentReminderRecord,
  createAssignmentResponse,
  type CongregationPerson,
} from '@eutaktos/domain';
import { assertReminderListRequest, buildReminderListPayload } from './reminders';

function person(tenantId = 'tenant-a'): CongregationPerson {
  return Object.freeze({
    id: 'person-1',
    tenantId,
    displayName: 'Ana Silva',
    active: true,
  }) as unknown as CongregationPerson;
}

describe('People reminders API contract', () => {
  it('projects only authoritative pending evidence with display name and exact last reminder', () => {
    const pending = createAssignmentResponse({
      id: 'response-1',
      tenantId: 'tenant-a',
      assignmentId: 'assignment-1',
      personId: 'person-1',
      now: '2026-08-27T06:00:00.000Z',
    });
    const reminder = createAssignmentReminderRecord({
      id: 'reminder-1',
      tenantId: 'tenant-a',
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      deliveryId: 'delivery-1',
      queuedAt: '2026-08-27T07:00:00.000Z',
    });

    expect(buildReminderListPayload({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      capabilities: ['schedule.read', 'people.read'],
      people: [person()],
      responses: [pending],
      reminders: [reminder],
    })).toEqual({
      contractVersion: 'people-reminders-v1',
      items: [{
        responseId: 'response-1',
        assignmentId: 'assignment-1',
        recipientId: 'person-1',
        displayName: 'Ana Silva',
        reason: 'awaiting-response',
        pendingSince: '2026-08-27T06:00:00.000Z',
        lastReminderAt: '2026-08-27T07:00:00.000Z',
      }],
    });
  });

  it('fails closed when person evidence crosses tenants', () => {
    const pending = createAssignmentResponse({
      id: 'response-1', tenantId: 'tenant-a', assignmentId: 'assignment-1', personId: 'person-1', now: '2026-08-27T06:00:00.000Z',
    });
    expect(() => buildReminderListPayload({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      capabilities: ['schedule.read', 'people.read'],
      people: [person('tenant-b')],
      responses: [pending],
      reminders: [],
    })).toThrow('Cross-tenant');
  });

  it('requires schedule.read at the application authority boundary', () => {
    expect(() => buildReminderListPayload({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      capabilities: ['people.read'],
      people: [],
      responses: [],
      reminders: [],
    })).toThrow();
  });

  it('rejects request bodies and query fields rather than accepting authority-shaped input', () => {
    expect(() => assertReminderListRequest({ query: { tenantId: 'tenant-a' }, body: undefined })).toThrow('does not accept query');
    expect(() => assertReminderListRequest({ query: {}, body: { actorId: 'admin-1' } })).toThrow('does not accept a request body');
    expect(() => assertReminderListRequest({ query: {}, body: undefined })).not.toThrow();
  });
});

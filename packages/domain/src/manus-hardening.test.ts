import { describe, expect, it } from 'vitest';
import { createDeliveryAttempt, transitionDeliveryStatus } from './notification-delivery';
import { createNoticeAcknowledgement, normalizeNoticeAcknowledgement } from './notice-acknowledgement';
import { serializeIcs } from './ics-calendar';
import { createGroundsSchedule, normalizeGroundsSchedule } from './grounds';
import { expandRecurrence } from './recurrence';
import { createTaskCompletion, normalizeTaskCompletion, reopenTaskCompletion } from './task-history';
import { createLiteratureRequest, normalizeLiteratureRequest } from './literature-requests';
import { createStandingRequest, normalizeStandingRequest } from './standing-literature';
import { createCongregationEvent, normalizeCongregationEvent } from './congregation-events';
import { createCustomSchedule, normalizeCustomSchedule } from './custom-schedules';
import { createCOVisit } from './co-visit';

const NOW = '2026-08-21T12:00:00.000Z';

describe('Manus integration hardening', () => {
  it('does not allow a delivery retry after the configured retry budget is exhausted', () => {
    let delivery = createDeliveryAttempt({
      id: 'd1', tenantId: 't1', idempotencyKey: 'k1', notificationPreferenceId: 'p1',
      recipientId: 'person-1', channel: 'in-app', templateKey: 'assignment.reminder', locale: 'en', now: NOW, maxRetries: 1,
    });
    delivery = transitionDeliveryStatus(delivery, 'processing', NOW);
    delivery = transitionDeliveryStatus(delivery, 'retryable_failure', '2026-08-21T12:01:00Z', 'temporary');
    expect(() => transitionDeliveryStatus(delivery, 'processing', '2026-08-21T12:02:00Z')).toThrow('Retry limit reached');
  });

  it('validates acknowledgement creation and chronology', () => {
    expect(() => createNoticeAcknowledgement({ id: 'a1', tenantId: 't1', noticeId: 'n1', personId: 'p1', now: 'bad' })).toThrow('Invalid ISO date');
    const ack = createNoticeAcknowledgement({ id: 'a1', tenantId: 't1', noticeId: 'n1', personId: 'p1', now: NOW });
    expect(() => normalizeNoticeAcknowledgement({ ...ack, acknowledgedAt: '2026-08-21T12:01:00Z' })).toThrow('must also be read');
  });

  it('folds ICS content lines by UTF-8 octets and rejects unsafe timezone identifiers', () => {
    const ics = serializeIcs({
      uid: 'event-1', summary: 'á'.repeat(80), start: '2026-08-22T19:00:00Z', end: '2026-08-22T20:00:00Z',
    });
    for (const line of ics.split('\r\n').filter(Boolean)) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(() => serializeIcs({
      uid: 'event-2', summary: 'Safe', start: '2026-08-22T19:00:00Z', end: '2026-08-22T20:00:00Z',
      timezone: 'Europe/Lisbon\r\nX-INJECTED:1',
    })).toThrow('Invalid timezone');
  });

  it('rejects invalid grounds windows during construction and normalization', () => {
    expect(() => createGroundsSchedule({
      id: 'g1', tenantId: 't1', area: 'Garden', scheduleReference: 's1', assigneeReferences: ['p1'],
      validFrom: '2026-09-01T00:00:00Z', validUntil: '2026-08-01T00:00:00Z', now: NOW,
    })).toThrow('validUntil');
    const valid = createGroundsSchedule({
      id: 'g1', tenantId: 't1', area: 'Garden', scheduleReference: 's1', assigneeReferences: ['p1'],
      validFrom: '2026-08-01T00:00:00Z', validUntil: null, now: NOW,
    });
    expect(() => normalizeGroundsSchedule({ ...valid, assigneeReferences: [] })).toThrow('At least one assignee');
  });

  it('produces recurrence dates from UTC calendar fields', () => {
    expect(expandRecurrence(
      { frequency: 'monthly', interval: 1, dayOfMonth: 31 },
      { from: '2026-01-01T00:00:00Z', until: '2026-03-31T23:59:59Z' },
    )).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('rejects task reopen timestamps before completion and corrupt persisted reopen state', () => {
    const completion = createTaskCompletion({ id: 'c1', tenantId: 't1', taskId: 'task', completedBy: 'p1', now: NOW });
    expect(() => reopenTaskCompletion(completion, 'p2', '2026-08-20T00:00:00Z')).toThrow('before completedAt');
    expect(() => normalizeTaskCompletion({ ...completion, status: 'reopened', reopenedAt: null, reopenedBy: null })).toThrow('requires reopenedAt');
  });

  it('revalidates literature request quantity and requester data from persistence', () => {
    const request = createLiteratureRequest({ id: 'l1', tenantId: 't1', requesterId: 'p1', itemCode: 'item', itemDescription: 'Item', quantity: 1, now: NOW });
    expect(() => normalizeLiteratureRequest({ ...request, quantity: 0 })).toThrow('quantity');
    expect(() => normalizeLiteratureRequest({ ...request, requesterId: '' })).toThrow('requesterId');
  });

  it('revalidates standing literature effective windows', () => {
    const request = createStandingRequest({
      id: 's1', tenantId: 't1', itemCode: 'item', quantity: 1,
      effectiveFrom: '2026-08-01T00:00:00Z', effectiveUntil: null, requesterId: 'p1', now: NOW,
    });
    expect(() => normalizeStandingRequest({ ...request, effectiveUntil: '2026-07-01T00:00:00Z' })).toThrow('effectiveUntil');
  });

  it('revalidates congregation-event visibility and text limits', () => {
    const event = createCongregationEvent({
      id: 'e1', tenantId: 't1', title: 'Event', description: 'Description', location: 'Hall',
      startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z', now: NOW,
    });
    expect(() => normalizeCongregationEvent({ ...event, visibilityFrom: 'bad' })).toThrow('Invalid ISO date');
  });

  it('rejects malformed custom-schedule calendar dates from creation and persistence', () => {
    const slot = { date: '2026-02-28', startsAt: '2026-02-28T10:00:00Z', endsAt: '2026-02-28T11:00:00Z', locationReference: null };
    const schedule = createCustomSchedule({ id: 's1', tenantId: 't1', scheduleType: 'custom_congregation', name: 'Custom', slots: [slot], now: NOW });
    expect(() => createCustomSchedule({ ...schedule, now: NOW, slots: [{ ...slot, date: '2026-02-31' }] })).toThrow('valid calendar date');
    expect(() => normalizeCustomSchedule({ ...schedule, slots: [{ ...slot, date: 'not-a-date' }] })).toThrow('YYYY-MM-DD');
  });

  it('rejects CO visit agenda slots that fall outside the visit window', () => {
    expect(() => createCOVisit({
      id: 'v1', tenantId: 't1', startsAt: '2026-09-05T14:00:00Z', endsAt: '2026-09-05T16:00:00Z',
      agendaSlots: [{ title: 'Early', startsAt: '2026-09-05T13:00:00Z', endsAt: '2026-09-05T14:00:00Z' }],
      locationReference: 'hall', now: NOW,
    })).toThrow('starts before the visit');
  });
});

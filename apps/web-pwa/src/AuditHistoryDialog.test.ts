import { describe, expect, it } from 'vitest';
import { auditLocalDateKey, filterAuditEvents } from './AuditHistoryDialog';
import type { AuditHistoryDto } from './lib/auditHistoryApi';

const events: readonly AuditHistoryDto[] = [
  { id: 'one', resourceType: 'person', resourceId: 'person-1', action: 'create', actorId: 'admin-a', occurredAt: '2026-02-03T10:00:00.000Z', changedFields: ['name'] },
  { id: 'two', resourceType: 'access-grant', resourceId: 'grant-1', action: 'grant', actorId: 'admin-b', occurredAt: '2026-02-05T10:00:00.000Z', changedFields: ['capability'] },
  { id: 'three', resourceType: 'person', resourceId: 'person-2', action: 'update', actorId: 'admin-a', occurredAt: '2026-02-04T10:00:00.000Z', changedFields: [] },
  { id: 'four', resourceType: 'midweek-meeting', resourceId: 'meeting-1', action: 'update', actorId: 'admin-a', occurredAt: '2026-08-21T23:30:00.000Z', changedFields: ['state'] },
];
const noFilters = { resourceType: '' as const, action: '' as const, actorId: '', from: '', to: '' };

describe('AuditHistoryDialog local filters', () => {
  it('filters only the loaded events and presents them newest first', () => {
    expect(filterAuditEvents(events, noFilters, 'UTC').map(event => event.id)).toEqual(['four', 'two', 'three', 'one']);
    expect(filterAuditEvents(events, { ...noFilters, resourceType: 'person' }, 'UTC').map(event => event.id)).toEqual(['three', 'one']);
    expect(filterAuditEvents(events, { ...noFilters, action: 'grant', actorId: 'ADMIN-B' }, 'UTC').map(event => event.id)).toEqual(['two']);
  });

  it('filters loaded events by inclusive local date range', () => {
    expect(filterAuditEvents(events, { ...noFilters, from: '2026-02-04', to: '2026-02-04' }, 'Europe/Lisbon').map(event => event.id)).toEqual(['three']);
  });

  it('uses the requested local timezone rather than the UTC calendar date', () => {
    expect(auditLocalDateKey('2026-08-21T23:30:00.000Z', 'Europe/Lisbon')).toBe('2026-08-22');
    expect(filterAuditEvents(events, { ...noFilters, from: '2026-08-22', to: '2026-08-22' }, 'Europe/Lisbon').map(event => event.id)).toEqual(['four']);
    expect(filterAuditEvents(events, { ...noFilters, from: '2026-08-21', to: '2026-08-21' }, 'Europe/Lisbon').map(event => event.id)).not.toContain('four');
  });

  it('filters newly supported scheduling audit resources', () => {
    expect(filterAuditEvents(events, { ...noFilters, resourceType: 'midweek-meeting' }, 'UTC').map(event => event.id)).toEqual(['four']);
  });
});

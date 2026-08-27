import { describe, expect, it } from 'vitest';
import type { AssignmentHistoryRecord } from '@eutaktos/domain';
import { parseRecordCardsPeriod, projectRecordCards } from './record-cards';

const history: readonly AssignmentHistoryRecord[] = Object.freeze([
  Object.freeze({ id: 'h2', tenantId: 'tenant-a', assignmentId: 'a2', personId: 'p1', partType: 'talk', meetingDate: '2026-03-20', state: 'completed', recordedAt: '2026-03-20T20:00:00.000Z', meetingId: 'm2' }),
  Object.freeze({ id: 'h1', tenantId: 'tenant-a', assignmentId: 'a1', personId: 'p1', partType: 'reading', meetingDate: '2026-03-10', state: 'completed', recordedAt: '2026-03-10T20:00:00.000Z', meetingId: 'm1' }),
  Object.freeze({ id: 'h3', tenantId: 'tenant-a', assignmentId: 'a3', personId: 'p2', partType: 'reading', meetingDate: '2025-12-31', state: 'completed', recordedAt: '2025-12-31T20:00:00.000Z', meetingId: 'm3' }),
]);

function request(query: Record<string, string | string[] | undefined>) { return { query }; }

describe('PX9.5 record cards contract', () => {
  it('supports year or bounded inclusive custom periods', () => {
    expect(parseRecordCardsPeriod(request({ year: '2026' }))).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(parseRecordCardsPeriod(request({ from: '2026-03-01', to: '2026-03-31' }))).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('rejects ambiguous, malformed, repeated and excessive selectors', () => {
    expect(() => parseRecordCardsPeriod(request({ year: '2026', from: '2026-01-01', to: '2026-12-31' }))).toThrow('cannot be combined');
    expect(() => parseRecordCardsPeriod(request({ from: '2026-01-01' }))).toThrow('Supply year or both');
    expect(() => parseRecordCardsPeriod(request({ year: ['2026', '2027'] }))).toThrow('must not be repeated');
    expect(() => parseRecordCardsPeriod(request({ from: '2026-12-31', to: '2026-01-01' }))).toThrow('must not be after');
    expect(() => parseRecordCardsPeriod(request({ from: '2024-01-01', to: '2025-01-01' }))).toThrow('cannot exceed 366 days');
    expect(() => parseRecordCardsPeriod(request({ year: '2026', personName: 'Ana' }))).toThrow('Unknown record cards query field');
  });

  it('projects only completed-history facts inside the period and removes internal identities', () => {
    const cards = projectRecordCards(
      [{ id: 'p2', displayName: 'Bruno' }, { id: 'p1', displayName: 'Ana' }],
      history,
      { from: '2026-01-01', to: '2026-12-31' },
    );
    expect(cards).toEqual([{ personId: 'p1', displayName: 'Ana', records: [
      { meetingDate: '2026-03-10', partType: 'reading' },
      { meetingDate: '2026-03-20', partType: 'talk' },
    ] }]);
    const publicJson = JSON.stringify(cards);
    for (const forbidden of ['tenantId', 'assignmentId', 'meetingId', 'recordedAt', 'phone', 'email', 'emergencyContacts']) expect(publicJson).not.toContain(forbidden);
  });

  it('fails closed when completed history references a missing person', () => {
    expect(() => projectRecordCards([], [history[0]!], { from: '2026-01-01', to: '2026-12-31' })).toThrow('missing person');
  });
});
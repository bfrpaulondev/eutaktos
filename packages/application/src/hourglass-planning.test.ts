import { describe, expect, it } from 'vitest';
import { lastAssignmentRows, manualPlanningCandidates } from './hourglass-planning';
import type { AssignmentHistoryRecord, CongregationPerson } from '@eutaktos/domain';

const people: readonly CongregationPerson[] = [
  { id: 'person-a', tenantId: 'tenant-a', displayName: 'Ana Exemplo', active: true, availability: [], eligibility: [{ assignmentTypeId: 'hourglass:reading', enabled: true, decidedBy: 'elder', decidedAt: '2026-01-01T00:00:00.000Z' }] },
  { id: 'person-b', tenantId: 'tenant-a', displayName: 'Bruno Exemplo', active: true, availability: [{ id: 'away-1', startsAt: '2026-09-01T19:00:00.000Z', endsAt: '2026-09-01T20:00:00.000Z', reasonCode: 'away' }], eligibility: [{ assignmentTypeId: 'hourglass:reading', enabled: true, decidedBy: 'elder', decidedAt: '2026-01-01T00:00:00.000Z' }] },
  { id: 'person-c', tenantId: 'tenant-a', displayName: 'Carla Exemplo', active: true, availability: [], eligibility: [] },
];
const history: readonly AssignmentHistoryRecord[] = [
  { id: 'history-1', tenantId: 'tenant-a', assignmentId: 'assignment-1', personId: 'person-a', partType: 'hourglass:reading', meetingDate: '2026-08-01', state: 'completed', recordedAt: '2026-08-01T20:00:00.000Z', meetingId: 'meeting-1' },
  { id: 'history-2', tenantId: 'tenant-a', assignmentId: 'assignment-2', personId: 'person-b', partType: 'hourglass:reading', meetingDate: '2026-08-20', state: 'cancelled', recordedAt: '2026-08-20T20:00:00.000Z', meetingId: 'meeting-2' },
];

describe('Hourglass operational planning helpers', () => {
  it('shows objective recency and keeps never assigned distinct from cancelled/unknown data', () => {
    const rows = lastAssignmentRows({ tenantId: 'tenant-a', partType: 'hourglass:reading', referenceDate: '2026-09-01', people, history });
    expect(rows.map(row => ({ id: row.personId, never: row.neverAssigned, date: row.lastAssignedOn, days: row.daysSinceLastAssignment }))).toEqual([
      { id: 'person-b', never: true, date: undefined, days: undefined },
      { id: 'person-c', never: true, date: undefined, days: undefined },
      { id: 'person-a', never: false, date: '2026-08-01', days: 31 },
    ]);
  });

  it('filters only with explicit eligibility, availability and real conflicts without selecting anyone', () => {
    const candidates = manualPlanningCandidates({ tenantId: 'tenant-a', assignmentTypeId: 'hourglass:reading', partType: 'hourglass:reading', referenceDate: '2026-09-01', startsAt: '2026-09-01T19:15:00.000Z', endsAt: '2026-09-01T19:45:00.000Z', people, history, existingAssignments: [] });
    expect(candidates.map(candidate => ({ id: candidate.personId, eligible: candidate.explicitlyEligible, selectable: candidate.selectable, conflicts: candidate.conflicts.length }))).toEqual([
      { id: 'person-a', eligible: true, selectable: true, conflicts: 0 },
      { id: 'person-b', eligible: true, selectable: false, conflicts: 1 },
      { id: 'person-c', eligible: false, selectable: false, conflicts: 0 },
    ]);
    expect(candidates.every(candidate => !Object.hasOwn(candidate, 'recommended'))).toBe(true);
  });

  it('rejects impossible calendar dates instead of allowing Date rollover', () => {
    expect(() => lastAssignmentRows({ tenantId: 'tenant-a', partType: 'hourglass:reading', referenceDate: '2025-02-30', people, history })).toThrow('valid YYYY-MM-DD');
    expect(() => lastAssignmentRows({ tenantId: 'tenant-a', partType: 'hourglass:reading', referenceDate: '2026-02-29', people, history })).toThrow('valid YYYY-MM-DD');
    expect(() => lastAssignmentRows({ tenantId: 'tenant-a', partType: 'hourglass:reading', referenceDate: '2024-02-29', people, history })).not.toThrow();
  });
});

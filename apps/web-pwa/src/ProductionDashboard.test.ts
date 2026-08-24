import { describe, expect, it } from 'vitest';
import { buildProductionDashboardSummary } from './ProductionDashboard';

describe('buildProductionDashboardSummary', () => {
  it('summarizes only active production records and finds the next meeting', () => {
    const result = buildProductionDashboardSummary(
      [
        { id: 'p1', displayName: 'One', active: true },
        { id: 'p2', displayName: 'Two', active: false },
      ],
      [
        { id: 'r1', personId: 'p1', responsibilityKey: 'a', startsAt: '2026-08-01T00:00:00.000Z' },
        { id: 'r2', personId: 'p1', responsibilityKey: 'b', startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-20T00:00:00.000Z' },
      ],
      {
        meetings: [
          { id: 'm2', date: '2026-08-31', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'draft', slots: [] },
          { id: 'm1', date: '2026-08-24', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'published', slots: [] },
        ],
        studentAssignments: [
          { id: 's1', meetingId: 'm1', slotId: 'x', studentId: 'p1', studentDisplayName: 'One', assistantId: null, assistantDisplayName: null, state: 'assigned' },
        ],
        nonStudentAssignments: [
          { id: 'n1', meetingId: 'm1', slotId: 'x', personId: 'p1', personDisplayName: 'One', role: 'chairman', state: 'cancelled' },
        ],
      },
      new Date('2026-08-24T10:00:00+01:00'),
    );

    expect(result.activePeople).toBe(1);
    expect(result.activeResponsibilities).toBe(1);
    expect(result.assignedParts).toBe(1);
    expect(result.nextMeeting).toEqual({ date: '2026-08-24', localTime: '19:30', state: 'published' });
  });
});

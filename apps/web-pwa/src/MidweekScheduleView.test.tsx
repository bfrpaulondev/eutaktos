import { describe, it, expect } from 'vitest';
import {
  parseCandidateQueryResult,
  parseScheduleMeetingView,
} from './lib/midweekApi';

describe('MidweekScheduleView API parsing (locale-independent)', () => {
  it('parses a candidate query result with all reason kinds', () => {
    const result = parseCandidateQueryResult({
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      role: 'student',
      assignmentTypeId: 'part:treasures',
      window: { startsAt: '2026-09-01T18:00:00Z', endsAt: '2026-09-01T18:30:00Z' },
      candidates: [
        {
          personId: 'p1',
          displayName: 'João',
          role: 'student',
          eligible: true,
          available: true,
          inactive: false,
          conflicts: [],
          lastAssignmentDate: '2026-08-15',
          daysSinceLastAssignment: 14,
          recentAssignmentCount: 1,
          alreadyAssignedInMeeting: false,
          reasons: [
            { kind: 'long_time_since_assignment', messageKey: 'midweek.candidates.reason.longTimeSinceAssignment', params: { weeks: 2 } },
            { kind: 'low_recent_assignment_load', messageKey: 'midweek.candidates.reason.lowRecentAssignmentLoad', params: { count: 0 } },
          ],
        },
        {
          personId: 'p2',
          displayName: 'Pedro',
          role: 'student',
          eligible: false,
          available: true,
          inactive: false,
          conflicts: [],
          lastAssignmentDate: null,
          daysSinceLastAssignment: null,
          recentAssignmentCount: 0,
          alreadyAssignedInMeeting: false,
          reasons: [],
        },
        {
          personId: 'p3',
          displayName: 'Miguel',
          role: 'student',
          eligible: true,
          available: false,
          inactive: false,
          conflicts: [{ kind: 'assignment-overlap', sourceId: 'existing:student' }],
          lastAssignmentDate: '2026-08-20',
          daysSinceLastAssignment: 9,
          recentAssignmentCount: 2,
          alreadyAssignedInMeeting: true,
          reasons: [{ kind: 'already_assigned_in_meeting', messageKey: 'midweek.candidates.reason.alreadyAssignedInMeeting', params: {} }],
        },
      ],
    });
    expect(result.candidates.length).toBe(3);
    expect(result.candidates[0].reasons.length).toBe(2);
    expect(result.candidates[1].eligible).toBe(false);
    expect(result.candidates[2].conflicts.length).toBe(1);
    expect(result.candidates[2].conflicts[0].kind).toBe('assignment-overlap');
  });

  it('parses schedule view with vacancies and conflicts', () => {
    const result = parseScheduleMeetingView({
      meetingId: 'meeting-1',
      date: '2026-09-01',
      localTime: '19:00',
      timezone: 'Europe/Lisbon',
      state: 'draft',
      slots: [
        {
          slotId: 'slot-1',
          position: 0,
          titleKey: 'midweek.parts.treasures',
          durationMinutes: 10,
          partDefinitionId: 'part:treasures',
          studentDisplayName: null,
          assistantDisplayName: null,
          nonStudentDisplayName: null,
          nonStudentRole: null,
          hasConflict: false,
          state: 'vacant',
        },
        {
          slotId: 'slot-2',
          position: 1,
          titleKey: 'midweek.parts.openingRemarks',
          durationMinutes: 5,
          studentDisplayName: 'João',
          assistantDisplayName: null,
          nonStudentDisplayName: null,
          nonStudentRole: null,
          hasConflict: false,
          state: 'filled',
        },
        {
          slotId: 'slot-3',
          position: 2,
          titleKey: 'midweek.parts.livingAsChristians',
          durationMinutes: 30,
          studentDisplayName: 'Pedro',
          assistantDisplayName: 'Miguel',
          nonStudentDisplayName: null,
          nonStudentRole: null,
          hasConflict: true,
          state: 'conflict',
        },
      ],
      totalSlots: 3,
      filledSlots: 1,
      vacantSlots: 1,
      conflictedSlots: 1,
    });
    expect(result.totalSlots).toBe(3);
    expect(result.filledSlots).toBe(1);
    expect(result.vacantSlots).toBe(1);
    expect(result.conflictedSlots).toBe(1);
    expect(result.slots.find(s => s.slotId === 'slot-3')?.studentDisplayName).toBe('Pedro');
    expect(result.slots.find(s => s.slotId === 'slot-3')?.assistantDisplayName).toBe('Miguel');
    expect(result.slots.find(s => s.slotId === 'slot-3')?.hasConflict).toBe(true);
  });
});

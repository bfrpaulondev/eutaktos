import { describe, it, expect } from 'vitest';
import {
  parseCandidateQueryResult,
  parseScheduleMeetingView,
} from './midweekApi';

describe('midweekApi — parseCandidateQueryResult', () => {
  it('parses a valid candidate query result', () => {
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
          ],
        },
      ],
    });
    expect(result.meetingId).toBe('meeting-1');
    expect(result.role).toBe('student');
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].personId).toBe('p1');
    expect(result.candidates[0].eligible).toBe(true);
    expect(result.candidates[0].lastAssignmentDate).toBe('2026-08-15');
    expect(result.candidates[0].reasons.length).toBe(1);
    expect(result.candidates[0].reasons[0].messageKey).toBe('midweek.candidates.reason.longTimeSinceAssignment');
  });

  it('throws on invalid role', () => {
    expect(() => parseCandidateQueryResult({
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      role: 'invalid',
      assignmentTypeId: 'part:treasures',
      window: { startsAt: '2026-09-01T18:00:00Z', endsAt: '2026-09-01T18:30:00Z' },
      candidates: [],
    })).toThrow('Invalid candidate role');
  });

  it('handles null lastAssignmentDate and daysSinceLastAssignment', () => {
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
          lastAssignmentDate: null,
          daysSinceLastAssignment: null,
          recentAssignmentCount: 0,
          alreadyAssignedInMeeting: false,
          reasons: [],
        },
      ],
    });
    expect(result.candidates[0].lastAssignmentDate).toBeNull();
    expect(result.candidates[0].daysSinceLastAssignment).toBeNull();
  });
});

describe('midweekApi — parseScheduleMeetingView', () => {
  it('parses a valid schedule meeting view', () => {
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
      ],
      totalSlots: 1,
      filledSlots: 0,
      vacantSlots: 1,
      conflictedSlots: 0,
    });
    expect(result.meetingId).toBe('meeting-1');
    expect(result.state).toBe('draft');
    expect(result.slots.length).toBe(1);
    expect(result.slots[0].state).toBe('vacant');
    expect(result.vacantSlots).toBe(1);
  });

  it('throws on invalid slot state', () => {
    expect(() => parseScheduleMeetingView({
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
          studentDisplayName: null,
          assistantDisplayName: null,
          nonStudentDisplayName: null,
          nonStudentRole: null,
          hasConflict: false,
          state: 'invalid',
        },
      ],
      totalSlots: 1,
      filledSlots: 0,
      vacantSlots: 1,
      conflictedSlots: 0,
    })).toThrow('Invalid slot state');
  });
});

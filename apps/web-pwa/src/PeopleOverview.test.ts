import { describe, expect, it } from 'vitest';
import {
  buildPeopleOverviewSummary,
  classifyPeopleOverviewProblem,
  isCurrentPeopleOverviewRequest,
} from './PeopleOverview';
import type { MidweekOverviewDto } from './lib/midweekApi';
import type { PersonProfileDto } from './lib/peopleApi';

const people: readonly PersonProfileDto[] = [
  { id: 'person-1', displayName: 'Ana Martins', active: true },
  { id: 'person-2', displayName: 'Bruno Silva', active: true },
  { id: 'person-3', displayName: 'Carla Stone', active: false },
];

const midweek: MidweekOverviewDto = {
  meetings: [
    { id: 'future-meeting', date: '2030-05-15', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'published', slots: [] },
    { id: 'past-meeting', date: '2030-04-15', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'published', slots: [] },
  ],
  studentAssignments: [
    { id: 'student-affected', meetingId: 'future-meeting', slotId: 'slot-1', studentId: 'person-1', studentDisplayName: 'Ana Martins', assistantId: null, assistantDisplayName: null, state: 'assigned' },
    { id: 'student-completed', meetingId: 'future-meeting', slotId: 'slot-2', studentId: 'person-2', studentDisplayName: 'Bruno Silva', assistantId: null, assistantDisplayName: null, state: 'completed' },
  ],
  nonStudentAssignments: [
    { id: 'non-student-affected', meetingId: 'future-meeting', slotId: 'slot-3', personId: 'person-2', personDisplayName: 'Bruno Silva', role: 'chairman', state: 'assigned' },
    { id: 'past-assignment', meetingId: 'past-meeting', slotId: 'slot-4', personId: 'person-3', personDisplayName: 'Carla Stone', role: 'reader', state: 'assigned' },
  ],
};

describe('People Overview summary', () => {
  it('uses the people and scheduling contracts without inventing metrics or alerts', () => {
    const summary = buildPeopleOverviewSummary(people, midweek, new Map([
      ['person-1', [{ id: 'away-1', startsAt: '2030-05-14', endsAt: '2030-05-16', reasonCode: 'away' }]],
      ['person-2', [{ id: 'unavailable-1', startsAt: '2030-05-15', endsAt: '2030-05-16', reasonCode: 'unavailable' }]],
      ['person-3', [{ id: 'other-1', startsAt: '2030-04-14', endsAt: '2030-04-16', reasonCode: 'other' }]],
    ]), new Date('2030-05-01T00:00:00.000Z'));

    expect(summary.totalPeople).toBe(3);
    expect(summary.activePeople).toBe(2);
    expect(summary.affectedPeople).toEqual([
      expect.objectContaining({ assignmentId: 'student-affected', personId: 'person-1', meetingId: 'future-meeting' }),
      expect.objectContaining({ assignmentId: 'non-student-affected', personId: 'person-2', meetingId: 'future-meeting' }),
    ]);
  });

  it('does not report an affected assignment when the availability condition is not explicit', () => {
    const summary = buildPeopleOverviewSummary(people, midweek, new Map([
      ['person-1', [{ id: 'other-1', startsAt: '2030-05-14', endsAt: '2030-05-16', reasonCode: 'other' }]],
      ['person-2', [{ id: 'ended-1', startsAt: '2030-05-10', endsAt: '2030-05-15', reasonCode: 'away' }]],
    ]), new Date('2030-05-01T00:00:00.000Z'));

    expect(summary.affectedPeople).toEqual([]);
  });
});

describe('People Overview request ownership and failures', () => {
  it('accepts only the latest non-aborted request', () => {
    expect(isCurrentPeopleOverviewRequest(4, 4, false)).toBe(true);
    expect(isCurrentPeopleOverviewRequest(3, 4, false)).toBe(false);
    expect(isCurrentPeopleOverviewRequest(4, 4, true)).toBe(false);
  });

  it('distinguishes authentication, authorization, retryable and invalid-response states', () => {
    expect(classifyPeopleOverviewProblem(new Error('People API request failed (401)'))).toBe('unauthenticated');
    expect(classifyPeopleOverviewProblem(new Error('People API request failed (403)'))).toBe('forbidden');
    expect(classifyPeopleOverviewProblem(new Error('People API request failed (429)'))).toBe('non-retryable');
    expect(classifyPeopleOverviewProblem(new Error('People API request failed (500)'))).toBe('retryable');
    expect(classifyPeopleOverviewProblem(new Error('Invalid People API response'))).toBe('retryable');
  });
});

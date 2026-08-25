import { describe, expect, it } from 'vitest';
import {
  buildPeopleOverviewSummary,
  classifyPeopleOverviewProblem,
  countServiceGroups,
  isCurrentPeopleOverviewRequest,
  localDateKey,
} from './PeopleOverview';
import type { MidweekOverviewDto } from './lib/midweekApi';
import type { PersonProfileDto } from './lib/peopleApi';
import type { ServiceGroupDto } from './lib/serviceGroupsApi';

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
  it('counts only the service groups returned by the authorized API contract', () => {
    const groups: readonly ServiceGroupDto[] = [
      { id: 'group-1', name: 'Centro', memberIds: ['person-1'] },
      { id: 'group-2', name: 'Norte', memberIds: [] },
    ];

    expect(countServiceGroups(groups)).toBe(2);
    expect(countServiceGroups([])).toBe(0);
  });

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

  it('treats every explicit availability interval as unavailable regardless of reasonCode', () => {
    const summary = buildPeopleOverviewSummary(people, midweek, new Map([
      ['person-1', [{ id: 'other-1', startsAt: '2030-05-14', endsAt: '2030-05-16', reasonCode: 'other' }]],
      ['person-2', [{ id: 'ended-1', startsAt: '2030-05-10', endsAt: '2030-05-15', reasonCode: 'away' }]],
    ]), new Date('2030-05-01T00:00:00.000Z'));

    expect(summary.affectedPeople).toEqual([
      expect.objectContaining({ assignmentId: 'student-affected', personId: 'person-1', meetingId: 'future-meeting' }),
    ]);
  });

  it('uses the meeting timezone rather than UTC to decide whether the meeting date is still current', () => {
    const timezoneMidweek: MidweekOverviewDto = {
      ...midweek,
      meetings: [{ id: 'future-meeting', date: '2030-05-15', localTime: '19:30', timezone: 'America/New_York', state: 'published', slots: [] }],
      nonStudentAssignments: [],
    };
    const now = new Date('2030-05-16T02:00:00.000Z'); // still 2030-05-15 in New York
    expect(localDateKey(now, 'America/New_York')).toBe('2030-05-15');

    const summary = buildPeopleOverviewSummary(people, timezoneMidweek, new Map([
      ['person-1', [{ id: 'other-1', startsAt: '2030-05-15', endsAt: '2030-05-16', reasonCode: 'other' }]],
    ]), now);

    expect(summary.affectedPeople).toEqual([
      expect.objectContaining({ assignmentId: 'student-affected', personId: 'person-1', meetingId: 'future-meeting' }),
    ]);
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
    expect(classifyPeopleOverviewProblem(new Error('People API request failed (429)'))).toBe('retryable');
    expect(classifyPeopleOverviewProblem(new Error('People API request failed (422)'))).toBe('non-retryable');
    expect(classifyPeopleOverviewProblem(new Error('People API request failed (500)'))).toBe('retryable');
    expect(classifyPeopleOverviewProblem(new Error('Invalid People API response'))).toBe('retryable');
  });
});
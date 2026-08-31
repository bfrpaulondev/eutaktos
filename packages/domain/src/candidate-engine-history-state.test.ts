import { describe, expect, it } from 'vitest';
import { computeCandidate, type CandidateQueryInput } from './candidate-engine';
import type { AssignmentHistoryRecord } from './assignment-history';
import type { CongregationPerson } from './people';

const tenantId = 'tenant-a';
const person: CongregationPerson = {
  id: 'person-1',
  tenantId,
  displayName: 'Pessoa Um',
  active: true,
  availability: [],
  eligibility: [{ assignmentTypeId: 'part:treasures', enabled: true, decidedBy: 'actor-1', decidedAt: '2026-01-01T00:00:00.000Z' }],
};

function history(overrides: Partial<AssignmentHistoryRecord>): AssignmentHistoryRecord {
  return {
    id: 'history-1',
    tenantId,
    assignmentId: 'assignment-1',
    personId: person.id,
    partType: 'student:part:treasures',
    meetingId: 'meeting-1',
    meetingDate: '2026-08-01',
    state: 'completed',
    recordedAt: '2026-08-01T20:00:00.000Z',
    ...overrides,
  };
}

const input: CandidateQueryInput = {
  tenantId,
  role: 'student',
  assignmentTypeId: 'part:treasures',
  referenceDate: '2026-08-29',
  startsAt: '2026-09-01T19:00:00.000Z',
  endsAt: '2026-09-01T19:10:00.000Z',
  personsInSameMeeting: new Set(),
  existingAssignments: [],
  people: [person],
  history: [],
};

describe('candidate engine effective history', () => {
  it('ignores completed history from another role/part type', () => {
    const candidate = computeCandidate(person, {
      ...input,
      history: [history({ partType: 'student:part:bible-reading', meetingDate: '2026-08-20' })],
    });
    expect(candidate.lastAssignmentDate).toBeNull();
    expect(candidate.recentAssignmentCount).toBe(0);
  });

  it('treats a past assigned fact as historical when it was not cancelled', () => {
    const candidate = computeCandidate(person, {
      ...input,
      history: [history({ state: 'assigned', meetingDate: '2026-08-15' })],
    });
    expect(candidate.lastAssignmentDate).toBe('2026-08-15');
    expect(candidate.daysSinceLastAssignment).toBe(14);
  });

  it('uses the latest state for the same assignment and excludes a cancelled assignment', () => {
    const candidate = computeCandidate(person, {
      ...input,
      history: [
        history({ id: 'history-assigned', state: 'assigned', recordedAt: '2026-08-10T18:00:00.000Z', meetingDate: '2026-08-15' }),
        history({ id: 'history-cancelled', state: 'cancelled', recordedAt: '2026-08-11T18:00:00.000Z', meetingDate: '2026-08-15' }),
      ],
    });
    expect(candidate.lastAssignmentDate).toBeNull();
    expect(candidate.recentAssignmentCount).toBe(0);
  });
});

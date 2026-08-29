import { describe, expect, it } from 'vitest';
import { computeCandidate, type CandidateQueryInput } from './candidate-engine';
import type { AssignmentHistoryRecord } from './assignment-history';
import type { CongregationPerson } from './people';

const person: CongregationPerson = {
  id: 'person-1',
  tenantId: 'tenant-a',
  displayName: 'João Silva',
  active: true,
  availability: [],
  eligibility: [
    { assignmentTypeId: 'part:target', enabled: true, decidedBy: 'elder-1', decidedAt: '2026-01-01T00:00:00Z' },
  ],
};

const input: CandidateQueryInput = {
  tenantId: 'tenant-a',
  role: 'student',
  assignmentTypeId: 'part:target',
  referenceDate: '2026-08-29',
  startsAt: '2026-09-01T19:00:00Z',
  endsAt: '2026-09-01T19:30:00Z',
  recentWindowDays: 90,
  personsInSameMeeting: new Set(),
  existingAssignments: [],
  people: [person],
  history: [],
};

function history(id: string, partType: string, meetingDate: string): AssignmentHistoryRecord {
  return {
    id,
    tenantId: 'tenant-a',
    assignmentId: `assignment-${id}`,
    personId: 'person-1',
    partType,
    meetingId: `meeting-${id}`,
    meetingDate,
    state: 'completed',
    recordedAt: `${meetingDate}T20:00:00Z`,
  };
}

describe('candidate recency by assignment type and participant role', () => {
  it('ignores a newer assignment of another type when calculating last assignment', () => {
    const candidate = computeCandidate(person, {
      ...input,
      history: [
        history('target-old', 'part:target', '2026-05-01'),
        history('other-new', 'part:other', '2026-08-20'),
      ],
    });
    expect(candidate.lastAssignmentDate).toBe('2026-05-01');
    expect(candidate.daysSinceLastAssignment).toBe(120);
  });

  it('counts recent load only for the requested assignment type', () => {
    const candidate = computeCandidate(person, {
      ...input,
      history: [
        history('target-1', 'part:target', '2026-08-10'),
        history('other-1', 'part:other', '2026-08-15'),
        history('other-2', 'part:other', '2026-08-20'),
      ],
    });
    expect(candidate.recentAssignmentCount).toBe(1);
  });

  it('does not mix assistant history with student history for the same part', () => {
    const candidate = computeCandidate(person, {
      ...input,
      role: 'student',
      history: [
        history('student-old', 'student:part:target', '2026-05-01'),
        history('assistant-new', 'assistant:part:target', '2026-08-20'),
      ],
    });
    expect(candidate.lastAssignmentDate).toBe('2026-05-01');
    expect(candidate.recentAssignmentCount).toBe(0);
  });

  it('does not mix student history with assistant history for the same part', () => {
    const candidate = computeCandidate(person, {
      ...input,
      role: 'assistant',
      history: [
        history('assistant-old', 'assistant:part:target', '2026-06-01'),
        history('student-new', 'student:part:target', '2026-08-20'),
      ],
    });
    expect(candidate.lastAssignmentDate).toBe('2026-06-01');
  });
});

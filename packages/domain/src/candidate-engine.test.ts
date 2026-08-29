import { describe, it, expect } from 'vitest';
import {
  computeCandidate,
  computeCandidates,
  selectValidCandidates,
  assertCandidateTenant,
  type CandidateQueryInput,
  type CandidateProfile,
} from './candidate-engine';
import type { CongregationPerson } from './people';
import type { AssignmentHistoryRecord } from './assignment-history';
import type { ConflictAssignment } from './conflict-engine';

function makePerson(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-a',
    displayName: 'João Silva',
    active: true,
    availability: [],
    eligibility: [
      { assignmentTypeId: 'part:treasures', enabled: true, decidedBy: 'elder-1', decidedAt: '2026-01-01T00:00:00Z' },
    ],
    ...overrides,
  };
}

function makeHistory(overrides: Partial<AssignmentHistoryRecord> = {}): AssignmentHistoryRecord {
  return {
    id: 'hist-1',
    tenantId: 'tenant-a',
    assignmentId: 'asg-1',
    personId: 'person-1',
    partType: 'part:treasures',
    meetingDate: '2026-08-01',
    state: 'completed',
    recordedAt: '2026-08-01T20:00:00Z',
    meetingId: 'meeting-1',
    ...overrides,
  };
}

const BASE_INPUT: CandidateQueryInput = {
  tenantId: 'tenant-a',
  role: 'student',
  assignmentTypeId: 'part:treasures',
  referenceDate: '2026-08-29',
  startsAt: '2026-09-01T19:00:00Z',
  endsAt: '2026-09-01T19:30:00Z',
  recentWindowDays: 90,
  personsInSameMeeting: new Set<string>(),
  existingAssignments: [],
  people: [makePerson()],
  history: [],
};

describe('candidate-engine — computeCandidate', () => {
  it('returns eligible + available + no-conflict candidate', () => {
    const candidate = computeCandidate(makePerson(), BASE_INPUT);
    expect(candidate.eligible).toBe(true);
    expect(candidate.available).toBe(true);
    expect(candidate.inactive).toBe(false);
    expect(candidate.conflicts).toEqual([]);
    expect(candidate.role).toBe('student');
    expect(candidate.tenantId).toBe('tenant-a');
  });

  it('returns eligible=false when eligibility is not configured (never infers)', () => {
    const person = makePerson({ eligibility: [] });
    const candidate = computeCandidate(person, BASE_INPUT);
    expect(candidate.eligible).toBe(false);
    // Critical: no suggestion reasons are added when ineligible.
    expect(candidate.reasons).toEqual([]);
  });

  it('returns inactive=true when person is inactive', () => {
    const person = makePerson({ active: false });
    const candidate = computeCandidate(person, BASE_INPUT);
    expect(candidate.inactive).toBe(true);
    expect(candidate.available).toBe(false);
    // Has the inactive reason, never an availability suggestion.
    expect(candidate.reasons.some(r => r.kind === 'inactive')).toBe(true);
  });

  it('returns available=false when unavailable period overlaps window', () => {
    const person = makePerson({
      availability: [
        { id: 'away-1', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-02T00:00:00Z', reasonCode: 'away' },
      ],
    });
    const candidate = computeCandidate(person, BASE_INPUT);
    expect(candidate.available).toBe(false);
    expect(candidate.reasons.some(r => r.kind === 'unavailable_period')).toBe(true);
  });

  it('returns available=true when unavailable period does not overlap window', () => {
    const person = makePerson({
      availability: [
        { id: 'away-1', startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-08-15T00:00:00Z', reasonCode: 'away' },
      ],
    });
    const candidate = computeCandidate(person, BASE_INPUT);
    expect(candidate.available).toBe(true);
  });

  it('detects assignment overlap conflict when same person has overlapping existing assignment', () => {
    const existing: ConflictAssignment[] = [
      {
        tenantId: 'tenant-a',
        assignmentId: 'existing-1:student',
        personId: 'person-1',
        startsAt: '2026-09-01T19:10:00Z',
        endsAt: '2026-09-01T19:40:00Z',
      },
    ];
    const candidate = computeCandidate(makePerson(), { ...BASE_INPUT, existingAssignments: existing });
    expect(candidate.conflicts.length).toBe(1);
    expect(candidate.conflicts[0].kind).toBe('assignment-overlap');
    expect(candidate.conflicts[0].sourceId).toBe('existing-1:student');
  });

  it('does not flag conflict when overlap is with another person', () => {
    const existing: ConflictAssignment[] = [
      {
        tenantId: 'tenant-a',
        assignmentId: 'existing-1:student',
        personId: 'person-other',
        startsAt: '2026-09-01T19:10:00Z',
        endsAt: '2026-09-01T19:40:00Z',
      },
    ];
    const candidate = computeCandidate(makePerson(), { ...BASE_INPUT, existingAssignments: existing });
    expect(candidate.conflicts).toEqual([]);
  });

  it('computes recency from history (lastAssignmentDate, daysSince)', () => {
    const history: AssignmentHistoryRecord[] = [
      makeHistory({ personId: 'person-1', meetingDate: '2026-08-15', partType: 'part:treasures' }),
    ];
    const candidate = computeCandidate(makePerson(), { ...BASE_INPUT, history, referenceDate: '2026-08-29' });
    expect(candidate.lastAssignmentDate).toBe('2026-08-15');
    expect(candidate.daysSinceLastAssignment).toBe(14);
  });

  it('returns null recency when person has no history for this assignment type', () => {
    const history: AssignmentHistoryRecord[] = [
      makeHistory({ personId: 'person-2', meetingDate: '2026-08-15', partType: 'part:treasures' }),
    ];
    const candidate = computeCandidate(makePerson(), { ...BASE_INPUT, history, referenceDate: '2026-08-29' });
    expect(candidate.lastAssignmentDate).toBeNull();
    expect(candidate.daysSinceLastAssignment).toBeNull();
    // Should surface "no history" reason.
    expect(candidate.reasons.some(r => r.kind === 'no_history_for_assignment')).toBe(true);
  });

  it('returns recentAssignmentCount within window', () => {
    const history: AssignmentHistoryRecord[] = [
      makeHistory({ personId: 'person-1', meetingDate: '2026-08-10', partType: 'part:treasures' }),
      makeHistory({ id: 'hist-2', personId: 'person-1', meetingDate: '2026-08-20', partType: 'part:treasures' }),
      makeHistory({ id: 'hist-3', personId: 'person-1', meetingDate: '2026-05-01', partType: 'part:treasures' }),
    ];
    const candidate = computeCandidate(makePerson(), { ...BASE_INPUT, history, referenceDate: '2026-08-29' });
    // 2 records within 90 days (10, 20); the May one is outside.
    expect(candidate.recentAssignmentCount).toBe(2);
  });

  it('marks alreadyAssignedInMeeting when person is in personsInSameMeeting', () => {
    const candidate = computeCandidate(
      makePerson(),
      { ...BASE_INPUT, personsInSameMeeting: new Set(['person-1']) },
    );
    expect(candidate.alreadyAssignedInMeeting).toBe(true);
    expect(candidate.reasons.some(r => r.kind === 'already_assigned_in_meeting')).toBe(true);
  });

  it('does not include "best" or "rank" language in any reason', () => {
    const candidate = computeCandidate(makePerson(), BASE_INPUT);
    for (const reason of candidate.reasons) {
      expect(reason.messageKey).not.toMatch(/best|better|qualified|spiritual|ranked/i);
    }
  });

  it('throws on cross-tenant person', () => {
    const person = makePerson({ tenantId: 'tenant-b' });
    expect(() => computeCandidate(person, BASE_INPUT)).toThrow(/Cross-tenant/);
  });

  it('throws on invalid window (end <= start)', () => {
    expect(() => computeCandidate(makePerson(), { ...BASE_INPUT, endsAt: BASE_INPUT.startsAt }))
      .toThrow(/must end after it starts/);
  });

  it('throws on invalid referenceDate format', () => {
    expect(() => computeCandidate(makePerson(), { ...BASE_INPUT, referenceDate: '2026/08/29' }))
      .toThrow(/YYYY-MM-DD/);
  });
});

describe('candidate-engine — computeCandidates', () => {
  it('sorts valid candidates first, then by suggestion score, then by personId', () => {
    const p1 = makePerson({ id: 'p1', displayName: 'Person One' });
    const p2 = makePerson({ id: 'p2', displayName: 'Person Two' });
    const p3 = makePerson({ id: 'p3', displayName: 'Person Three' });
    const history: AssignmentHistoryRecord[] = [
      makeHistory({ id: 'h1', personId: 'p1', meetingDate: '2026-08-15', partType: 'part:treasures' }),
      // p2 last assigned 12 weeks ago — should be suggested first.
      makeHistory({ id: 'h2', personId: 'p2', meetingDate: '2026-07-01', partType: 'part:treasures' }),
    ];
    const candidates = computeCandidates({
      ...BASE_INPUT,
      people: [p1, p2, p3],
      history,
      referenceDate: '2026-08-29',
    });
    expect(candidates.length).toBe(3);
    // All valid.
    expect(candidates.every(c => c.eligible && c.available)).toBe(true);
  });

  it('filters out people from other tenants (silently)', () => {
    const own = makePerson({ id: 'p1' });
    const other = makePerson({ id: 'p2', tenantId: 'tenant-b' });
    const candidates = computeCandidates({ ...BASE_INPUT, people: [own, other] });
    expect(candidates.length).toBe(1);
    expect(candidates[0].personId).toBe('p1');
  });

  it('is deterministic (same input -> same output order)', () => {
    const people = [
      makePerson({ id: 'p1' }),
      makePerson({ id: 'p2' }),
      makePerson({ id: 'p3' }),
    ];
    const r1 = computeCandidates({ ...BASE_INPUT, people });
    const r2 = computeCandidates({ ...BASE_INPUT, people });
    expect(r1.map(c => c.personId)).toEqual(r2.map(c => c.personId));
  });
});

describe('candidate-engine — selectValidCandidates', () => {
  it('returns only eligible + available + no-conflict candidates', () => {
    const valid = makePerson({ id: 'p1' });
    const ineligible = makePerson({ id: 'p2', eligibility: [] });
    const inactive = makePerson({ id: 'p3', active: false });
    const candidates = computeCandidates({
      ...BASE_INPUT,
      people: [valid, ineligible, inactive],
    });
    const selected = selectValidCandidates(candidates);
    expect(selected.length).toBe(1);
    expect(selected[0].personId).toBe('p1');
  });
});

describe('candidate-engine — assertCandidateTenant', () => {
  it('passes when tenant matches', () => {
    const candidate: CandidateProfile = {
      personId: 'p1',
      displayName: 'X',
      tenantId: 'tenant-a',
      role: 'student',
      eligible: true,
      available: true,
      inactive: false,
      conflicts: [],
      lastAssignmentDate: null,
      daysSinceLastAssignment: null,
      recentAssignmentCount: 0,
      alreadyAssignedInMeeting: false,
      suggestionScore: 0,
      reasons: [],
    };
    expect(() => assertCandidateTenant(candidate, 'tenant-a')).not.toThrow();
  });

  it('throws when tenant differs', () => {
    const candidate: CandidateProfile = {
      personId: 'p1',
      displayName: 'X',
      tenantId: 'tenant-a',
      role: 'student',
      eligible: true,
      available: true,
      inactive: false,
      conflicts: [],
      lastAssignmentDate: null,
      daysSinceLastAssignment: null,
      recentAssignmentCount: 0,
      alreadyAssignedInMeeting: false,
      suggestionScore: 0,
      reasons: [],
    };
    expect(() => assertCandidateTenant(candidate, 'tenant-b')).toThrow(/Cross-tenant/);
  });
});

describe('candidate-engine — never infers eligibility', () => {
  it('never returns eligible=true when no explicit grant exists', () => {
    const person = makePerson({ eligibility: [] });
    const candidate = computeCandidate(person, BASE_INPUT);
    expect(candidate.eligible).toBe(false);
  });

  it('never returns eligible=true when grant is enabled=false', () => {
    const person = makePerson({
      eligibility: [
        { assignmentTypeId: 'part:treasures', enabled: false, decidedBy: 'elder-1', decidedAt: '2026-01-01T00:00:00Z' },
      ],
    });
    const candidate = computeCandidate(person, BASE_INPUT);
    expect(candidate.eligible).toBe(false);
  });

  it('respects latest decision when multiple grants exist for same type', () => {
    const person = makePerson({
      eligibility: [
        { assignmentTypeId: 'part:treasures', enabled: true, decidedBy: 'e1', decidedAt: '2026-01-01T00:00:00Z' },
        { assignmentTypeId: 'part:treasures', enabled: false, decidedBy: 'e2', decidedAt: '2026-02-01T00:00:00Z' },
      ],
    });
    const candidate = computeCandidate(person, BASE_INPUT);
    expect(candidate.eligible).toBe(false);
  });
});

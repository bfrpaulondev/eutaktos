import { describe, it, expect } from 'vitest';
import {
  buildSuggestion,
  buildSuggestionContext,
  buildSuggestions,
  assertSuggestionTenant,
} from './suggestion-engine';
import {
  computeCandidate,
  type CandidateProfile,
  type CandidateQueryInput,
} from './candidate-engine';
import type { CongregationPerson } from './people';
import type { AssignmentHistoryRecord } from './assignment-history';

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

const BASE: CandidateQueryInput = {
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

describe('suggestion-engine — buildSuggestionContext', () => {
  it('returns empty maxDaysSinceLastAssignment when no valid candidates', () => {
    const candidate = computeCandidate(makePerson({ eligibility: [] }), BASE);
    const context = buildSuggestionContext([candidate]);
    expect(context.maxDaysSinceLastAssignment).toBeNull();
    expect(context.validCandidateCount).toBe(0);
  });

  it('counts valid candidates and computes max days since last assignment', () => {
    const p1 = makePerson({ id: 'p1' });
    const p2 = makePerson({ id: 'p2' });
    const history: AssignmentHistoryRecord[] = [
      makeHistory({ id: 'h1', personId: 'p1', meetingDate: '2026-08-15' }),
      makeHistory({ id: 'h2', personId: 'p2', meetingDate: '2026-07-01' }),
    ];
    const candidates = [
      computeCandidate(p1, { ...BASE, history, referenceDate: '2026-08-29' }),
      computeCandidate(p2, { ...BASE, history, referenceDate: '2026-08-29' }),
    ];
    const context = buildSuggestionContext(candidates);
    expect(context.validCandidateCount).toBe(2);
    // p2 has 59 days since (2026-07-01 -> 2026-08-29).
    expect(context.maxDaysSinceLastAssignment).toBe(59);
  });

  it('counts alreadyAssignedInMeeting', () => {
    const p1 = makePerson({ id: 'p1' });
    const candidate = computeCandidate(p1, { ...BASE, personsInSameMeeting: new Set(['p1']) });
    const context = buildSuggestionContext([candidate]);
    expect(context.alreadyAssignedCount).toBe(1);
  });
});

describe('suggestion-engine — buildSuggestion', () => {
  it('returns no hint when candidate is ineligible', () => {
    const candidate = computeCandidate(makePerson({ eligibility: [] }), BASE);
    const suggestion = buildSuggestion(candidate, buildSuggestionContext([candidate]));
    expect(suggestion.hint).toBeUndefined();
  });

  it('returns no hint when candidate has conflict', () => {
    const candidate = computeCandidate(makePerson(), {
      ...BASE,
      existingAssignments: [
        {
          tenantId: 'tenant-a',
          assignmentId: 'asg-1:student',
          personId: 'person-1',
          startsAt: '2026-09-01T19:15:00Z',
          endsAt: '2026-09-01T19:45:00Z',
        },
      ],
    });
    expect(candidate.conflicts.length).toBeGreaterThan(0);
    const suggestion = buildSuggestion(candidate, buildSuggestionContext([candidate]));
    expect(suggestion.hint).toBeUndefined();
  });

  it('returns no-history hint when candidate has no history for this assignment', () => {
    const candidate = computeCandidate(makePerson(), BASE);
    const suggestion = buildSuggestion(candidate, buildSuggestionContext([candidate]));
    expect(candidate.lastAssignmentDate).toBeNull();
    expect(suggestion.hint).toBeDefined();
    expect(suggestion.hint?.messageKey).toBe('midweek.suggestion.noHistoryForAssignment');
    expect(suggestion.hint?.operationallyPreferred).toBeUndefined();
  });

  it('returns longest-time-since hint when candidate has the longest gap among valid candidates', () => {
    const p1 = makePerson({ id: 'p1' });
    const p2 = makePerson({ id: 'p2' });
    // p1 last assigned 12 weeks ago, p2 last assigned 2 weeks ago.
    const history: AssignmentHistoryRecord[] = [
      makeHistory({ id: 'h1', personId: 'p1', meetingDate: '2026-06-10' }),
      makeHistory({ id: 'h2', personId: 'p2', meetingDate: '2026-08-15' }),
    ];
    const candidates = [
      computeCandidate(p1, { ...BASE, history, referenceDate: '2026-08-29' }),
      computeCandidate(p2, { ...BASE, history, referenceDate: '2026-08-29' }),
    ];
    const context = buildSuggestionContext(candidates);
    const s1 = buildSuggestion(candidates[0], context);
    const s2 = buildSuggestion(candidates[1], context);
    expect(s1.hint?.messageKey).toBe('midweek.suggestion.longestTimeSinceAssignment');
    expect(s1.hint?.operationallyPreferred).toBe(true);
    expect(s2.hint).toBeUndefined();
  });

  it('never uses language like "best" or "ranked" in hints', () => {
    const p1 = makePerson({ id: 'p1' });
    const history: AssignmentHistoryRecord[] = [
      makeHistory({ id: 'h1', personId: 'p1', meetingDate: '2026-06-10' }),
    ];
    const candidates = [computeCandidate(p1, { ...BASE, history, referenceDate: '2026-08-29' })];
    const context = buildSuggestionContext(candidates);
    const suggestion = buildSuggestion(candidates[0], context);
    if (suggestion.hint) {
      expect(suggestion.hint.messageKey).not.toMatch(/best|better|qualified|spiritual|ranked/i);
    }
  });
});

describe('suggestion-engine — buildSuggestions', () => {
  it('returns 1:1 list aligned with input candidates', () => {
    const p1 = makePerson({ id: 'p1' });
    const p2 = makePerson({ id: 'p2' });
    const candidates = [computeCandidate(p1, BASE), computeCandidate(p2, BASE)];
    const suggestions = buildSuggestions(candidates);
    expect(suggestions.length).toBe(2);
    expect(suggestions[0].personId).toBe('p1');
    expect(suggestions[1].personId).toBe('p2');
  });
});

describe('suggestion-engine — tenant guard', () => {
  it('passes when tenant matches', () => {
    const candidate = computeCandidate(makePerson(), BASE);
    const suggestion = buildSuggestion(candidate, buildSuggestionContext([candidate]));
    expect(() => assertSuggestionTenant(suggestion, 'tenant-a')).not.toThrow();
  });

  it('throws when tenant differs', () => {
    const candidate = computeCandidate(makePerson(), BASE);
    const suggestion = buildSuggestion(candidate, buildSuggestionContext([candidate]));
    expect(() => assertSuggestionTenant(suggestion, 'tenant-b')).toThrow(/Cross-tenant/);
  });
});

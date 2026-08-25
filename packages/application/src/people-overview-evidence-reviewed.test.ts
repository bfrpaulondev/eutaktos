import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  type AssignmentHistoryRecord,
  type CongregationPerson,
} from '@eutaktos/domain';
import {
  affectedAssignmentsByAvailability,
  deterministicRecommendationEvidence,
  type ActiveAssignmentEvidence,
  type DeterministicRecommendationInput,
} from './people-overview-evidence-reviewed';

const FULL_CONTEXT = createAccessContext({
  tenantId: 'tenant-a',
  actorId: 'actor-a',
  capabilities: ['people.read', 'eligibility.read', 'availability.read', 'schedule.read'],
});

function person(id: string, overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id,
    tenantId: 'tenant-a',
    displayName: id,
    active: true,
    availability: [],
    eligibility: [{ assignmentTypeId: 'reading', enabled: true, decidedBy: 'actor-a', decidedAt: '2026-01-01T00:00:00.000Z' }],
    ...overrides,
  };
}

function history(personId: string, meetingDate: string): AssignmentHistoryRecord {
  return {
    id: `history-${personId}`,
    tenantId: 'tenant-a',
    assignmentId: `assignment-${personId}`,
    personId,
    partType: 'reading',
    meetingDate,
    state: 'completed',
    recordedAt: `${meetingDate}T20:00:00.000Z`,
    meetingId: `meeting-${personId}`,
  };
}

function input(overrides: Partial<DeterministicRecommendationInput> = {}): DeterministicRecommendationInput {
  return {
    assignmentTypeId: 'reading',
    partType: 'reading',
    targetMeetingDate: '2026-04-01',
    referenceDate: '2026-04-01',
    startsAt: '2026-04-01T19:00:00.000Z',
    endsAt: '2026-04-01T19:30:00.000Z',
    people: [],
    history: [],
    activeAssignments: [],
    workloadAssignments: [],
    ...overrides,
  };
}

describe('principal-reviewed People/PX7 evidence', () => {
  it('emits LONGER_SINCE_LAST_ASSIGNMENT only for a factual longest interval among valid candidates', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person('older'), person('recent'), person('no-history')],
      history: [history('older', '2026-01-01'), history('recent', '2026-03-20')],
    }));

    const reasons = new Map(result.candidates.map(candidate => [candidate.personId, candidate.reasons.map(item => item.code)]));
    expect(reasons.get('older')).toContain('LONGER_SINCE_LAST_ASSIGNMENT');
    expect(reasons.get('recent')).not.toContain('LONGER_SINCE_LAST_ASSIGNMENT');
    expect(reasons.get('no-history')).not.toContain('LONGER_SINCE_LAST_ASSIGNMENT');
  });

  it('does not manufacture a long-interval reason when there is no factual peer comparison', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person('only')],
      history: [history('only', '2026-01-01')],
    }));
    expect(result.candidates[0]?.reasons.map(item => item.code)).not.toContain('LONGER_SINCE_LAST_ASSIGNMENT');
  });

  it('never emits the positive long-interval reason for excluded candidates', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person('valid'), person('excluded', { eligibility: [] })],
      history: [history('valid', '2026-03-20'), history('excluded', '2025-01-01')],
    }));
    expect(result.excluded[0]?.reasons.map(item => item.code)).not.toContain('LONGER_SINCE_LAST_ASSIGNMENT');
  });

  it('checks only the minimum read capabilities needed for absence-affects-assignment evidence', () => {
    const context = createAccessContext({
      tenantId: 'tenant-a',
      actorId: 'actor-a',
      capabilities: ['people.read', 'availability.read', 'schedule.read'],
    });
    const assigned: ActiveAssignmentEvidence = {
      tenantId: 'tenant-a',
      assignmentId: 'assignment-a',
      personId: 'away',
      startsAt: '2026-04-01T19:00:00.000Z',
      endsAt: '2026-04-01T19:30:00.000Z',
      state: 'assigned',
    };
    const away = person('away', {
      availability: [{ id: 'period-a', startsAt: '2026-04-01T18:00:00.000Z', endsAt: '2026-04-01T20:00:00.000Z', reasonCode: 'other' }],
    });

    expect(affectedAssignmentsByAvailability(context, { people: [away], activeAssignments: [assigned] })).toEqual([
      { assignmentId: 'assignment-a', personId: 'away', unavailablePeriodId: 'period-a' },
    ]);
  });

  it('fails closed if an actually required absence-evidence capability is missing', () => {
    const context = createAccessContext({
      tenantId: 'tenant-a',
      actorId: 'actor-a',
      capabilities: ['people.read', 'schedule.read'],
    });
    expect(() => affectedAssignmentsByAvailability(context, { people: [], activeAssignments: [] })).toThrow('missing capability availability.read');
  });
});

import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  resolveZonedLocalTime,
  type AssignmentHistoryRecord,
  type CongregationPerson,
  type MidweekMeeting,
  type NonStudentAssignment,
  type ResponsibilityAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import {
  PROFILE_COMPLETENESS,
  RECENT_AVAILABILITY_CHANGES,
  affectedAssignmentsByAvailability,
  completedAssignmentHistoryFromScheduling,
  deterministicRecommendationEvidence,
  type ActiveAssignmentEvidence,
  type AssignmentWorkloadEvidence,
  type DeterministicRecommendationInput,
} from './people-overview-evidence';

const FULL_CONTEXT = createAccessContext({
  tenantId: 'tenant-a',
  actorId: 'actor-a',
  capabilities: ['people.read', 'eligibility.read', 'availability.read', 'schedule.read'],
});

const RESPONSIBILITY_CONTEXT = createAccessContext({
  tenantId: 'tenant-a',
  actorId: 'actor-a',
  capabilities: ['people.read', 'eligibility.read', 'availability.read', 'schedule.read', 'responsibilities.read'],
});

function person(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-a',
    tenantId: 'tenant-a',
    displayName: 'Person A',
    active: true,
    availability: [],
    eligibility: [{ assignmentTypeId: 'reading', enabled: true, decidedBy: 'actor-a', decidedAt: '2026-01-01T00:00:00.000Z' }],
    ...overrides,
  };
}

function completedHistory(overrides: Partial<AssignmentHistoryRecord> = {}): AssignmentHistoryRecord {
  return {
    id: 'history-a',
    tenantId: 'tenant-a',
    assignmentId: 'assignment-history-a',
    personId: 'person-a',
    partType: 'reading',
    meetingDate: '2026-03-01',
    state: 'completed',
    recordedAt: '2026-03-01T20:00:00.000Z',
    meetingId: 'meeting-history-a',
    ...overrides,
  };
}

function activeAssignment(overrides: Partial<ActiveAssignmentEvidence> = {}): ActiveAssignmentEvidence {
  return {
    tenantId: 'tenant-a',
    assignmentId: 'active-a',
    personId: 'person-a',
    startsAt: '2026-04-01T19:00:00.000Z',
    endsAt: '2026-04-01T19:30:00.000Z',
    state: 'assigned',
    ...overrides,
  };
}

function workload(overrides: Partial<AssignmentWorkloadEvidence> = {}): AssignmentWorkloadEvidence {
  return {
    tenantId: 'tenant-a',
    assignmentId: 'workload-a',
    personId: 'person-a',
    meetingDate: '2026-04-01',
    state: 'assigned',
    ...overrides,
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
    people: [person()],
    history: [],
    activeAssignments: [],
    workloadAssignments: [],
    ...overrides,
  };
}

describe('People Overview and PX7 deterministic evidence', () => {
  it('includes only explicitly eligible, available, active people and returns structured hard-constraint reasons', () => {
    const eligible = person({ id: 'eligible', displayName: 'Eligible' });
    const away = person({
      id: 'away',
      displayName: 'Away',
      availability: [{ id: 'away-period', startsAt: '2026-04-01T19:00:00.000Z', endsAt: '2026-04-01T19:30:00.000Z', reasonCode: 'away' }],
    });
    const conflicting = person({ id: 'conflicting', displayName: 'Conflicting' });
    const ineligible = person({ id: 'ineligible', displayName: 'Ineligible', eligibility: [] });
    const inactive = person({ id: 'inactive', displayName: 'Inactive', active: false });
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [eligible, away, conflicting, ineligible, inactive],
      activeAssignments: [activeAssignment({ personId: 'conflicting', assignmentId: 'other-active' })],
    }));

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ personId: 'eligible', rank: 1, status: 'candidate' });
    expect(result.candidates[0].reasons.map(item => item.code)).toEqual([
      'ELIGIBLE', 'AVAILABLE', 'NO_MEETING_CONFLICT', 'NO_WEEKLY_ASSIGNMENT',
    ]);
    expect(result.candidates[0].warnings.map(item => item.code)).toEqual(['NO_COMPLETED_ASSIGNMENT_HISTORY']);
    expect(result.excluded.map(item => [item.personId, item.reasons.map(reason => reason.code)])).toEqual([
      ['away', ['AWAY_DURING_MEETING']],
      ['conflicting', ['CONFLICTING_ASSIGNMENT']],
      ['inactive', ['INACTIVE']],
      ['ineligible', ['NOT_ELIGIBLE']],
    ]);
    expect(result.excluded.map(item => [item.personId, item.warnings.map(warning => warning.code)])).toEqual([
      ['away', ['NO_COMPLETED_ASSIGNMENT_HISTORY']],
      ['conflicting', ['NO_COMPLETED_ASSIGNMENT_HISTORY']],
      ['inactive', ['NO_COMPLETED_ASSIGNMENT_HISTORY']],
      ['ineligible', ['NO_COMPLETED_ASSIGNMENT_HISTORY']],
    ]);
  });

  it('never lets same-week workload override an explicit eligibility or availability hard constraint', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [
        person({ id: 'ineligible-workload', eligibility: [] }),
        person({ id: 'away-workload', availability: [{ id: 'away-workload', startsAt: '2026-04-01T19:00:00.000Z', endsAt: '2026-04-01T19:30:00.000Z', reasonCode: 'other' }] }),
      ],
      workloadAssignments: [
        workload({ personId: 'ineligible-workload' }),
        workload({ personId: 'away-workload' }),
      ],
    }));

    expect(result.candidates).toEqual([]);
    expect(result.excluded.map(candidate => [candidate.personId, candidate.reasons.map(reason => reason.code)])).toEqual([
      ['away-workload', ['AWAY_DURING_MEETING']],
      ['ineligible-workload', ['NOT_ELIGIBLE']],
    ]);
    expect(result.excluded.map(candidate => [candidate.personId, candidate.warnings.map(warning => warning.code)])).toEqual([
      ['away-workload', ['HAS_WEEKLY_ASSIGNMENT', 'NO_COMPLETED_ASSIGNMENT_HISTORY']],
      ['ineligible-workload', ['HAS_WEEKLY_ASSIGNMENT', 'NO_COMPLETED_ASSIGNMENT_HISTORY']],
    ]);
  });

  it('uses completed-only, tenant-scoped, non-future history and keeps no history explicit', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person({ id: 'completed' }), person({ id: 'assigned' }), person({ id: 'cancelled' }), person({ id: 'future' }), person({ id: 'foreign' })],
      history: [
        completedHistory({ id: 'completed', personId: 'completed', meetingDate: '2026-02-01' }),
        completedHistory({ id: 'assigned', personId: 'assigned', state: 'assigned', meetingDate: '2026-01-01' }),
        completedHistory({ id: 'cancelled', personId: 'cancelled', state: 'cancelled', meetingDate: '2026-01-01' }),
        completedHistory({ id: 'future', personId: 'future', meetingDate: '2026-05-01' }),
        completedHistory({ id: 'foreign', tenantId: 'tenant-b', personId: 'foreign', meetingDate: '2025-01-01' }),
      ],
    }));

    const histories = new Map([...result.candidates, ...result.excluded].map(candidate => [candidate.personId, candidate.history]));
    expect(histories.get('completed')).toEqual({ kind: 'completed-history', lastCompletedMeetingDate: '2026-02-01', daysSinceLastCompletedAssignment: 59 });
    for (const id of ['assigned', 'cancelled', 'future', 'foreign']) {
      expect(histories.get(id)).toEqual({ kind: 'no-completed-history' });
    }
  });

  it('uses same-week workload and completed recency only to order otherwise valid candidates, with a stable ID tie-breaker', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person({ id: 'history-long' }), person({ id: 'history-short' }), person({ id: 'no-history' }), person({ id: 'same-b' }), person({ id: 'same-a' })],
      history: [
        completedHistory({ id: 'long', personId: 'history-long', meetingDate: '2026-01-01' }),
        completedHistory({ id: 'short', personId: 'history-short', meetingDate: '2026-03-20' }),
      ],
      workloadAssignments: [workload({ personId: 'history-long', meetingDate: '2026-04-02' })],
    }));

    expect(result.candidates.map(candidate => [candidate.personId, candidate.rank, candidate.sameWeekAssignmentCount])).toEqual([
      ['history-short', 1, 0],
      ['no-history', 2, 0],
      ['same-a', 3, 0],
      ['same-b', 4, 0],
      ['history-long', 5, 1],
    ]);
    expect(deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person({ id: 'history-long' }), person({ id: 'history-short' }), person({ id: 'no-history' }), person({ id: 'same-b' }), person({ id: 'same-a' })],
      history: [
        completedHistory({ id: 'long', personId: 'history-long', meetingDate: '2026-01-01' }),
        completedHistory({ id: 'short', personId: 'history-short', meetingDate: '2026-03-20' }),
      ],
      workloadAssignments: [workload({ personId: 'history-long', meetingDate: '2026-04-02' })],
    }))).toEqual(result);
  });

  it('does not allow foreign people, availability, assignments, workload or history to influence tenant A', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [person({ id: 'tenant-a-person' }), person({ id: 'tenant-b-person', tenantId: 'tenant-b' })],
      history: [completedHistory({ tenantId: 'tenant-b', personId: 'tenant-a-person', meetingDate: '2020-01-01' })],
      activeAssignments: [activeAssignment({ tenantId: 'tenant-b', personId: 'tenant-a-person' })],
      workloadAssignments: [workload({ tenantId: 'tenant-b', personId: 'tenant-a-person' })],
    }));

    expect(result.candidates.map(candidate => candidate.personId)).toEqual(['tenant-a-person']);
    expect(result.candidates[0]).toMatchObject({ sameWeekAssignmentCount: 0, history: { kind: 'no-completed-history' } });
  });

  it('projects only completed assignment state into tenant-safe history while preserving the meeting civil date', () => {
    const meeting: MidweekMeeting = {
      id: 'meeting-a', tenantId: 'tenant-a', date: '2026-10-25', localTime: '20:00', timezone: 'Europe/Lisbon', state: 'published',
      slots: [{ id: 'slot-a', position: 1, durationMinutes: 5, titleKey: 'reading', partDefinitionId: 'reading' }],
      createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const completedStudent: StudentAssignment = {
      id: 'student-completed', tenantId: 'tenant-a', meetingId: 'meeting-a', slotId: 'slot-a', studentId: 'student', assistantId: 'assistant', assistantIsRequired: true,
      state: 'completed', assignedAt: '2026-10-01T00:00:00.000Z', cancelledAt: null, completedAt: '2026-10-25T20:30:00.000Z',
    };
    const assignedStudent: StudentAssignment = {
      ...completedStudent, id: 'student-assigned', studentId: 'not-completed', assistantId: null, assistantIsRequired: false,
      state: 'assigned', completedAt: null,
    };
    const completedNonStudent: NonStudentAssignment = {
      id: 'non-student-completed', tenantId: 'tenant-a', meetingId: 'meeting-a', slotId: 'slot-a', personId: 'chairman', role: 'chairman',
      state: 'completed', assignedAt: '2026-10-01T00:00:00.000Z', cancelledAt: null, completedAt: '2026-10-25T20:31:00.000Z',
    };
    const foreign: NonStudentAssignment = { ...completedNonStudent, id: 'foreign', tenantId: 'tenant-b', personId: 'foreign-person' };

    const history = completedAssignmentHistoryFromScheduling(FULL_CONTEXT, {
      meetings: [meeting, { ...meeting, id: 'meeting-b', tenantId: 'tenant-b' }],
      studentAssignments: [completedStudent, assignedStudent],
      nonStudentAssignments: [completedNonStudent, foreign],
    });

    expect(history.map(record => [record.id, record.personId, record.partType, record.meetingDate, record.state])).toEqual([
      ['student-completed:assistant', 'assistant', 'reading', '2026-10-25', 'completed'],
      ['student-completed:student', 'student', 'reading', '2026-10-25', 'completed'],
      ['non-student-completed', 'chairman', 'chairman', '2026-10-25', 'completed'],
    ]);
  });

  it('fails closed when any minimum evidence capability is absent', () => {
    const unauthorized = createAccessContext({ tenantId: 'tenant-a', actorId: 'actor-a', capabilities: ['people.read', 'availability.read', 'schedule.read'] });
    expect(() => deterministicRecommendationEvidence(unauthorized, input())).toThrow('missing capability eligibility.read');
    expect(() => affectedAssignmentsByAvailability(unauthorized, { people: [person()], activeAssignments: [activeAssignment()] })).toThrow('missing capability eligibility.read');
  });

  it('identifies all availability reason codes, preserves [start,end) boundaries and handles an Europe/Lisbon DST date via resolved instants', () => {
    const start = resolveZonedLocalTime('2026-03-29', '20:00', 'Europe/Lisbon').instant;
    const end = new Date(Date.parse(start) + 30 * 60_000).toISOString();
    const people = [
      person({ id: 'away', availability: [{ id: 'away', startsAt: start, endsAt: end, reasonCode: 'away' }] }),
      person({ id: 'unavailable', availability: [{ id: 'unavailable', startsAt: start, endsAt: end, reasonCode: 'unavailable' }] }),
      person({ id: 'other', availability: [{ id: 'other', startsAt: start, endsAt: end, reasonCode: 'other' }] }),
      person({ id: 'boundary', availability: [
        { id: 'ends-at-start', startsAt: new Date(Date.parse(start) - 30 * 60_000).toISOString(), endsAt: start, reasonCode: 'away' },
        { id: 'starts-at-end', startsAt: end, endsAt: new Date(Date.parse(end) + 30 * 60_000).toISOString(), reasonCode: 'other' },
      ] }),
    ];
    const result = affectedAssignmentsByAvailability(FULL_CONTEXT, {
      people,
      activeAssignments: people.map(person => activeAssignment({ assignmentId: `assignment-${person.id}`, personId: person.id, startsAt: start, endsAt: end })),
    });

    expect(result).toEqual([
      { assignmentId: 'assignment-away', personId: 'away', unavailablePeriodId: 'away' },
      { assignmentId: 'assignment-other', personId: 'other', unavailablePeriodId: 'other' },
      { assignmentId: 'assignment-unavailable', personId: 'unavailable', unavailablePeriodId: 'unavailable' },
    ]);
  });

  it('keeps profile completeness and recent availability cards blocked until their factual boundaries exist', () => {
    expect(PROFILE_COMPLETENESS).toEqual({
      status: 'blocked',
      requiredBoundary: 'versioned operational profile requirements with stable requirement codes',
    });
    expect(RECENT_AVAILABILITY_CHANGES).toEqual({
      status: 'blocked',
      requiredBoundary: 'canonical availability-change history projection linked to person and period identity',
    });
  });

  it('accepts and echoes only the supported versioned recommendation input contract', () => {
    expect(deterministicRecommendationEvidence(FULL_CONTEXT, input()).inputContractVersion).toBe('px7-recommendation-input-v1');
    expect(() => deterministicRecommendationEvidence(FULL_CONTEXT, input({
      inputContractVersion: 'px7-recommendation-input-v2' as never,
    }))).toThrow('Unsupported recommendation input contract version');
  });

  it('never gives excluded candidates a positive recommendation reason', () => {
    const result = deterministicRecommendationEvidence(FULL_CONTEXT, input({
      people: [
        person({ id: 'ineligible', eligibility: [] }),
        person({ id: 'away', availability: [{ id: 'away', startsAt: '2026-04-01T19:00:00.000Z', endsAt: '2026-04-01T19:30:00.000Z' }] }),
        person({ id: 'conflict' }),
      ],
      activeAssignments: [activeAssignment({ personId: 'conflict' })],
    }));

    const positive = new Set(['ELIGIBLE', 'AVAILABLE', 'NO_MEETING_CONFLICT', 'MEETS_REQUIRED_RESPONSIBILITY', 'LONGER_SINCE_LAST_ASSIGNMENT']);
    for (const candidate of result.excluded) {
      expect(candidate.reasons.some(item => positive.has(item.code))).toBe(false);
    }
  });

  it('enforces an explicitly required active responsibility without allowing foreign or expired records to satisfy it', () => {
    const responsibilities: readonly ResponsibilityAssignment[] = [
      {
        id: 'active-responsibility', tenantId: 'tenant-a', personId: 'responsible', responsibilityKey: 'chairman',
        startsAt: '2026-01-01T00:00:00.000Z', assignedAt: '2026-01-01T00:00:00.000Z', assignedBy: 'actor-a',
      },
      {
        id: 'expired-responsibility', tenantId: 'tenant-a', personId: 'expired', responsibilityKey: 'chairman',
        startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-03-01T00:00:00.000Z', assignedAt: '2026-01-01T00:00:00.000Z', assignedBy: 'actor-a',
      },
      {
        id: 'foreign-responsibility', tenantId: 'tenant-b', personId: 'foreign-evidence', responsibilityKey: 'chairman',
        startsAt: '2026-01-01T00:00:00.000Z', assignedAt: '2026-01-01T00:00:00.000Z', assignedBy: 'actor-b',
      },
    ];
    const result = deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input({
      people: [person({ id: 'responsible' }), person({ id: 'expired' }), person({ id: 'foreign-evidence' }), person({ id: 'missing' })],
      requiredResponsibilityKey: 'chairman',
      responsibilities,
    }));

    expect(result.candidates.map(candidate => candidate.personId)).toEqual(['responsible']);
    expect(result.candidates[0]?.reasons.map(item => item.code)).toContain('MEETS_REQUIRED_RESPONSIBILITY');
    expect(result.excluded.map(candidate => [candidate.personId, candidate.reasons.map(item => item.code)])).toEqual([
      ['expired', ['MISSING_REQUIRED_RESPONSIBILITY']],
      ['foreign-evidence', ['MISSING_REQUIRED_RESPONSIBILITY']],
      ['missing', ['MISSING_REQUIRED_RESPONSIBILITY']],
    ]);
  });

  it('fails closed when an explicit responsibility constraint lacks authorized evidence', () => {
    expect(() => deterministicRecommendationEvidence(FULL_CONTEXT, input({
      requiredResponsibilityKey: 'chairman',
      responsibilities: [],
    }))).toThrow('missing capability responsibilities.read');
    expect(() => deterministicRecommendationEvidence(RESPONSIBILITY_CONTEXT, input({
      requiredResponsibilityKey: 'chairman',
    }))).toThrow('responsibilities are required when requiredResponsibilityKey is provided');
  });
});

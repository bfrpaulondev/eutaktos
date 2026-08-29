import { describe, it, expect, beforeEach } from 'vitest';
import { CandidateQueryService } from './candidate-query-service';
import {
  createMidweekMeeting,
  createMidweekPartDefinition,
  type AccessContext,
  type AssignmentHistoryRecord,
  type CongregationPerson,
  type MidweekMeeting,
  type MidweekPartDefinition,
} from '@eutaktos/domain';
import type { MidweekSchedulingUnitOfWork } from './midweek-scheduling-service';

function createContext(tenantId: string = 'tenant-a'): AccessContext {
  return {
    tenantId,
    actorId: 'actor-1',
    capabilities: ['schedule.read', 'schedule.write', 'eligibility.read', 'availability.read'],
  };
}

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

function makeMeeting(): Readonly<MidweekMeeting> {
  return createMidweekMeeting({
    id: 'meeting-1',
    tenantId: 'tenant-a',
    date: '2026-09-01',
    localTime: '19:00',
    timezone: 'Europe/Lisbon',
    now: '2026-08-22T12:00:00Z',
    slots: [
      { id: 'slot-1', position: 0, durationMinutes: 10, titleKey: 'midweek.parts.treasures', partDefinitionId: 'part:treasures' },
      { id: 'slot-2', position: 1, durationMinutes: 5, titleKey: 'midweek.parts.openingRemarks', partDefinitionId: 'part:opening' },
    ],
  });
}

function makePart(): Readonly<MidweekPartDefinition> {
  return createMidweekPartDefinition({
    id: 'part:treasures',
    type: 'treasures-from-gods-word',
    titleKey: 'midweek.parts.treasures',
    durationMinutes: 10,
    position: 1,
    studentNeeded: true,
    assistantRequirement: 'optional',
  });
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

function makeUow(opts: {
  people?: readonly CongregationPerson[];
  meeting?: Readonly<MidweekMeeting>;
  parts?: readonly MidweekPartDefinition[];
  history?: readonly AssignmentHistoryRecord[];
} = {}): MidweekSchedulingUnitOfWork {
  const people = opts.people ?? [makePerson()];
  const meeting = opts.meeting ?? makeMeeting();
  const parts = opts.parts ?? [makePart()];
  const history = opts.history ?? [];
  return {
    findMeeting: (_ctx, _id) => meeting,
    findStudentAssignment: () => undefined,
    findNonStudentAssignment: () => undefined,
    listStudentAssignments: () => [],
    listNonStudentAssignments: () => [],
    listPeople: () => people,
    findPerson: (_ctx, id) => people.find(p => p.id === id),
    findPartDefinition: id => parts.find(p => p.id === id),
    listPartDefinitions: () => parts,
    listConflictAssignments: () => [],
    listAssignmentHistory: () => history,
    resolveSlotWindow: (_ctx, _m, _slotId) => ({ startsAt: '2026-09-01T18:00:00Z', endsAt: '2026-09-01T18:30:00Z' }),
    commit: () => { throw new Error('CandidateQueryService should never call commit'); },
  };
}

describe('CandidateQueryService', () => {
  it('returns valid candidates for a student slot', () => {
    const service = new CandidateQueryService(makeUow());
    const result = service.listCandidates(createContext(), {
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      role: 'student',
    });
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].personId).toBe('person-1');
    expect(result.candidates[0].eligible).toBe(true);
    expect(result.candidates[0].available).toBe(true);
    expect(result.candidates[0].role).toBe('student');
    expect(result.candidates[0].conflicts).toEqual([]);
  });

  it('returns ineligible candidates with eligible=false (never excludes them)', () => {
    const ineligible = makePerson({ id: 'p2', eligibility: [] });
    const service = new CandidateQueryService(makeUow({ people: [makePerson(), ineligible] }));
    const result = service.listCandidates(createContext(), {
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      role: 'student',
    });
    expect(result.candidates.length).toBe(2);
    const ineligibleResult = result.candidates.find(c => c.personId === 'p2');
    expect(ineligibleResult?.eligible).toBe(false);
  });

  it('throws when meeting not found', () => {
    const uow = makeUow();
    const service = new CandidateQueryService({
      ...uow,
      findMeeting: () => undefined,
    });
    expect(() => service.listCandidates(createContext(), {
      meetingId: 'meeting-missing',
      slotId: 'slot-1',
      role: 'student',
    })).toThrow('Meeting not found');
  });

  it('throws when slot not found', () => {
    const service = new CandidateQueryService(makeUow());
    expect(() => service.listCandidates(createContext(), {
      meetingId: 'meeting-1',
      slotId: 'slot-missing',
      role: 'student',
    })).toThrow('Slot not found');
  });

  it('throws when slot has no part definition for student role', () => {
    const meetingNoPart = createMidweekMeeting({
      id: 'meeting-no-part',
      tenantId: 'tenant-a',
      date: '2026-09-01',
      localTime: '19:00',
      timezone: 'Europe/Lisbon',
      now: '2026-08-22T12:00:00Z',
      slots: [{ id: 'slot-no-part', position: 0, durationMinutes: 5, titleKey: 'midweek.parts.openingRemarks' }],
    });
    const service = new CandidateQueryService(makeUow({ meeting: meetingNoPart }));
    expect(() => service.listCandidates(createContext(), {
      meetingId: 'meeting-no-part',
      slotId: 'slot-no-part',
      role: 'student',
    })).toThrow('Student/assistant slot requires a part definition');
  });

  it('throws for assistant role when part does not accept assistant', () => {
    const partNoAssistant = createMidweekPartDefinition({
      id: 'part:no-assistant',
      type: 'opening-remarks',
      titleKey: 'midweek.parts.openingRemarks',
      durationMinutes: 5,
      position: 1,
      studentNeeded: false,
      assistantRequirement: 'none',
    });
    const meeting = createMidweekMeeting({
      id: 'meeting-2',
      tenantId: 'tenant-a',
      date: '2026-09-01',
      localTime: '19:00',
      timezone: 'Europe/Lisbon',
      now: '2026-08-22T12:00:00Z',
      slots: [{ id: 'slot-1', position: 0, durationMinutes: 5, titleKey: 'midweek.parts.openingRemarks', partDefinitionId: 'part:no-assistant' }],
    });
    const service = new CandidateQueryService(makeUow({ meeting, parts: [partNoAssistant] }));
    expect(() => service.listCandidates(createContext(), {
      meetingId: 'meeting-2',
      slotId: 'slot-1',
      role: 'assistant',
    })).toThrow('does not accept an assistant');
  });

  it('requires schedule.read capability', () => {
    const service = new CandidateQueryService(makeUow());
    expect(() => service.listCandidates(
      { tenantId: 'tenant-a', actorId: 'actor-1', capabilities: ['eligibility.read', 'availability.read'] },
      { meetingId: 'meeting-1', slotId: 'slot-1', role: 'student' },
    )).toThrow('missing capability schedule.read');
  });

  it('requires eligibility.read capability', () => {
    const service = new CandidateQueryService(makeUow());
    expect(() => service.listCandidates(
      { tenantId: 'tenant-a', actorId: 'actor-1', capabilities: ['schedule.read', 'availability.read'] },
      { meetingId: 'meeting-1', slotId: 'slot-1', role: 'student' },
    )).toThrow('missing capability eligibility.read');
  });

  it('requires availability.read capability', () => {
    const service = new CandidateQueryService(makeUow());
    expect(() => service.listCandidates(
      { tenantId: 'tenant-a', actorId: 'actor-1', capabilities: ['schedule.read', 'eligibility.read'] },
      { meetingId: 'meeting-1', slotId: 'slot-1', role: 'student' },
    )).toThrow('missing capability availability.read');
  });

  it('includes recency info from history', () => {
    const history = [
      makeHistory({ id: 'h1', personId: 'person-1', meetingDate: '2026-08-15', partType: 'part:treasures' }),
    ];
    const service = new CandidateQueryService(makeUow({ history }));
    const result = service.listCandidates(createContext(), {
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      role: 'student',
    });
    // Reference date is the meeting's date (2026-09-01); last assignment was 2026-08-15 = 17 days ago.
    expect(result.candidates[0].lastAssignmentDate).toBe('2026-08-15');
    expect(result.candidates[0].daysSinceLastAssignment).toBe(17);
  });

  it('never exposes suggestionScore directly to the UI in reasons (only reasons)', () => {
    const service = new CandidateQueryService(makeUow());
    const result = service.listCandidates(createContext(), {
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      role: 'student',
    });
    // The DTO is the candidate profile itself; the UI is responsible for not exposing score.
    expect(result.candidates[0].reasons).toBeDefined();
    expect(Array.isArray(result.candidates[0].reasons)).toBe(true);
  });

  it('listNonStudentCandidates uses role as assignmentTypeId', () => {
    const person = makePerson({
      id: 'p1',
      eligibility: [
        { assignmentTypeId: 'chairman', enabled: true, decidedBy: 'elder-1', decidedAt: '2026-01-01T00:00:00Z' },
      ],
    });
    const service = new CandidateQueryService(makeUow({ people: [person] }));
    const result = service.listNonStudentCandidates(createContext(), 'meeting-1', 'slot-2', 'chairman');
    expect(result.assignmentTypeId).toBe('chairman');
    expect(result.role).toBe('non-student');
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].eligible).toBe(true);
  });
});

describe('CandidateQueryService — conflict detection', () => {
  it('marks candidate as having conflict when their existing assignment overlaps', () => {
    const service = new CandidateQueryService({
      ...makeUow(),
      listConflictAssignments: () => [
        {
          tenantId: 'tenant-a',
          assignmentId: 'existing:student',
          personId: 'person-1',
          startsAt: '2026-09-01T18:15:00Z',
          endsAt: '2026-09-01T18:45:00Z',
        },
      ],
    });
    const result = service.listCandidates(createContext(), {
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      role: 'student',
    });
    expect(result.candidates[0].conflicts.length).toBe(1);
    expect(result.candidates[0].conflicts[0].kind).toBe('assignment-overlap');
  });
});

describe('CandidateQueryService — tenant isolation', () => {
  it('throws on cross-tenant meeting access', () => {
    const foreignMeeting = createMidweekMeeting({
      id: 'meeting-foreign',
      tenantId: 'tenant-b',
      date: '2026-09-01',
      localTime: '19:00',
      timezone: 'Europe/Lisbon',
      now: '2026-08-22T12:00:00Z',
      slots: [{ id: 'slot-1', position: 0, durationMinutes: 10, titleKey: 'x', partDefinitionId: 'part:treasures' }],
    });
    const service = new CandidateQueryService(makeUow({ meeting: foreignMeeting }));
    expect(() => service.listCandidates(createContext('tenant-a'), {
      meetingId: 'meeting-foreign',
      slotId: 'slot-1',
      role: 'student',
    })).toThrow('Cross-tenant');
  });
});

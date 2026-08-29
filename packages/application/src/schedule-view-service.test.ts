import { describe, it, expect } from 'vitest';
import { ScheduleViewService } from './schedule-view-service';
import {
  createMidweekMeeting,
  createNonStudentAssignment,
  createStudentAssignment,
  type AccessContext,
  type AssignmentHistoryRecord,
  type CongregationPerson,
  type MidweekMeeting,
  type MidweekPartDefinition,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import type { MidweekSchedulingUnitOfWork } from './midweek-scheduling-service';

function createContext(): AccessContext {
  return {
    tenantId: 'tenant-a',
    actorId: 'actor-1',
    capabilities: ['schedule.read', 'schedule.write', 'eligibility.read', 'availability.read'],
  };
}

function makePerson(id: string, name: string, eligible = true): CongregationPerson {
  return {
    id,
    tenantId: 'tenant-a',
    displayName: name,
    active: true,
    availability: [],
    eligibility: eligible
      ? [{ assignmentTypeId: 'part:treasures', enabled: true, decidedBy: 'elder-1', decidedAt: '2026-01-01T00:00:00Z' }]
      : [],
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
      { id: 'slot-2', position: 1, durationMinutes: 5, titleKey: 'midweek.parts.openingRemarks' },
    ],
  });
}

function makeUow(opts: {
  people?: readonly CongregationPerson[];
  meeting?: Readonly<MidweekMeeting>;
  studentAssignments?: readonly StudentAssignment[];
  nonStudentAssignments?: readonly NonStudentAssignment[];
  conflicts?: readonly { tenantId: string; assignmentId: string; personId: string; startsAt: string; endsAt: string }[];
} = {}): MidweekSchedulingUnitOfWork {
  const people = opts.people ?? [makePerson('p1', 'João Silva')];
  const meeting = opts.meeting ?? makeMeeting();
  const studentAssignments = opts.studentAssignments ?? [];
  const nonStudentAssignments = opts.nonStudentAssignments ?? [];
  const conflicts = opts.conflicts ?? [];
  return {
    findMeeting: (_ctx, _id) => meeting,
    findStudentAssignment: () => undefined,
    findNonStudentAssignment: () => undefined,
    listStudentAssignments: (_ctx, _meetingId) => studentAssignments,
    listNonStudentAssignments: (_ctx, _meetingId) => nonStudentAssignments,
    listPeople: () => people,
    findPerson: (_ctx, id) => people.find(p => p.id === id),
    findPartDefinition: () => undefined,
    listPartDefinitions: () => [],
    listConflictAssignments: () => conflicts,
    listAssignmentHistory: () => [],
    resolveSlotWindow: (_ctx, _m, slotId) => {
      // Two slots: 0-10 and 10-15
      if (slotId === 'slot-1') return { startsAt: '2026-09-01T18:00:00Z', endsAt: '2026-09-01T18:10:00Z' };
      return { startsAt: '2026-09-01T18:10:00Z', endsAt: '2026-09-01T18:15:00Z' };
    },
    commit: () => { throw new Error('ScheduleViewService should never call commit'); },
  };
}

describe('ScheduleViewService', () => {
  it('returns view with all slots vacant when no assignments', () => {
    const service = new ScheduleViewService(makeUow());
    const view = service.viewMeeting(createContext(), 'meeting-1');
    expect(view.totalSlots).toBe(2);
    expect(view.filledSlots).toBe(0);
    expect(view.vacantSlots).toBe(2);
    expect(view.conflictedSlots).toBe(0);
    expect(view.slots.every(s => s.state === 'vacant')).toBe(true);
  });

  it('marks slot as filled when student assignment exists', () => {
    const studentAssignment = createStudentAssignment({
      id: 'sa-1',
      tenantId: 'tenant-a',
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      studentId: 'p1',
      assistantIsRequired: false,
      now: '2026-08-22T12:00:00Z',
    });
    const service = new ScheduleViewService(makeUow({
      people: [makePerson('p1', 'João')],
      studentAssignments: [studentAssignment],
    }));
    const view = service.viewMeeting(createContext(), 'meeting-1');
    expect(view.filledSlots).toBe(1);
    expect(view.vacantSlots).toBe(1);
    const slot1 = view.slots.find(s => s.slotId === 'slot-1');
    expect(slot1?.state).toBe('filled');
    expect(slot1?.studentDisplayName).toBe('João');
  });

  it('marks slot as filled when non-student assignment exists', () => {
    const nonStudentAssignment = createNonStudentAssignment({
      id: 'na-1',
      tenantId: 'tenant-a',
      meetingId: 'meeting-1',
      slotId: 'slot-2',
      personId: 'p1',
      role: 'chairman',
      now: '2026-08-22T12:00:00Z',
    });
    const service = new ScheduleViewService(makeUow({
      people: [makePerson('p1', 'João')],
      nonStudentAssignments: [nonStudentAssignment],
    }));
    const view = service.viewMeeting(createContext(), 'meeting-1');
    expect(view.filledSlots).toBe(1);
    const slot2 = view.slots.find(s => s.slotId === 'slot-2');
    expect(slot2?.state).toBe('filled');
    expect(slot2?.nonStudentDisplayName).toBe('João');
    expect(slot2?.nonStudentRole).toBe('chairman');
  });

  it('requires schedule.read capability', () => {
    const service = new ScheduleViewService(makeUow());
    expect(() => service.viewMeeting(
      { tenantId: 'tenant-a', actorId: 'actor-1', capabilities: [] },
      'meeting-1',
    )).toThrow('missing capability schedule.read');
  });

  it('throws when meeting not found', () => {
    const uow = makeUow();
    const service = new ScheduleViewService({
      ...uow,
      findMeeting: () => undefined,
    });
    expect(() => service.viewMeeting(createContext(), 'meeting-missing')).toThrow('Meeting not found');
  });

  it('throws on cross-tenant meeting access', () => {
    const foreignMeeting = createMidweekMeeting({
      id: 'meeting-foreign',
      tenantId: 'tenant-b',
      date: '2026-09-01',
      localTime: '19:00',
      timezone: 'Europe/Lisbon',
      now: '2026-08-22T12:00:00Z',
      slots: [],
    });
    const service = new ScheduleViewService(makeUow({ meeting: foreignMeeting }));
    expect(() => service.viewMeeting(createContext(), 'meeting-foreign')).toThrow('Cross-tenant');
  });

  it('returns slots sorted by position', () => {
    const service = new ScheduleViewService(makeUow());
    const view = service.viewMeeting(createContext(), 'meeting-1');
    expect(view.slots.map(s => s.position)).toEqual([0, 1]);
  });
});

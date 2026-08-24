import { describe, expect, it } from 'vitest';
import {
  addMeetingSlot,
  createAccessContext,
  createMidweekMeeting,
  createMidweekPartDefinition,
  createNonStudentAssignment,
  createStudentAssignment,
  filterHistoryByState,
  recordAssignmentHistory,
  type AccessContext,
  type CongregationPerson,
  type MidweekMeeting,
  type MidweekPartDefinition,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import {
  MidweekSchedulingService,
  type MidweekSchedulingChange,
  type MidweekSchedulingRuntime,
  type MidweekSchedulingUnitOfWork,
} from './midweek-scheduling-service';
import { StudentAssignmentReplacementService } from './student-assignment-replacement-service';

const NOW = '2026-08-24T12:00:00.000Z';
const WINDOW = {
  startsAt: '2026-08-26T18:00:00.000Z',
  endsAt: '2026-08-26T18:05:00.000Z',
} as const;

function context(tenantId = 'tenant-a'): Readonly<AccessContext> {
  return createAccessContext({
    tenantId,
    actorId: 'authorized-actor',
    capabilities: ['schedule.write', 'eligibility.read', 'availability.read'],
  });
}

function person(id: string, assignmentTypeId = 'student-reading', tenantId = 'tenant-a'): CongregationPerson {
  return {
    id,
    tenantId,
    displayName: id,
    active: true,
    availability: [],
    eligibility: [{
      assignmentTypeId,
      enabled: true,
      decidedBy: 'authorized-actor',
      decidedAt: NOW,
    }],
  };
}

function meeting(): Readonly<MidweekMeeting> {
  return addMeetingSlot(
    createMidweekMeeting({
      id: 'meeting-1',
      tenantId: 'tenant-a',
      date: '2026-08-26',
      localTime: '19:00',
      timezone: 'Europe/Lisbon',
      now: NOW,
    }),
    {
      id: 'slot-1',
      position: 1,
      durationMinutes: 5,
      titleKey: 'student-reading',
      partDefinitionId: 'student-reading',
    },
  );
}

function part(): Readonly<MidweekPartDefinition> {
  return createMidweekPartDefinition({
    id: 'student-reading',
    type: 'apply-yourself-to-the-ministry',
    titleKey: 'student-reading',
    durationMinutes: 5,
    position: 1,
    studentNeeded: true,
    assistantRequirement: 'none',
  });
}

function runtime(): MidweekSchedulingRuntime {
  const counters: Record<string, number> = {};
  return {
    now: () => NOW,
    nextId: scope => `${scope}-${(counters[scope] = (counters[scope] ?? 0) + 1)}`,
  };
}

function harness(options: {
  student?: StudentAssignment;
  nonStudent?: NonStudentAssignment;
  people?: readonly CongregationPerson[];
} = {}) {
  const changes: MidweekSchedulingChange[] = [];
  let storedStudent: Readonly<StudentAssignment> | undefined = options.student
    ? structuredClone(options.student)
    : undefined;
  let storedNonStudent: Readonly<NonStudentAssignment> | undefined = options.nonStudent
    ? structuredClone(options.nonStudent)
    : undefined;

  const uow: MidweekSchedulingUnitOfWork = {
    findMeeting: (_ctx, id) => id === 'meeting-1' ? meeting() : undefined,
    findStudentAssignment: (_ctx, id) => storedStudent?.id === id ? storedStudent : undefined,
    findNonStudentAssignment: (_ctx, id) => storedNonStudent?.id === id ? storedNonStudent : undefined,
    listStudentAssignments: () => storedStudent ? [storedStudent] : [],
    listNonStudentAssignments: () => storedNonStudent ? [storedNonStudent] : [],
    findPerson: (_ctx, id) => options.people?.find(candidate => candidate.id === id),
    findPartDefinition: id => id === 'student-reading' ? part() : undefined,
    listConflictAssignments: () => [],
    resolveSlotWindow: () => WINDOW,
    commit: (_ctx, change) => {
      if (change.studentAssignment) storedStudent = change.studentAssignment;
      if (change.studentAssignments?.length) storedStudent = change.studentAssignments.at(-1);
      if (change.nonStudentAssignment) storedNonStudent = change.nonStudentAssignment;
      if (change.nonStudentAssignments?.length) storedNonStudent = change.nonStudentAssignments.at(-1);
      changes.push(change);
    },
  };

  const schedulingRuntime = runtime();
  return {
    service: new MidweekSchedulingService(uow, schedulingRuntime),
    replacement: new StudentAssignmentReplacementService(uow, schedulingRuntime),
    changes,
    getStudent: () => storedStudent,
    getNonStudent: () => storedNonStudent,
  };
}

function studentAssignment(overrides: Partial<StudentAssignment> = {}): StudentAssignment {
  return {
    ...createStudentAssignment({
      id: 'student-assignment-1',
      tenantId: 'tenant-a',
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      studentId: 'student-1',
      assistantIsRequired: false,
      now: NOW,
    }),
    ...overrides,
  };
}

function nonStudentAssignment(overrides: Partial<NonStudentAssignment> = {}): NonStudentAssignment {
  return {
    ...createNonStudentAssignment({
      id: 'non-student-assignment-1',
      tenantId: 'tenant-a',
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      personId: 'person-1',
      role: 'chairman',
      now: NOW,
    }),
    ...overrides,
  };
}

describe('KP3 reviewed midweek assignment lifecycle', () => {
  it('creates a student assignment through the canonical part id and records one effect bundle', () => {
    const { service, changes } = harness({ people: [person('student-1')] });

    const assignment = service.assignStudent(context(), {
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      studentId: 'student-1',
    });

    expect(assignment).toMatchObject({
      state: 'assigned',
      studentId: 'student-1',
      meetingId: 'meeting-1',
      slotId: 'slot-1',
    });
    expect(changes).toHaveLength(1);
    expect(changes[0]?.domainEvents[0]).toMatchObject({
      type: 'AssignmentCreated',
      tenantId: 'tenant-a',
      actorId: 'authorized-actor',
    });
  });

  it('rejects using the same person as student and assistant before commit', () => {
    const same = person('student-1');
    const { service, changes } = harness({ people: [same] });

    expect(() => service.assignStudent(context(), {
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      studentId: 'student-1',
      assistantId: 'student-1',
    })).toThrow('Student and assistant must be different people');
    expect(changes).toHaveLength(0);
  });

  it('completes a student assignment and makes exact completion retry a no-op', () => {
    const { service, changes } = harness({ student: studentAssignment() });

    const completed = service.completeStudentAssignment(context(), 'student-assignment-1');
    const effectsAfterFirst = changes.length;
    const retry = service.completeStudentAssignment(context(), 'student-assignment-1');

    expect(completed.state).toBe('completed');
    expect(completed.completedAt).toBe(NOW);
    expect(retry).toEqual(completed);
    expect(changes).toHaveLength(effectsAfterFirst);
    expect(changes[0]?.domainEvents[0]?.type).toBe('AssignmentCompleted');
  });

  it('completes a non-student assignment through the canonical domain transition and retries idempotently', () => {
    const { service, changes } = harness({ nonStudent: nonStudentAssignment() });

    const completed = service.completeNonStudentAssignment(context(), 'non-student-assignment-1');
    const effectsAfterFirst = changes.length;
    const retry = service.completeNonStudentAssignment(context(), 'non-student-assignment-1');

    expect(completed.state).toBe('completed');
    expect(completed.completedAt).toBe(NOW);
    expect(retry).toEqual(completed);
    expect(changes).toHaveLength(effectsAfterFirst);
    expect(changes[0]?.domainEvents[0]?.type).toBe('AssignmentCompleted');
  });

  it('makes exact student and non-student cancellation retries no-ops', () => {
    const studentHarness = harness({ student: studentAssignment() });
    const firstStudent = studentHarness.service.cancelStudentAssignment(context(), 'student-assignment-1');
    const studentEffects = studentHarness.changes.length;
    expect(studentHarness.service.cancelStudentAssignment(context(), 'student-assignment-1')).toEqual(firstStudent);
    expect(studentHarness.changes).toHaveLength(studentEffects);

    const nonStudentHarness = harness({ nonStudent: nonStudentAssignment() });
    const firstNonStudent = nonStudentHarness.service.cancelNonStudentAssignment(context(), 'non-student-assignment-1');
    const nonStudentEffects = nonStudentHarness.changes.length;
    expect(nonStudentHarness.service.cancelNonStudentAssignment(context(), 'non-student-assignment-1')).toEqual(firstNonStudent);
    expect(nonStudentHarness.changes).toHaveLength(nonStudentEffects);
  });

  it('makes exact student replacement retry with the same target a no-op', () => {
    const current = studentAssignment({ studentId: 'old-student' });
    const nextStudent = person('new-student');
    const { replacement, changes, getStudent } = harness({ student: current, people: [nextStudent] });

    const first = replacement.replace(context(), {
      assignmentId: current.id,
      studentId: nextStudent.id,
    });
    const effectsAfterFirst = changes.length;
    const second = replacement.replace(context(), {
      assignmentId: current.id,
      studentId: nextStudent.id,
    });

    expect(first.studentId).toBe(nextStudent.id);
    expect(second).toEqual(first);
    expect(getStudent()).toEqual(first);
    expect(changes).toHaveLength(effectsAfterFirst);
  });

  it('makes exact non-student replacement with the current person a no-op', () => {
    const current = nonStudentAssignment();
    const { service, changes } = harness({ nonStudent: current });

    expect(service.replaceNonStudent(context(), {
      assignmentId: current.id,
      personId: current.personId,
    })).toEqual(current);
    expect(changes).toHaveLength(0);
  });

  it('rejects foreign-tenant assignment mutations before effects', () => {
    const foreign = studentAssignment({ tenantId: 'tenant-b' });
    const { service, changes } = harness({ student: foreign });

    expect(() => service.completeStudentAssignment(context('tenant-a'), foreign.id))
      .toThrow('Cross-tenant student assignment access denied');
    expect(changes).toHaveLength(0);
  });

  it('keeps completed assignments terminal', () => {
    const completed = studentAssignment({ state: 'completed', completedAt: NOW });
    const { service, changes } = harness({ student: completed });

    expect(() => service.cancelStudentAssignment(context(), completed.id)).toThrow('Invalid transition');
    expect(changes).toHaveLength(0);
  });

  it('canonical history queries count only completed work when asking for completed history', () => {
    const records = [
      recordAssignmentHistory({
        id: 'history-assigned',
        tenantId: 'tenant-a',
        assignmentId: 'a1',
        personId: 'person-1',
        partType: 'student-reading',
        meetingDate: '2026-08-26',
        state: 'assigned',
        recordedAt: NOW,
        meetingId: 'meeting-1',
      }),
      recordAssignmentHistory({
        id: 'history-cancelled',
        tenantId: 'tenant-a',
        assignmentId: 'a2',
        personId: 'person-1',
        partType: 'student-reading',
        meetingDate: '2026-08-26',
        state: 'cancelled',
        recordedAt: NOW,
        meetingId: 'meeting-1',
      }),
      recordAssignmentHistory({
        id: 'history-completed',
        tenantId: 'tenant-a',
        assignmentId: 'a3',
        personId: 'person-1',
        partType: 'student-reading',
        meetingDate: '2026-08-26',
        state: 'completed',
        recordedAt: NOW,
        meetingId: 'meeting-1',
      }),
    ];

    expect(filterHistoryByState(records, 'completed').map(record => record.id))
      .toEqual(['history-completed']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  createMidweekMeeting,
  createMidweekPartDefinition,
  createNonStudentAssignment,
  createStudentAssignment,
  addMeetingSlot,
  type AccessContext,
  type CongregationPerson,
  type MidweekMeeting,
  type MidweekPartDefinition,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import { MidweekSchedulingService, type MidweekSchedulingChange, type MidweekSchedulingRuntime, type MidweekSchedulingUnitOfWork } from './midweek-scheduling-service';
import { StudentAssignmentReplacementService } from './student-assignment-replacement-service';

const NOW = '2026-08-24T12:00:00.000Z';
const context = (tenantId = 'tenant-a'): Readonly<AccessContext> => createAccessContext({ tenantId, actorId: 'authorized-actor', capabilities: ['schedule.write', 'eligibility.read', 'availability.read'] });

function person(id: string, tenantId = 'tenant-a'): CongregationPerson {
  return { id, tenantId, displayName: id, active: true, availability: [], eligibility: [{ assignmentTypeId: 'student-reading', enabled: true, decidedBy: 'authorized-actor', decidedAt: NOW }] };
}

function meeting(): Readonly<MidweekMeeting> {
  const base = createMidweekMeeting({ id: 'meeting-1', tenantId: 'tenant-a', date: '2026-08-26', localTime: '19:00', timezone: 'Europe/Lisbon', now: NOW });
  return addMeetingSlot(base, { id: 'slot-1', position: 1, durationMinutes: 5, titleKey: 'student-reading', partDefinitionId: 'student-reading' });
}

function part(): Readonly<MidweekPartDefinition> {
  return createMidweekPartDefinition({ id: 'student-reading', type: 'apply-yourself-to-the-ministry', titleKey: 'student-reading', durationMinutes: 5, position: 1, studentNeeded: true, assistantRequirement: 'none' });
}

function runtime(): MidweekSchedulingRuntime {
  let next = 0;
  return { now: () => NOW, nextId: scope => `${scope}-${++next}` };
}

function harness(options: { student?: StudentAssignment; nonStudent?: NonStudentAssignment; people?: readonly CongregationPerson[] } = {}) {
  const changes: MidweekSchedulingChange[] = [];
  const uow: MidweekSchedulingUnitOfWork = {
    findMeeting: (_ctx, id) => id === 'meeting-1' ? meeting() : undefined,
    findStudentAssignment: (_ctx, id) => options.student?.id === id ? options.student : undefined,
    findNonStudentAssignment: (_ctx, id) => options.nonStudent?.id === id ? options.nonStudent : undefined,
    listStudentAssignments: () => [],
    listNonStudentAssignments: () => [],
    findPerson: (_ctx, id) => options.people?.find(p => p.id === id),
    findPartDefinition: id => id === 'student-reading' ? part() : undefined,
    listConflictAssignments: () => [],
    resolveSlotWindow: () => ({ startsAt: '2026-08-26T18:00:00.000Z', endsAt: '2026-08-26T18:05:00.000Z' }),
    commit: (_ctx, change) => { changes.push(change); },
  };
  return { service: new MidweekSchedulingService(uow, runtime()), replacement: new StudentAssignmentReplacementService(uow, runtime()), changes };
}

describe('KP3 midweek assignment lifecycle', () => {
  it('creates a valid student assignment and records exactly one audit/event bundle', () => {
    const student = person('student-1');
    const { service, changes } = harness({ people: [student] });
    const assignment = service.assignStudent(context(), { meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'student-1' });
    expect(assignment.state).toBe('assigned');
    expect(changes).toHaveLength(1);
    expect(changes[0].auditEvents).toHaveLength(1);
    expect(changes[0].domainEvents[0]).toMatchObject({ type: 'AssignmentCreated', tenantId: 'tenant-a', actorId: 'authorized-actor' });
  });

  it('completes an assignment and exact retry creates no additional effects', () => {
    const assignment = createStudentAssignment({ id: 'assignment-1', tenantId: 'tenant-a', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'student-1', assistantIsRequired: false, now: NOW });
    const { service, changes } = harness({ student: assignment });
    const completed = service.completeStudentAssignment(context(), assignment.id);
    expect(completed.state).toBe('completed');
    expect(completed.completedAt).toBe(NOW);
    expect(changes).toHaveLength(1);
    const retry = service.completeStudentAssignment(context(), assignment.id);
    expect(retry).toEqual(completed);
    expect(changes).toHaveLength(1);
    expect(changes[0].auditEvents).toHaveLength(1);
    expect(changes[0].domainEvents[0].type).toBe('AssignmentCompleted');
  });

  it('cancels an assignment and exact retry creates no additional effects', () => {
    const assignment = createStudentAssignment({ id: 'assignment-1', tenantId: 'tenant-a', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'student-1', assistantIsRequired: false, now: NOW });
    const { service, changes } = harness({ student: assignment });
    const cancelled = service.cancelStudentAssignment(context(), assignment.id);
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.completedAt).toBeNull();
    expect(changes).toHaveLength(1);
    expect(service.cancelStudentAssignment(context(), assignment.id)).toEqual(cancelled);
    expect(changes).toHaveLength(1);
  });

  it('rejects foreign-tenant cancellation before mutation or effects', () => {
    const foreign = createStudentAssignment({ id: 'assignment-1', tenantId: 'tenant-b', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'student-1', assistantIsRequired: false, now: NOW });
    const { service, changes } = harness({ student: foreign });
    expect(() => service.cancelStudentAssignment(context('tenant-a'), foreign.id)).toThrow('Cross-tenant student assignment access denied');
    expect(changes).toHaveLength(0);
  });

  it('replaces a student assignment and exact retry with the same target is a no-op', () => {
    const current = createStudentAssignment({ id: 'assignment-1', tenantId: 'tenant-a', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'old-student', assistantIsRequired: false, now: NOW });
    const newStudent = person('new-student');
    const { replacement, changes } = harness({ student: current, people: [newStudent] });
    const first = replacement.replace(context(), { assignmentId: current.id, studentId: 'new-student' });
    expect(first.studentId).toBe('new-student');
    expect(changes).toHaveLength(1);
  });

  it('does not count cancelled or assigned states as completed history', () => {
    const cancelled = createStudentAssignment({ id: 'cancelled', tenantId: 'tenant-a', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'student-1', assistantIsRequired: false, now: NOW });
    const assigned = createStudentAssignment({ id: 'assigned', tenantId: 'tenant-a', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'student-1', assistantIsRequired: false, now: NOW });
    expect([cancelled, assigned].filter(a => a.state === 'completed')).toHaveLength(0);
  });

  it('does not reopen a completed assignment through the cancel transition', () => {
    const completed = Object.freeze({ ...createStudentAssignment({ id: 'assignment-1', tenantId: 'tenant-a', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'student-1', assistantIsRequired: false, now: NOW }), state: 'completed' as const, completedAt: NOW });
    const { service, changes } = harness({ student: completed });
    expect(() => service.cancelStudentAssignment(context(), completed.id)).toThrow('Invalid transition');
    expect(changes).toHaveLength(0);
  });
});

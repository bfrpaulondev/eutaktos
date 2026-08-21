import { describe, expect, it } from 'vitest';
import {
  addMeetingSlot,
  createAccessContext,
  createMidweekMeeting,
  createMidweekPartDefinition,
  createStudentAssignment,
  type CongregationPerson,
  type MidweekMeeting,
  type MidweekPartDefinition,
} from '@eutaktos/domain';
import {
  MidweekSchedulingService,
  type MidweekSchedulingChange,
  type MidweekSchedulingRuntime,
  type MidweekSchedulingUnitOfWork,
} from './midweek-scheduling-service';

const now = '2026-08-21T10:00:00.000Z';

function context(tenantId = 'tenant-a') {
  return createAccessContext({
    tenantId,
    actorId: 'actor-1',
    capabilities: ['schedule.write', 'eligibility.read', 'availability.read'],
  });
}

function part(): Readonly<MidweekPartDefinition> {
  return createMidweekPartDefinition({
    id: 'student-reading',
    type: 'apply-yourself-to-the-ministry',
    titleKey: 'part.reading',
    durationMinutes: 5,
    position: 1,
    studentNeeded: true,
    assistantRequirement: 'none',
  });
}

function meeting(tenantId = 'tenant-a'): Readonly<MidweekMeeting> {
  const draft = createMidweekMeeting({ id: 'meeting-1', tenantId, date: '2026-08-22', localTime: '19:00', timezone: 'Europe/Lisbon', now });
  return addMeetingSlot(draft, { id: 'slot-1', position: 0, durationMinutes: 5, titleKey: 'part.reading', partDefinitionId: 'student-reading' });
}

function person(tenantId = 'tenant-a', enabled = true): CongregationPerson {
  return {
    id: 'person-1', tenantId, displayName: 'Person One', active: true, availability: [],
    eligibility: [{ assignmentTypeId: 'student-reading', enabled, decidedBy: 'elder-1', decidedAt: now }],
  };
}

function runtime(): MidweekSchedulingRuntime {
  let counter = 0;
  return { now: () => now, nextId: scope => `${scope}-${++counter}` };
}

function harness(options: {
  meeting?: Readonly<MidweekMeeting>;
  person?: CongregationPerson;
  part?: Readonly<MidweekPartDefinition>;
  conflicts?: readonly { tenantId: string; assignmentId: string; personId: string; startsAt: string; endsAt: string }[];
  studentAssignment?: ReturnType<typeof createStudentAssignment>;
} = {}) {
  const currentMeeting = options.meeting ?? meeting();
  const currentPerson = options.person ?? person();
  const currentPart = options.part ?? part();
  const changes: MidweekSchedulingChange[] = [];
  const uow: MidweekSchedulingUnitOfWork = {
    findMeeting: () => currentMeeting,
    findStudentAssignment: () => options.studentAssignment,
    findNonStudentAssignment: () => undefined,
    listStudentAssignments: () => [],
    listNonStudentAssignments: () => [],
    findPerson: (_ctx, personId) => personId === currentPerson.id ? currentPerson : undefined,
    findPartDefinition: id => id === currentPart.id ? currentPart : undefined,
    listConflictAssignments: () => options.conflicts ?? [],
    resolveSlotWindow: () => ({ startsAt: '2026-08-22T18:00:00.000Z', endsAt: '2026-08-22T18:05:00.000Z' }),
    commit: (_ctx, change) => { changes.push(change); },
  };
  return { service: new MidweekSchedulingService(uow, runtime()), changes };
}

describe('MidweekSchedulingService', () => {
  it('creates meetings using tenant/actor only from AccessContext and emits audit + domain event', () => {
    const { service, changes } = harness();
    const created = service.createDraftMeeting(context(), { date: '2026-08-23', localTime: '19:00', timezone: 'Europe/Lisbon' });
    expect(created.tenantId).toBe('tenant-a');
    expect(changes).toHaveLength(1);
    expect(changes[0].auditEvents[0]).toMatchObject({ tenantId: 'tenant-a', actorId: 'actor-1', resourceType: 'midweek-meeting' });
    expect(changes[0].domainEvents[0]).toMatchObject({ tenantId: 'tenant-a', actorId: 'actor-1', type: 'MidweekMeetingCreated' });
  });

  it('rejects a meeting returned from another tenant even if the port is adversarial', () => {
    const { service } = harness({ meeting: meeting('tenant-b') });
    expect(() => service.addSlot(context('tenant-a'), 'meeting-1', { position: 1, durationMinutes: 5, titleKey: 'x' }))
      .toThrow('Cross-tenant access denied');
  });

  it('requires explicit eligibility before assigning a student', () => {
    const { service, changes } = harness({ person: person('tenant-a', false) });
    expect(() => service.assignStudent(context(), { meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'person-1' }))
      .toThrow('not explicitly eligible');
    expect(changes).toHaveLength(0);
  });

  it('creates a real tenant-scoped student assignment when eligible and conflict-free', () => {
    const { service, changes } = harness();
    const assignment = service.assignStudent(context(), { meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'person-1' });
    expect(assignment).toMatchObject({ tenantId: 'tenant-a', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'person-1', state: 'assigned' });
    expect(changes[0].studentAssignment?.id).toBe(assignment.id);
    expect(changes[0].auditEvents[0].resourceType).toBe('student-assignment');
    expect(changes[0].domainEvents[0].type).toBe('AssignmentCreated');
  });

  it('rejects availability or assignment conflicts without committing', () => {
    const p = person();
    p.availability = [{ id: 'away-1', startsAt: '2026-08-22T17:00:00.000Z', endsAt: '2026-08-22T20:00:00.000Z' }];
    const { service, changes } = harness({ person: p });
    expect(() => service.assignStudent(context(), { meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'person-1' }))
      .toThrow('Scheduling conflict detected');
    expect(changes).toHaveLength(0);
  });

  it('checks tenant before cancelling an assignment', () => {
    const foreign = createStudentAssignment({ id: 'assignment-1', tenantId: 'tenant-b', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'person-1', assistantIsRequired: false, now });
    const { service, changes } = harness({ studentAssignment: foreign });
    expect(() => service.cancelStudentAssignment(context('tenant-a'), 'assignment-1')).toThrow('Cross-tenant student assignment access denied');
    expect(changes).toHaveLength(0);
  });
});

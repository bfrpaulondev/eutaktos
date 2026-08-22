import { describe, expect, it } from 'vitest';
import {
  addMeetingSlot,
  createAccessContext,
  createAssignmentResponse,
  createDutyAssignment,
  createDutyDefinition,
  createMidweekMeeting,
  createMidweekPartDefinition,
  createNotificationPreferences,
  createStudentAssignment,
  updateChannel,
  type Capability,
  type CongregationPerson,
  type DutyAssignment,
  type DutyDefinition,
} from '@eutaktos/domain';
import { StudentAssignmentReplacementService } from './student-assignment-replacement-service';
import { DutySchedulingService, type DutySchedulingChange, type DutySchedulingUnitOfWork } from './duty-scheduling-service';
import { AssignmentResponseService, type AssignmentResponseChange } from './assignment-response-service';
import { NotificationIntentService, type NotificationIntentChange } from './notification-intent-service';
import { MigrationWorkflowService, type MigrationRollbackChange, type MigrationWorkflowChange, type StoredMigration } from './migration-workflow-service';
import { createMigrationSchema } from './migration-schema';
import type { MidweekSchedulingChange, MidweekSchedulingUnitOfWork } from './midweek-scheduling-service';

const AT = '2026-08-21T10:00:00.000Z';
const DUTY_START = '2026-08-22T18:00:00.000Z';
const DUTY_END = '2026-08-22T19:00:00.000Z';

function ctx(actorId = 'person-new', capabilities: readonly Capability[] = ['schedule.read', 'schedule.write', 'eligibility.read', 'availability.read', 'people.write']) {
  return createAccessContext({ tenantId: 'tenant-a', actorId, capabilities });
}

function schedulingPerson(id: string, eligibilityId: string, tenantId = 'tenant-a'): CongregationPerson {
  return {
    id, tenantId, displayName: id, active: true, availability: [],
    eligibility: [{ assignmentTypeId: eligibilityId, enabled: true, decidedBy: 'elder-1', decidedAt: AT }],
  };
}

function idRuntime() {
  let counter = 0;
  return { now: () => AT, nextId: (scope: string) => `${scope}-${++counter}` };
}

describe('reviewed K42 student replacement', () => {
  it('replaces student/assistant through the real scheduling UoW with eligibility, audit and event', () => {
    const draft = addMeetingSlot(
      createMidweekMeeting({ id: 'meeting-1', tenantId: 'tenant-a', date: '2026-08-22', localTime: '19:00', timezone: 'Europe/Lisbon', now: AT }),
      { id: 'slot-1', position: 1, durationMinutes: 5, titleKey: 'part', partDefinitionId: 'student-part' },
    );
    const part = createMidweekPartDefinition({ id: 'student-part', type: 'apply-yourself-to-the-ministry', titleKey: 'part', durationMinutes: 5, position: 1, studentNeeded: true, assistantRequirement: 'optional' });
    const current = createStudentAssignment({ id: 'student-assignment-1', tenantId: 'tenant-a', meetingId: 'meeting-1', slotId: 'slot-1', studentId: 'old-student', assistantIsRequired: false, now: AT });
    const people = new Map([
      ['student-new', schedulingPerson('student-new', 'student-part')],
      ['assistant-new', schedulingPerson('assistant-new', 'student-part')],
    ]);
    const changes: MidweekSchedulingChange[] = [];
    const uow: MidweekSchedulingUnitOfWork = {
      findMeeting: () => draft,
      findStudentAssignment: () => current,
      findNonStudentAssignment: () => undefined,
      listStudentAssignments: () => [current],
      listNonStudentAssignments: () => [],
      findPerson: (_context, id) => people.get(id),
      findPartDefinition: id => id === part.id ? part : undefined,
      listConflictAssignments: () => [{ tenantId: 'tenant-a', assignmentId: `${current.id}:student`, personId: 'student-new', startsAt: '2026-08-22T18:00:00.000Z', endsAt: '2026-08-22T18:05:00.000Z' }],
      resolveSlotWindow: () => ({ startsAt: '2026-08-22T18:00:00.000Z', endsAt: '2026-08-22T18:05:00.000Z' }),
      commit: (_context, change) => { changes.push(change); },
    };
    const service = new StudentAssignmentReplacementService(uow, idRuntime());
    const replaced = service.replace(ctx(), { assignmentId: current.id, studentId: 'student-new', assistantId: 'assistant-new' });
    expect(replaced).toMatchObject({ id: current.id, studentId: 'student-new', assistantId: 'assistant-new', state: 'assigned' });
    expect(changes).toHaveLength(1);
    expect(changes[0].auditEvents[0]).toMatchObject({ resourceType: 'student-assignment', actorId: 'person-new' });
    expect(changes[0].domainEvents[0].type).toBe('AssignmentReplaced');
  });
});

describe('reviewed K45 duties workflow', () => {
  function dutyHarness(conflict = false) {
    let clock = AT;
    let definition: Readonly<DutyDefinition> | undefined = createDutyDefinition({ id: 'sound', tenantId: 'tenant-a', key: 'sound', label: 'Sound' });
    let assignment: Readonly<DutyAssignment> | undefined;
    const changes: DutySchedulingChange[] = [];
    const person = schedulingPerson('person-new', 'sound');
    const uow: DutySchedulingUnitOfWork = {
      findDefinition: () => definition,
      findAssignment: () => assignment,
      findPerson: () => person,
      listConflictAssignments: () => conflict ? [{ tenantId: 'tenant-a', assignmentId: 'other', personId: person.id, startsAt: DUTY_START, endsAt: DUTY_END }] : [],
      commit: (_context, change) => { changes.push(change); definition = change.definition ?? definition; assignment = change.assignment ?? assignment; },
    };
    let counter = 0;
    const service = new DutySchedulingService(uow, { now: () => clock, nextId: scope => `${scope}-${++counter}` });
    return { service, changes, setClock: (value: string) => { clock = value; } };
  }

  it('checks explicit eligibility/conflicts and commits duty + audit + event atomically', () => {
    const ok = dutyHarness();
    const assigned = ok.service.assign(ctx(), { definitionId: 'sound', personId: 'person-new', startsAt: DUTY_START, endsAt: DUTY_END });
    expect(assigned.state).toBe('assigned');
    expect(ok.changes[0].auditEvents[0].resourceType).toBe('duty-assignment');
    expect(ok.changes[0].domainEvents[0].type).toBe('DutyAssigned');

    const blocked = dutyHarness(true);
    expect(() => blocked.service.assign(ctx(), { definitionId: 'sound', personId: 'person-new', startsAt: DUTY_START, endsAt: DUTY_END })).toThrow('Scheduling conflict detected');
    expect(blocked.changes).toHaveLength(0);
  });

  it('supports the previously missing completed lifecycle as an audited terminal state', () => {
    const h = dutyHarness();
    h.service.assign(ctx(), { definitionId: 'sound', personId: 'person-new', startsAt: DUTY_START, endsAt: DUTY_END });
    h.setClock('2026-08-22T18:30:00.000Z');
    const completed = h.service.complete(ctx(), 'duty-assignment-1');
    expect(completed.state).toBe('completed');
    expect(h.changes.at(-1)?.domainEvents[0].type).toBe('DutyCompleted');
  });
});

describe('reviewed K46 authenticated publisher responses', () => {
  it('allows only the assigned actor and makes an exact retry a no-op with no duplicate audit/event', () => {
    let current = createAssignmentResponse({ id: 'response-1', tenantId: 'tenant-a', assignmentId: 'assignment-1', personId: 'person-new', now: AT });
    const changes: AssignmentResponseChange[] = [];
    const service = new AssignmentResponseService({
      findResponse: () => current,
      commit: (_context, change) => { changes.push(change); current = change.response; },
    }, idRuntime());
    service.confirm(ctx('person-new'), current.id, { code: 'accepted' });
    service.confirm(ctx('person-new'), current.id, { code: 'accepted' });
    expect(changes).toHaveLength(1);
    expect(current.status).toBe('confirmed');
    expect(changes[0].domainEvents[0].type).toBe('AssignmentResponseUpdated');
    expect(() => service.confirm(ctx('different-actor'), current.id)).toThrow('assigned person');
    expect(changes).toHaveLength(1);
  });
});

describe('reviewed K47 notification intent', () => {
  it('queues only consented active channels as pending and deduplicates without pretending delivery', () => {
    const preferences = createNotificationPreferences({ id: 'prefs-1', tenantId: 'tenant-a', personId: 'recipient-1', now: AT });
    let delivery: NotificationIntentChange['delivery'] | undefined;
    const changes: NotificationIntentChange[] = [];
    const service = new NotificationIntentService({
      findPreferences: () => preferences,
      findDeliveryByIdempotencyKey: (_context, key) => delivery?.idempotencyKey === key ? delivery : undefined,
      commit: (_context, change) => { changes.push(change); delivery = change.delivery; },
    }, idRuntime());
    const first = service.queueAssignmentIntent(ctx(), { sourceEventId: 'event-1', kind: 'created', assignmentId: 'assignment-1', recipientId: 'recipient-1', locale: 'pt-PT' });
    const second = service.queueAssignmentIntent(ctx(), { sourceEventId: 'event-1', kind: 'created', assignmentId: 'assignment-1', recipientId: 'recipient-1', locale: 'pt-PT' });
    expect(first).toMatchObject({ status: 'pending', channel: 'in-app', deliveredAt: null, lastAttemptAt: null });
    expect(second?.id).toBe(first?.id);
    expect(changes).toHaveLength(1);
  });

  it('does nothing when every channel is disabled or opted out', () => {
    const defaults = createNotificationPreferences({ id: 'prefs-1', tenantId: 'tenant-a', personId: 'recipient-1', now: AT });
    const preferences = updateChannel(defaults, 'in-app', { enabled: false, optedIn: false }, AT);
    const changes: NotificationIntentChange[] = [];
    const service = new NotificationIntentService({ findPreferences: () => preferences, findDeliveryByIdempotencyKey: () => undefined, commit: (_context, change) => { changes.push(change); } }, idRuntime());
    expect(service.queueAssignmentIntent(ctx(), { sourceEventId: 'event-1', kind: 'reminder', assignmentId: 'assignment-1', recipientId: 'recipient-1', locale: 'pt-PT' })).toBeUndefined();
    expect(changes).toHaveLength(0);
  });
});

describe('reviewed K48 migration confirmation and rollback', () => {
  it('rejects a stale human confirmation before any persistence', () => {
    let existing = [{ id: 'person-1', externalId: 'ext-1', displayName: 'Old', active: true }];
    const commits: MigrationWorkflowChange[] = [];
    const service = new MigrationWorkflowService({
      listExistingPeople: () => existing,
      commitMigration: (_context, change) => { commits.push(change); },
      findMigration: () => undefined,
      commitRollback: () => undefined,
    }, idRuntime());
    const rows = createMigrationSchema([{ externalId: 'ext-1', displayName: 'New', active: true }], AT).rows;
    const prepared = service.prepare(ctx(), rows);
    existing = [{ id: 'person-1', externalId: 'ext-1', displayName: 'Changed concurrently', active: true }];
    expect(() => service.execute(ctx(), rows, prepared.confirmation)).toThrow('stale');
    expect(commits).toHaveLength(0);
  });

  it('persists only an explicitly confirmed preview and keeps a reversible rollback plan', () => {
    const existing = [{ id: 'person-1', externalId: 'ext-1', displayName: 'Old', active: true }];
    let stored: Readonly<StoredMigration> | undefined;
    const commits: MigrationWorkflowChange[] = [];
    const rollbacks: MigrationRollbackChange[] = [];
    const runtime = idRuntime();
    const service = new MigrationWorkflowService({
      listExistingPeople: () => existing,
      commitMigration: (_context, change) => { commits.push(change); stored = { log: change.log, rollbackPlan: change.rollbackPlan }; },
      findMigration: () => stored,
      commitRollback: (_context, change) => { rollbacks.push(change); stored = { log: change.log, rollbackPlan: change.rollbackPlan }; },
    }, runtime);
    const rows = createMigrationSchema([{ externalId: 'ext-1', displayName: 'New', active: true }, { externalId: 'ext-2', displayName: 'Created', active: true }], AT).rows;
    const prepared = service.prepare(ctx(), rows);
    const applied = service.execute(ctx(), rows, prepared.confirmation);
    expect(commits).toHaveLength(1);
    expect(applied.log.status).toBe('completed');
    expect(applied.rollbackPlan.steps.map(step => step.type).sort()).toEqual(['delete', 'restore']);
    const rolledBack = service.rollback(ctx(), applied.log.migrationId);
    expect(rolledBack.status).toBe('rolled-back');
    expect(rollbacks).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import {
  addMeetingSlot,
  createAccessContext,
  createAssignmentResponse,
  createMidweekMeeting,
  createMidweekPartDefinition,
  createNotificationPreferences,
  detectSchedulingConflicts,
  resolveZonedLocalTime,
  type AccessContext,
  type CongregationPerson,
  type MidweekMeeting,
  type MidweekPartDefinition,
  type StudentAssignment,
} from '@eutaktos/domain';
import { AvailabilityService } from './availability-service';
import { EligibilityService } from './eligibility-service';
import {
  AssignmentResponseService,
  type AssignmentResponseChange,
} from './assignment-response-service';
import {
  MidweekSchedulingService,
  type MidweekSchedulingChange,
  type MidweekSchedulingRuntime,
  type MidweekSchedulingUnitOfWork,
} from './midweek-scheduling-service';
import {
  MigrationWorkflowService,
  type MigrationRollbackChange,
  type MigrationWorkflowChange,
  type StoredMigration,
} from './migration-workflow-service';
import { createMigrationSchema } from './migration-schema';
import {
  NotificationIntentService,
  type NotificationIntentChange,
  type NotificationIntentRuntime,
} from './notification-intent-service';
import type {
  ApplicationRuntime,
  PeopleUnitOfWork,
  PersonChange,
} from './people-service';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ACTOR = 'authorized-actor';
const NOW = '2026-08-24T12:00:00.000Z';
const DEFAULT_CAPABILITIES: AccessContext['capabilities'] = [
  'people.read',
  'people.write',
  'availability.read',
  'availability.write',
  'eligibility.read',
  'eligibility.write',
  'schedule.read',
  'schedule.write',
];

function context(
  tenantId = TENANT_A,
  actorId = ACTOR,
  capabilities: AccessContext['capabilities'] = DEFAULT_CAPABILITIES,
): Readonly<AccessContext> {
  return createAccessContext({ tenantId, actorId, capabilities });
}

function appRuntime(): ApplicationRuntime {
  const counters: Record<string, number> = {};
  return {
    now: () => NOW,
    nextId: scope => `${scope}-${(counters[scope] = (counters[scope] ?? 0) + 1)}`,
  };
}

function notificationRuntime(): NotificationIntentRuntime {
  const counters: Record<string, number> = {};
  return {
    now: () => NOW,
    nextId: scope => `${scope}-${(counters[scope] = (counters[scope] ?? 0) + 1)}`,
  };
}

function basePerson(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: TENANT_A,
    displayName: 'Pilot Person PII',
    active: true,
    availability: [],
    eligibility: [],
    ...overrides,
  };
}

class StatefulPeopleUow implements PeopleUnitOfWork {
  person: CongregationPerson;
  readonly changes: PersonChange[] = [];
  failCommit = false;

  constructor(seed: CongregationPerson = basePerson()) {
    this.person = structuredClone(seed);
  }

  list(ctx: AccessContext): readonly CongregationPerson[] {
    return this.person.tenantId === ctx.tenantId ? [structuredClone(this.person)] : [];
  }

  findById(ctx: AccessContext, personId: string): CongregationPerson | undefined {
    return this.person.tenantId === ctx.tenantId && this.person.id === personId
      ? structuredClone(this.person)
      : undefined;
  }

  commitCreate(_ctx: AccessContext, change: PersonChange): CongregationPerson {
    if (this.failCommit) throw new Error('simulated persistence failure');
    this.person = structuredClone(change.person);
    this.changes.push(structuredClone(change));
    return structuredClone(this.person);
  }

  commitUpdate(_ctx: AccessContext, change: PersonChange): CongregationPerson {
    if (this.failCommit) throw new Error('simulated persistence failure');
    this.person = structuredClone(change.person);
    this.changes.push(structuredClone(change));
    return structuredClone(this.person);
  }
}

function studentPart(): Readonly<MidweekPartDefinition> {
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

function draftMeeting(): Readonly<MidweekMeeting> {
  return addMeetingSlot(
    createMidweekMeeting({
      id: 'meeting-1',
      tenantId: TENANT_A,
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

function schedulingRuntime(): MidweekSchedulingRuntime {
  const counters: Record<string, number> = {};
  return {
    now: () => NOW,
    nextId: scope => `${scope}-${(counters[scope] = (counters[scope] ?? 0) + 1)}`,
  };
}

function midweekHarness() {
  let meeting = draftMeeting();
  let student: Readonly<StudentAssignment> | undefined;
  const part = studentPart();
  const person: CongregationPerson = basePerson({
    eligibility: [{
      assignmentTypeId: part.id,
      enabled: true,
      decidedBy: ACTOR,
      decidedAt: NOW,
    }],
  });
  const changes: MidweekSchedulingChange[] = [];

  const uow: MidweekSchedulingUnitOfWork = {
    findMeeting: (_ctx, id) => id === meeting.id ? meeting : undefined,
    findStudentAssignment: (_ctx, id) => student?.id === id ? student : undefined,
    findNonStudentAssignment: () => undefined,
    listStudentAssignments: () => student ? [student] : [],
    listNonStudentAssignments: () => [],
    findPerson: (_ctx, id) => id === person.id ? structuredClone(person) : undefined,
    findPartDefinition: id => id === part.id ? part : undefined,
    listConflictAssignments: () => [],
    resolveSlotWindow: () => ({
      startsAt: '2026-08-26T18:00:00.000Z',
      endsAt: '2026-08-26T18:05:00.000Z',
    }),
    commit: (_ctx, change) => {
      if (change.meeting) meeting = change.meeting;
      if (change.studentAssignment) student = change.studentAssignment;
      if (change.studentAssignments?.length) student = change.studentAssignments.at(-1);
      changes.push(change);
    },
  };

  return {
    service: new MidweekSchedulingService(uow, schedulingRuntime()),
    changes,
    getStudent: () => student,
  };
}

describe('KP8 integrated MVP scheduling/application gate', () => {
  it('KP1: rejects missing capability and cross-tenant writes before persistence', () => {
    const uow = new StatefulPeopleUow();
    const availability = new AvailabilityService(uow, appRuntime());
    const eligibility = new EligibilityService(uow, appRuntime());

    expect(() => availability.addUnavailability(
      context(TENANT_A, ACTOR, ['people.read']),
      {
        personId: 'person-1',
        startsAt: '2026-09-01T10:00:00Z',
        endsAt: '2026-09-01T11:00:00Z',
      },
    )).toThrow('missing capability availability.write');

    expect(() => eligibility.setEligibility(
      context(TENANT_B, 'foreign-actor', ['people.read', 'eligibility.write']),
      { personId: 'person-1', assignmentTypeId: 'student-reading', enabled: true },
    )).toThrow('Person not found');

    expect(uow.changes).toHaveLength(0);
    expect(uow.person.availability).toHaveLength(0);
    expect(uow.person.eligibility).toHaveLength(0);
  });

  it('KP2/KP7: preserves explicit false decisions and makes exact retries effect-free', () => {
    const uow = new StatefulPeopleUow();
    const runtime = appRuntime();
    const eligibility = new EligibilityService(uow, runtime);
    const availability = new AvailabilityService(uow, runtime);

    const eligibilityInput = {
      personId: 'person-1',
      assignmentTypeId: 'student-reading',
      enabled: false,
    };
    eligibility.setEligibility(context(), eligibilityInput);
    const afterDecision = uow.changes.length;
    eligibility.setEligibility(context(), eligibilityInput);

    expect(uow.person.eligibility).toHaveLength(1);
    expect(uow.person.eligibility[0]).toMatchObject({
      assignmentTypeId: 'student-reading',
      enabled: false,
      decidedBy: ACTOR,
    });
    expect(uow.changes).toHaveLength(afterDecision);

    const availabilityInput = {
      personId: 'person-1',
      startsAt: '2026-09-01T10:00:00Z',
      endsAt: '2026-09-01T11:00:00Z',
      reasonCode: 'away' as const,
    };
    availability.addUnavailability(context(), availabilityInput);
    const afterAvailability = uow.changes.length;
    availability.addUnavailability(context(), availabilityInput);

    expect(uow.person.availability).toHaveLength(1);
    expect(uow.changes).toHaveLength(afterAvailability);
  });

  it('KP3: completes a real student assignment once and keeps completion terminal/idempotent', () => {
    const h = midweekHarness();
    const assigned = h.service.assignStudent(context(), {
      meetingId: 'meeting-1',
      slotId: 'slot-1',
      studentId: 'person-1',
    });
    expect(assigned.state).toBe('assigned');

    const completed = h.service.completeStudentAssignment(context(), assigned.id);
    const afterComplete = h.changes.length;
    const retry = h.service.completeStudentAssignment(context(), assigned.id);

    expect(completed.state).toBe('completed');
    expect(retry).toEqual(completed);
    expect(h.getStudent()).toEqual(completed);
    expect(h.changes).toHaveLength(afterComplete);
    expect(h.changes.at(-1)?.domainEvents[0]?.type).toBe('AssignmentCompleted');
    expect(() => h.service.cancelStudentAssignment(context(), assigned.id)).toThrow('Invalid transition');
    expect(h.changes).toHaveLength(afterComplete);
  });

  it('KP4: reports deterministic hard conflicts without ranking or cross-tenant leakage', () => {
    const candidate = {
      tenantId: TENANT_A,
      assignmentId: 'candidate',
      personId: 'person-1',
      startsAt: '2026-08-26T18:00:00Z',
      endsAt: '2026-08-26T19:00:00Z',
    };
    const result = detectSchedulingConflicts({
      tenantId: TENANT_A,
      candidate,
      assignments: [
        {
          tenantId: TENANT_B,
          assignmentId: 'foreign',
          personId: 'person-1',
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
        },
        {
          tenantId: TENANT_A,
          assignmentId: 'local',
          personId: 'person-1',
          startsAt: '2026-08-26T18:30:00Z',
          endsAt: '2026-08-26T19:30:00Z',
        },
      ],
      unavailable: [{
        tenantId: TENANT_A,
        personId: 'person-1',
        sourceId: 'away',
        startsAt: '2026-08-26T17:30:00Z',
        endsAt: '2026-08-26T18:15:00Z',
      }],
    });

    expect(result.map(item => item.sourceId)).toEqual(['local', 'away']);
    expect(JSON.stringify(result)).not.toMatch(/score|rank|recommend/i);
  });

  it('KP5: rejects nonexistent Lisbon civil time and resolves autumn ambiguity deterministically', () => {
    expect(() => resolveZonedLocalTime('2026-03-29', '01:30', 'Europe/Lisbon'))
      .toThrow('does not exist');
    expect(resolveZonedLocalTime('2026-10-25', '01:30', 'Europe/Lisbon'))
      .toEqual({ instant: '2026-10-25T00:30:00.000Z', ambiguous: true });
  });

  it('KP6: performs confirmed migration changes and reverses them through the canonical rollback plan', () => {
    type Existing = {
      id: string;
      externalId: string;
      displayName: string;
      active: boolean;
      preferredLocale?: string;
    };
    const original: Existing[] = [
      { id: 'person-existing', externalId: 'ext-1', displayName: 'Original', active: true },
    ];
    let existing: Existing[] = structuredClone(original);
    let stored: Readonly<StoredMigration> | undefined;
    const migrations: MigrationWorkflowChange[] = [];
    const rollbacks: MigrationRollbackChange[] = [];
    let counter = 0;
    const runtime = {
      now: () => NOW,
      nextId: (scope: string) => `${scope}-${++counter}`,
    };
    const service = new MigrationWorkflowService({
      listExistingPeople: () => structuredClone(existing),
      commitMigration: (_ctx, change) => {
        migrations.push(change);
        for (const item of change.changes) {
          const next: Existing = {
            id: item.internalId,
            externalId: item.source.externalId,
            displayName: item.source.displayName,
            active: item.source.active,
            ...(item.source.preferredLocale ? { preferredLocale: item.source.preferredLocale } : {}),
          };
          if (item.kind === 'create') existing.push(next);
          else existing = existing.map(person => person.id === item.internalId ? next : person);
        }
        stored = { log: change.log, rollbackPlan: change.rollbackPlan };
      },
      findMigration: () => stored,
      commitRollback: (_ctx, change) => {
        rollbacks.push(change);
        for (const step of change.rollbackPlan.steps) {
          if (step.type === 'delete') {
            existing = existing.filter(person => person.id !== step.internalId);
          } else if (step.restore) {
            const restore = step.restore;
            if (!restore.externalId || !restore.displayName || typeof restore.active !== 'boolean') {
              throw new Error('rollback restore snapshot is incomplete');
            }
            const restored: Existing = {
              id: step.internalId,
              externalId: restore.externalId,
              displayName: restore.displayName,
              active: restore.active,
              ...(restore.preferredLocale ? { preferredLocale: restore.preferredLocale } : {}),
            };
            existing = existing.map(person => person.id === step.internalId ? restored : person);
          }
        }
        stored = { log: change.log, rollbackPlan: change.rollbackPlan };
      },
    }, runtime);

    const rows = createMigrationSchema([
      { externalId: 'ext-1', displayName: 'Updated', active: false },
      { externalId: 'ext-2', displayName: 'Created', active: true },
    ], NOW).rows;
    const prepared = service.prepare(context(), rows);
    service.execute(context(), rows, prepared.confirmation);

    expect(migrations).toHaveLength(1);
    expect(existing.map(person => person.externalId).sort()).toEqual(['ext-1', 'ext-2']);
    expect(existing.find(person => person.externalId === 'ext-1')).toMatchObject({
      id: 'person-existing',
      displayName: 'Updated',
      active: false,
    });

    const migrationId = stored?.log.migrationId;
    expect(migrationId).toBeTruthy();
    service.rollback(context(), migrationId!);

    expect(rollbacks).toHaveLength(1);
    expect(existing).toEqual(original);
  });

  it('KP6/KP7: rejects stale migration confirmation without persistence', () => {
    let existing = [{
      id: 'person-existing',
      externalId: 'ext-1',
      displayName: 'Original',
      active: true,
    }];
    const migrations: MigrationWorkflowChange[] = [];
    let counter = 0;
    const service = new MigrationWorkflowService({
      listExistingPeople: () => existing,
      commitMigration: (_ctx, change) => { migrations.push(change); },
      findMigration: () => undefined,
      commitRollback: () => undefined,
    }, {
      now: () => NOW,
      nextId: (scope: string) => `${scope}-${++counter}`,
    });
    const rows = createMigrationSchema([
      { externalId: 'ext-1', displayName: 'Updated', active: true },
    ], NOW).rows;
    const prepared = service.prepare(context(), rows);
    existing = [{
      id: 'person-existing',
      externalId: 'ext-1',
      displayName: 'Changed concurrently',
      active: true,
    }];

    expect(() => service.execute(context(), rows, prepared.confirmation)).toThrow('stale');
    expect(migrations).toHaveLength(0);
  });

  it('KP7: persistence failure is atomic and generated effects keep trusted provenance without PII', () => {
    const failing = new StatefulPeopleUow();
    failing.failCommit = true;
    const failingService = new AvailabilityService(failing, appRuntime());
    expect(() => failingService.addUnavailability(context(), {
      personId: 'person-1',
      startsAt: '2026-09-10T10:00:00Z',
      endsAt: '2026-09-10T11:00:00Z',
    })).toThrow('simulated persistence failure');
    expect(failing.person.availability).toHaveLength(0);
    expect(failing.changes).toHaveLength(0);

    const uow = new StatefulPeopleUow();
    new AvailabilityService(uow, appRuntime()).addUnavailability(
      context(TENANT_A, 'trusted-actor'),
      {
        personId: 'person-1',
        startsAt: '2026-09-10T10:00:00Z',
        endsAt: '2026-09-10T11:00:00Z',
      },
    );
    const change = uow.changes[0];
    expect(change.auditEvent).toMatchObject({ tenantId: TENANT_A, actorId: 'trusted-actor' });
    expect(change.domainEvent).toMatchObject({ tenantId: TENANT_A, actorId: 'trusted-actor' });
    expect(JSON.stringify(change.auditEvent)).not.toContain('Pilot Person PII');
    expect(JSON.stringify(change.domainEvent)).not.toContain('Pilot Person PII');
  });

  it('KP7: assignment responses and notification intents deduplicate exact retries', () => {
    const responseChanges: AssignmentResponseChange[] = [];
    let response: AssignmentResponseChange['response'] = createAssignmentResponse({
      id: 'response-1',
      tenantId: TENANT_A,
      assignmentId: 'assignment-1',
      personId: 'person-1',
      now: NOW,
    });
    const responseService = new AssignmentResponseService({
      findResponse: () => response,
      commit: (_ctx, change) => {
        responseChanges.push(change);
        response = change.response;
      },
    }, appRuntime());
    responseService.confirm(context(TENANT_A, 'person-1'), response.id, { code: 'accepted' });
    responseService.confirm(context(TENANT_A, 'person-1'), response.id, { code: 'accepted' });
    expect(responseChanges).toHaveLength(1);

    const preferences = createNotificationPreferences({
      id: 'prefs-1',
      tenantId: TENANT_A,
      personId: 'person-1',
      now: NOW,
    });
    const notificationChanges: NotificationIntentChange[] = [];
    let delivery: NotificationIntentChange['delivery'] | undefined;
    const notifications = new NotificationIntentService({
      findPreferences: () => preferences,
      findDeliveryByIdempotencyKey: (_ctx, key) => delivery?.idempotencyKey === key ? delivery : undefined,
      commit: (_ctx, change) => {
        notificationChanges.push(change);
        delivery = change.delivery;
      },
    }, notificationRuntime());
    const intent = {
      sourceEventId: 'event-1',
      kind: 'created' as const,
      assignmentId: 'assignment-1',
      recipientId: 'person-1',
      locale: 'pt-PT',
    };
    const first = notifications.queueAssignmentIntent(context(), intent);
    const second = notifications.queueAssignmentIntent(context(), intent);

    expect(first?.id).toBe(second?.id);
    expect(notificationChanges).toHaveLength(1);
  });
});

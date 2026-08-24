import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  createAssignmentResponse,
  createNotificationPreferences,
  type AccessContext,
  type CongregationPerson,
} from '@eutaktos/domain';
import { AvailabilityService } from './availability-service';
import { EligibilityService } from './eligibility-service';
import { AssignmentResponseService, type AssignmentResponseChange } from './assignment-response-service';
import {
  NotificationIntentService,
  type NotificationIntentChange,
  type NotificationIntentRuntime,
} from './notification-intent-service';
import type { ApplicationRuntime, PeopleUnitOfWork, PersonChange } from './people-service';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const PERSON_ID = 'person-1';
const NOW = '2026-08-24T12:00:00.000Z';

function context(
  tenantId = TENANT_A,
  actorId = 'actor-a',
  capabilities: AccessContext['capabilities'] = [
    'people.read',
    'people.write',
    'availability.read',
    'availability.write',
    'eligibility.write',
    'schedule.read',
    'schedule.write',
  ],
) {
  return createAccessContext({ tenantId, actorId, capabilities });
}

function person(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: PERSON_ID,
    tenantId: TENANT_A,
    displayName: 'PII Test Person',
    active: true,
    availability: [],
    eligibility: [],
    ...overrides,
  };
}

function runtime(): ApplicationRuntime {
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

class TrackingPeopleUow implements PeopleUnitOfWork {
  person: CongregationPerson;
  readonly commits: PersonChange[] = [];
  failCommit = false;

  constructor(seed: CongregationPerson = person()) {
    this.person = structuredClone(seed);
  }

  list(ctx: ReturnType<typeof context>): readonly CongregationPerson[] {
    return this.person.tenantId === ctx.tenantId ? [structuredClone(this.person)] : [];
  }

  findById(ctx: ReturnType<typeof context>, personId: string): CongregationPerson | undefined {
    return this.person.tenantId === ctx.tenantId && this.person.id === personId
      ? structuredClone(this.person)
      : undefined;
  }

  commitCreate(_ctx: ReturnType<typeof context>, _change: PersonChange): CongregationPerson {
    throw new Error('not used');
  }

  commitUpdate(_ctx: ReturnType<typeof context>, change: PersonChange): CongregationPerson {
    if (this.failCommit) throw new Error('simulated persistence failure');
    this.person = structuredClone(change.person);
    this.commits.push(structuredClone(change));
    return structuredClone(this.person);
  }
}

describe('KP7 atomicity, idempotency and audit gate', () => {
  it('rejects unauthorized availability writes before allocating ids or committing', () => {
    const uow = new TrackingPeopleUow();
    const service = new AvailabilityService(uow, runtime());

    expect(() => service.addUnavailability(
      context(TENANT_A, 'actor-a', ['people.read']),
      { personId: PERSON_ID, startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z' },
    )).toThrow('missing capability availability.write');
    expect(uow.commits).toHaveLength(0);
    expect(uow.person.availability).toHaveLength(0);
  });

  it('rejects cross-tenant eligibility before persistence', () => {
    const uow = new TrackingPeopleUow();
    const service = new EligibilityService(uow, runtime());

    expect(() => service.setEligibility(
      context(TENANT_B, 'actor-b', ['people.read', 'eligibility.write']),
      { personId: PERSON_ID, assignmentTypeId: 'reading', enabled: true },
    )).toThrow('Person not found');
    expect(uow.commits).toHaveLength(0);
  });

  it('does not persist a partial state when the persistence boundary fails', () => {
    const uow = new TrackingPeopleUow();
    uow.failCommit = true;
    const service = new AvailabilityService(uow, runtime());

    expect(() => service.addUnavailability(
      context(),
      { personId: PERSON_ID, startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z' },
    )).toThrow('simulated persistence failure');
    expect(uow.commits).toHaveLength(0);
    expect(uow.person.availability).toHaveLength(0);
  });

  it('makes an exact availability retry a no-op with no duplicate audit/event effect', () => {
    const uow = new TrackingPeopleUow();
    const service = new AvailabilityService(uow, runtime());
    const input = {
      personId: PERSON_ID,
      startsAt: '2026-09-01T10:00:00Z',
      endsAt: '2026-09-01T11:00:00Z',
      reasonCode: 'away' as const,
    };

    const first = service.addUnavailability(context(), input);
    const commitsAfterFirst = uow.commits.length;
    const second = service.addUnavailability(context(), input);

    expect(second).toEqual(first);
    expect(uow.commits).toHaveLength(commitsAfterFirst);
  });

  it('keeps audit/domain-event payloads tenant- and actor-scoped without PII leakage', () => {
    const uow = new TrackingPeopleUow();
    const service = new AvailabilityService(uow, runtime());

    service.addUnavailability(context(TENANT_A, 'actor-a'), {
      personId: PERSON_ID,
      startsAt: '2026-09-01T10:00:00Z',
      endsAt: '2026-09-01T11:00:00Z',
      reasonCode: 'away',
    });

    const change = uow.commits[0];
    expect(change.auditEvent).toMatchObject({
      tenantId: TENANT_A,
      actorId: 'actor-a',
      resourceType: 'availability',
      action: 'create',
    });
    expect(change.domainEvent).toMatchObject({
      tenantId: TENANT_A,
      actorId: 'actor-a',
      type: 'AvailabilityChanged',
    });
    expect(JSON.stringify(change.auditEvent)).not.toContain('PII Test Person');
    expect(JSON.stringify(change.domainEvent)).not.toContain('PII Test Person');
  });

  it('does not allow request data to override trusted AccessContext provenance', () => {
    const uow = new TrackingPeopleUow();
    const service = new AvailabilityService(uow, runtime());
    service.addUnavailability(context(TENANT_A, 'trusted-actor'), {
      personId: PERSON_ID,
      startsAt: '2026-09-01T10:00:00Z',
      endsAt: '2026-09-01T11:00:00Z',
      reasonCode: 'away',
    });
    expect(uow.commits[0].auditEvent.actorId).toBe('trusted-actor');
    expect(uow.commits[0].auditEvent.tenantId).toBe(TENANT_A);
  });

  it('uses idempotency on authenticated assignment responses and emits only one durable effect', () => {
    const changes: AssignmentResponseChange[] = [];
    let stored: AssignmentResponseChange['response'] = createAssignmentResponse({
      id: 'response-1',
      tenantId: TENANT_A,
      assignmentId: 'assignment-1',
      personId: PERSON_ID,
      now: NOW,
    });
    const service = new AssignmentResponseService({
      findResponse: (_ctx, id) => id === stored.id ? stored : undefined,
      commit: (_ctx, change) => {
        changes.push(change);
        stored = change.response;
      },
    }, runtime());

    service.confirm(context(TENANT_A, PERSON_ID), stored.id, { code: 'accepted' });
    service.confirm(context(TENANT_A, PERSON_ID), stored.id, { code: 'accepted' });
    expect(changes).toHaveLength(1);
  });

  it('does not queue duplicate notification intents for the same idempotency key', () => {
    const preferences = createNotificationPreferences({
      id: 'prefs-1',
      tenantId: TENANT_A,
      personId: 'recipient-1',
      now: NOW,
    });
    let delivery: NotificationIntentChange['delivery'] | undefined;
    const changes: NotificationIntentChange[] = [];
    const service = new NotificationIntentService({
      findPreferences: () => preferences,
      findDeliveryByIdempotencyKey: (_ctx, key) => delivery?.idempotencyKey === key ? delivery : undefined,
      commit: (_ctx, change) => {
        changes.push(change);
        delivery = change.delivery;
      },
    }, notificationRuntime());

    const input = {
      sourceEventId: 'event-1',
      kind: 'created' as const,
      assignmentId: 'assignment-1',
      recipientId: 'recipient-1',
      locale: 'pt-PT',
    };
    const first = service.queueAssignmentIntent(context(), input);
    const second = service.queueAssignmentIntent(context(), input);
    expect(first?.id).toBe(second?.id);
    expect(changes).toHaveLength(1);
  });
});

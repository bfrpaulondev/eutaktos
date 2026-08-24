/**
 * KP1 — MVP Tenant / Capability Adversarial Gate
 *
 * Proves isolation and authorization invariants for the currently supported
 * write surfaces without trusting frontend-supplied tenant, actor or capabilities.
 * Calls real application services. Uses tracking UnitOfWork fakes that mirror
 * the atomic commit behaviour of the canonical in-memory adapters.
 */
import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  createMidweekMeeting,
  type AccessContext,
  type Capability,
  type CongregationPerson,
  type Household,
  type MidweekMeeting,
  type ResponsibilityAssignment,
  type ServiceGroup,
} from '@eutaktos/domain';
import { AvailabilityService } from './availability-service';
import { EligibilityService } from './eligibility-service';
import {
  OrganizationService,
  type HouseholdChange,
  type HouseholdUnitOfWork,
  type OrganizationDeletionChange,
  type ResponsibilityChange,
  type ResponsibilityUnitOfWork,
  type ServiceGroupChange,
  type ServiceGroupUnitOfWork,
} from './organization-service';
import {
  MidweekSchedulingService,
  type MidweekSchedulingChange,
  type MidweekSchedulingRuntime,
  type MidweekSchedulingUnitOfWork,
} from './midweek-scheduling-service';
import {
  PeopleDirectoryService,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type PersonChange,
} from './people-service';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ACTOR_A = 'elder-a';
const ACTOR_B = 'elder-b';
const SHARED_LOGICAL_ID = 'shared-id-1';

function runtime(): ApplicationRuntime {
  const counters: Record<string, number> = { person: 0, availability: 0, audit: 0, event: 0 };
  return {
    now: () => '2026-08-24T12:00:00.000Z',
    nextId: (scope) => {
      counters[scope] = (counters[scope] ?? 0) + 1;
      return `${scope}-${counters[scope]}`;
    },
  };
}

function ctx(
  tenantId: string,
  actorId: string,
  capabilities: readonly Capability[],
): Readonly<AccessContext> {
  return createAccessContext({ tenantId, actorId, capabilities });
}

function personA(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: SHARED_LOGICAL_ID,
    tenantId: TENANT_A,
    displayName: 'Ana Tenant A',
    active: true,
    availability: [],
    eligibility: [],
    emergencyContacts: [],
    ...overrides,
  };
}

function personB(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: SHARED_LOGICAL_ID,
    tenantId: TENANT_B,
    displayName: 'Bruno Tenant B',
    active: true,
    availability: [],
    eligibility: [],
    emergencyContacts: [],
    ...overrides,
  };
}

function householdA(): Household {
  return { id: SHARED_LOGICAL_ID, tenantId: TENANT_A, name: 'Household A', memberIds: [SHARED_LOGICAL_ID] };
}

function householdB(): Household {
  return { id: SHARED_LOGICAL_ID, tenantId: TENANT_B, name: 'Household B', memberIds: [SHARED_LOGICAL_ID] };
}

function serviceGroupB(): ServiceGroup {
  return { id: SHARED_LOGICAL_ID, tenantId: TENANT_B, name: 'Group B', memberIds: [SHARED_LOGICAL_ID] };
}

function responsibilityA(): ResponsibilityAssignment {
  return {
    id: SHARED_LOGICAL_ID,
    tenantId: TENANT_A,
    personId: SHARED_LOGICAL_ID,
    responsibilityKey: 'coordinator',
    startsAt: '2026-01-01T00:00:00.000Z',
    assignedBy: ACTOR_A,
    assignedAt: '2026-01-01T00:00:00.000Z',
  };
}

function responsibilityB(): ResponsibilityAssignment {
  return {
    id: SHARED_LOGICAL_ID,
    tenantId: TENANT_B,
    personId: SHARED_LOGICAL_ID,
    responsibilityKey: 'coordinator',
    startsAt: '2026-01-01T00:00:00.000Z',
    assignedBy: ACTOR_B,
    assignedAt: '2026-01-01T00:00:00.000Z',
  };
}

class TrackingPeopleUow implements PeopleUnitOfWork {
  readonly records = new Map<string, CongregationPerson>();
  readonly commits: PersonChange[] = [];

  constructor(seed: readonly CongregationPerson[] = []) {
    for (const p of seed) this.records.set(`${p.tenantId}:${p.id}`, structuredClone(p));
  }

  list(context: AccessContext): readonly CongregationPerson[] {
    return [...this.records.values()]
      .filter((p) => p.tenantId === context.tenantId)
      .map((p) => structuredClone(p));
  }

  findById(context: AccessContext, personId: string): CongregationPerson | undefined {
    const p = this.records.get(`${context.tenantId}:${personId}`);
    return p ? structuredClone(p) : undefined;
  }

  commitCreate(context: AccessContext, change: PersonChange): CongregationPerson {
    return this.#commit(context, change, true);
  }

  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson {
    return this.#commit(context, change, false);
  }

  #commit(context: AccessContext, change: PersonChange, create: boolean): CongregationPerson {
    if (change.person.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.auditEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.domainEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    const key = `${context.tenantId}:${change.person.id}`;
    if (create && this.records.has(key)) throw new Error('Person already exists');
    if (!create && !this.records.has(key)) throw new Error('Person not found');
    this.records.set(key, structuredClone(change.person));
    this.commits.push(change);
    return structuredClone(change.person);
  }

  snapshot(tenantId: string) {
    return {
      people: this.list(ctx(tenantId, ACTOR_A, [])).map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        displayName: p.displayName,
        active: p.active,
        eligibilityLen: p.eligibility.length,
        availabilityLen: p.availability.length,
      })),
      commitCount: this.commits.filter((c) => c.person.tenantId === tenantId).length,
    };
  }
}

class TrackingHouseholdUow implements HouseholdUnitOfWork {
  readonly records = new Map<string, Household>();
  readonly commits: Array<HouseholdChange | OrganizationDeletionChange> = [];

  constructor(seed: readonly Household[] = []) {
    for (const h of seed) this.records.set(`${h.tenantId}:${h.id}`, structuredClone(h));
  }

  listHouseholds(context: AccessContext): readonly Household[] {
    return [...this.records.values()]
      .filter((h) => h.tenantId === context.tenantId)
      .map((h) => structuredClone(h));
  }

  findHouseholdById(context: AccessContext, id: string): Household | undefined {
    const h = this.records.get(`${context.tenantId}:${id}`);
    return h ? structuredClone(h) : undefined;
  }

  commitHouseholdCreate(context: AccessContext, change: HouseholdChange): Household {
    return this.#commit(context, change, true);
  }

  commitHouseholdUpdate(context: AccessContext, change: HouseholdChange): Household {
    return this.#commit(context, change, false);
  }

  commitHouseholdDelete(context: AccessContext, id: string, change: OrganizationDeletionChange): boolean {
    if (change.auditEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.domainEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    const key = `${context.tenantId}:${id}`;
    if (!this.records.has(key)) throw new Error('Household not found');
    this.records.delete(key);
    this.commits.push(change);
    return true;
  }

  #commit(context: AccessContext, change: HouseholdChange, create: boolean): Household {
    if (change.household.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.auditEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.domainEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    const key = `${context.tenantId}:${change.household.id}`;
    if (create && this.records.has(key)) throw new Error('Household already exists');
    if (!create && !this.records.has(key)) throw new Error('Household not found');
    this.records.set(key, structuredClone(change.household));
    this.commits.push(change);
    return structuredClone(change.household);
  }
}

class TrackingServiceGroupUow implements ServiceGroupUnitOfWork {
  readonly records = new Map<string, ServiceGroup>();
  readonly commits: Array<ServiceGroupChange | OrganizationDeletionChange> = [];

  constructor(seed: readonly ServiceGroup[] = []) {
    for (const g of seed) this.records.set(`${g.tenantId}:${g.id}`, structuredClone(g));
  }

  listServiceGroups(context: AccessContext): readonly ServiceGroup[] {
    return [...this.records.values()]
      .filter((g) => g.tenantId === context.tenantId)
      .map((g) => structuredClone(g));
  }

  findServiceGroupById(context: AccessContext, id: string): ServiceGroup | undefined {
    const g = this.records.get(`${context.tenantId}:${id}`);
    return g ? structuredClone(g) : undefined;
  }

  commitServiceGroupCreate(context: AccessContext, change: ServiceGroupChange): ServiceGroup {
    return this.#commit(context, change, true);
  }

  commitServiceGroupUpdate(context: AccessContext, change: ServiceGroupChange): ServiceGroup {
    return this.#commit(context, change, false);
  }

  commitServiceGroupDelete(context: AccessContext, id: string, change: OrganizationDeletionChange): boolean {
    if (change.auditEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.domainEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    const key = `${context.tenantId}:${id}`;
    if (!this.records.has(key)) throw new Error('Service group not found');
    this.records.delete(key);
    this.commits.push(change);
    return true;
  }

  #commit(context: AccessContext, change: ServiceGroupChange, create: boolean): ServiceGroup {
    if (change.serviceGroup.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.auditEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.domainEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    const key = `${context.tenantId}:${change.serviceGroup.id}`;
    if (create && this.records.has(key)) throw new Error('Service group already exists');
    if (!create && !this.records.has(key)) throw new Error('Service group not found');
    this.records.set(key, structuredClone(change.serviceGroup));
    this.commits.push(change);
    return structuredClone(change.serviceGroup);
  }
}

class TrackingResponsibilityUow implements ResponsibilityUnitOfWork {
  readonly records = new Map<string, ResponsibilityAssignment>();
  readonly commits: ResponsibilityChange[] = [];

  constructor(seed: readonly ResponsibilityAssignment[] = []) {
    for (const r of seed) this.records.set(`${r.tenantId}:${r.id}`, structuredClone(r));
  }

  listResponsibilities(context: AccessContext): readonly ResponsibilityAssignment[] {
    return [...this.records.values()]
      .filter((r) => r.tenantId === context.tenantId)
      .map((r) => structuredClone(r));
  }

  findResponsibilityById(context: AccessContext, id: string): ResponsibilityAssignment | undefined {
    const r = this.records.get(`${context.tenantId}:${id}`);
    return r ? structuredClone(r) : undefined;
  }

  commitResponsibilityCreate(context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment {
    return this.#commit(context, change, true);
  }

  commitResponsibilityUpdate(context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment {
    return this.#commit(context, change, false);
  }

  #commit(context: AccessContext, change: ResponsibilityChange, create: boolean): ResponsibilityAssignment {
    if (change.responsibility.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.auditEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    if (change.domainEvent.tenantId !== context.tenantId) throw new Error('Cross-tenant access denied');
    const key = `${context.tenantId}:${change.responsibility.id}`;
    if (create && this.records.has(key)) throw new Error('Responsibility already exists');
    if (!create && !this.records.has(key)) throw new Error('Responsibility not found');
    this.records.set(key, structuredClone(change.responsibility));
    this.commits.push(change);
    return structuredClone(change.responsibility);
  }
}

describe('KP1 adversarial gate — People', () => {
  it('same logical person id coexists in two tenants without collision', () => {
    const uow = new TrackingPeopleUow([personA(), personB()]);
    const service = new PeopleDirectoryService(uow, runtime());
    const fromA = service.get(ctx(TENANT_A, ACTOR_A, ['people.read']), SHARED_LOGICAL_ID);
    const fromB = service.get(ctx(TENANT_B, ACTOR_B, ['people.read']), SHARED_LOGICAL_ID);
    expect(fromA?.displayName).toBe('Ana Tenant A');
    expect(fromB?.displayName).toBe('Bruno Tenant B');
    expect(fromA?.tenantId).toBe(TENANT_A);
    expect(fromB?.tenantId).toBe(TENANT_B);
  });

  it('actor of tenant A cannot read foreign tenant person', () => {
    const uow = new TrackingPeopleUow([personB()]);
    const service = new PeopleDirectoryService(uow, runtime());
    expect(service.get(ctx(TENANT_A, ACTOR_A, ['people.read']), SHARED_LOGICAL_ID)).toBeUndefined();
  });

  it('actor of tenant A cannot update foreign tenant person — no commit / audit / event', () => {
    const uow = new TrackingPeopleUow([personB()]);
    const service = new PeopleDirectoryService(uow, runtime());
    const before = uow.snapshot(TENANT_B);
    expect(() =>
      service.updateProfile(ctx(TENANT_A, ACTOR_A, ['people.read', 'people.write']), {
        personId: SHARED_LOGICAL_ID,
        displayName: 'Hijacked',
      }),
    ).toThrow(/Person not found|Cross-tenant/);
    expect(uow.snapshot(TENANT_B)).toEqual(before);
    expect(uow.commits).toHaveLength(0);
  });

  it('missing capability rejects before mutation and produces no audit/outbox', () => {
    const uow = new TrackingPeopleUow([personA()]);
    const service = new PeopleDirectoryService(uow, runtime());
    const before = uow.snapshot(TENANT_A);
    expect(() =>
      service.updateProfile(ctx(TENANT_A, ACTOR_A, ['people.read']), {
        personId: SHARED_LOGICAL_ID,
        displayName: 'Should Fail',
      }),
    ).toThrow(/missing capability people\.write/);
    expect(uow.snapshot(TENANT_A)).toEqual(before);
    expect(uow.commits).toHaveLength(0);
  });

  it('forged tenantId in AccessContext cannot see foreign-keyed records', () => {
    const uow = new TrackingPeopleUow([personA()]);
    const service = new PeopleDirectoryService(uow, runtime());
    expect(service.get(ctx(TENANT_B, ACTOR_A, ['people.read']), SHARED_LOGICAL_ID)).toBeUndefined();
  });

  it('actorId is taken exclusively from AccessContext for audit trails', () => {
    const uow = new TrackingPeopleUow();
    const service = new PeopleDirectoryService(uow, runtime());
    service.create(ctx(TENANT_A, ACTOR_A, ['people.write']), { displayName: 'New Person' });
    expect(uow.commits).toHaveLength(1);
    expect(uow.commits[0]?.auditEvent.actorId).toBe(ACTOR_A);
    expect(uow.commits[0]?.domainEvent.actorId).toBe(ACTOR_A);
    expect(uow.commits[0]?.person.tenantId).toBe(TENANT_A);
  });

  it('valid same-tenant operation still succeeds and emits audit + domain event', () => {
    const uow = new TrackingPeopleUow([personA()]);
    const service = new PeopleDirectoryService(uow, runtime());
    const updated = service.updateProfile(ctx(TENANT_A, ACTOR_A, ['people.read', 'people.write']), {
      personId: SHARED_LOGICAL_ID,
      displayName: 'Ana Updated',
    });
    expect(updated.displayName).toBe('Ana Updated');
    expect(uow.commits).toHaveLength(1);
    expect(uow.commits[0]?.auditEvent).toBeDefined();
    expect(uow.commits[0]?.domainEvent).toBeDefined();
  });
});

describe('KP1 adversarial gate — Organization', () => {
  function buildOrg(
    households: Household[] = [],
    groups: ServiceGroup[] = [],
    responsibilities: ResponsibilityAssignment[] = [],
  ) {
    const householdUow = new TrackingHouseholdUow(households);
    const groupUow = new TrackingServiceGroupUow(groups);
    const respUow = new TrackingResponsibilityUow(responsibilities);
    const service = new OrganizationService(householdUow, groupUow, respUow, runtime());
    return { service, householdUow, groupUow, respUow };
  }

  it('same logical household id coexists in two tenants', () => {
    const { service } = buildOrg([householdA(), householdB()]);
    const a = service.getHousehold(ctx(TENANT_A, ACTOR_A, ['people.read']), SHARED_LOGICAL_ID);
    const b = service.getHousehold(ctx(TENANT_B, ACTOR_B, ['people.read']), SHARED_LOGICAL_ID);
    expect(a?.name).toBe('Household A');
    expect(b?.name).toBe('Household B');
  });

  it('foreign tenant household cannot be read or mutated — no commit', () => {
    const { service, householdUow } = buildOrg([householdB()]);
    expect(service.getHousehold(ctx(TENANT_A, ACTOR_A, ['people.read']), SHARED_LOGICAL_ID)).toBeUndefined();
    expect(() =>
      service.updateHousehold(ctx(TENANT_A, ACTOR_A, ['people.read', 'people.write']), {
        id: SHARED_LOGICAL_ID,
        name: 'Hijacked',
      }),
    ).toThrow(/not found|Cross-tenant/i);
    expect(householdUow.commits).toHaveLength(0);
    const still = service.getHousehold(ctx(TENANT_B, ACTOR_B, ['people.read']), SHARED_LOGICAL_ID);
    expect(still?.name).toBe('Household B');
  });

  it('foreign tenant service group is rejected with no commit', () => {
    const { service, groupUow } = buildOrg([], [serviceGroupB()]);
    expect(service.getServiceGroup(ctx(TENANT_A, ACTOR_A, ['people.read']), SHARED_LOGICAL_ID)).toBeUndefined();
    expect(() =>
      service.updateServiceGroup(ctx(TENANT_A, ACTOR_A, ['people.read', 'people.write']), {
        id: SHARED_LOGICAL_ID,
        name: 'Hijacked',
      }),
    ).toThrow(/not found|Cross-tenant/i);
    expect(groupUow.commits).toHaveLength(0);
  });

  it('foreign tenant responsibility is rejected with no commit', () => {
    const { service, respUow } = buildOrg([], [], [responsibilityB()]);
    expect(
      service.getResponsibility(ctx(TENANT_A, ACTOR_A, ['responsibilities.read']), SHARED_LOGICAL_ID),
    ).toBeUndefined();
    expect(() =>
      service.endResponsibility(ctx(TENANT_A, ACTOR_A, ['responsibilities.write']), {
        id: SHARED_LOGICAL_ID,
        endsAt: '2026-12-31T00:00:00.000Z',
      }),
    ).toThrow(/not found|Cross-tenant/i);
    expect(respUow.commits).toHaveLength(0);
  });

  it('missing capability for household write rejects with no state change', () => {
    const { service, householdUow } = buildOrg([householdA()]);
    expect(() =>
      service.updateHousehold(ctx(TENANT_A, ACTOR_A, ['people.read']), {
        id: SHARED_LOGICAL_ID,
        name: 'Should Fail',
      }),
    ).toThrow(/missing capability people\.write/);
    expect(householdUow.commits).toHaveLength(0);
    const still = service.getHousehold(ctx(TENANT_A, ACTOR_A, ['people.read']), SHARED_LOGICAL_ID);
    expect(still?.name).toBe('Household A');
  });

  it('missing capability for responsibility write rejects', () => {
    const { service, respUow } = buildOrg([], [], [responsibilityA()]);
    expect(() =>
      service.endResponsibility(ctx(TENANT_A, ACTOR_A, ['responsibilities.read']), {
        id: SHARED_LOGICAL_ID,
        endsAt: '2026-12-31T00:00:00.000Z',
      }),
    ).toThrow(/missing capability responsibilities\.write/);
    expect(respUow.commits).toHaveLength(0);
  });

  it('valid same-tenant household create still works and commits audit + event', () => {
    const { service, householdUow } = buildOrg();
    const created = service.createHousehold(ctx(TENANT_A, ACTOR_A, ['people.write']), {
      id: 'h-new',
      name: 'New HH',
      memberIds: [],
    });
    expect(created.tenantId).toBe(TENANT_A);
    expect(created.name).toBe('New HH');
    expect(householdUow.commits).toHaveLength(1);
    const change = householdUow.commits[0] as HouseholdChange;
    expect(change.auditEvent).toBeDefined();
    expect(change.domainEvent).toBeDefined();
  });
});

describe('KP1 adversarial gate — Eligibility', () => {
  it('foreign tenant eligibility decision is rejected — no commit', () => {
    const uow = new TrackingPeopleUow([personB()]);
    const service = new EligibilityService(uow, runtime());
    const before = uow.snapshot(TENANT_B);
    expect(() =>
      service.setEligibility(ctx(TENANT_A, ACTOR_A, ['people.read', 'eligibility.write']), {
        personId: SHARED_LOGICAL_ID,
        assignmentTypeId: 'bible-reading',
        enabled: true,
      }),
    ).toThrow(/Person not found|Cross-tenant|missing capability/);
    expect(uow.snapshot(TENANT_B)).toEqual(before);
    expect(uow.commits).toHaveLength(0);
  });

  it('missing eligibility.write capability rejects before mutation', () => {
    const uow = new TrackingPeopleUow([personA()]);
    const service = new EligibilityService(uow, runtime());
    const before = uow.snapshot(TENANT_A);
    expect(() =>
      service.setEligibility(ctx(TENANT_A, ACTOR_A, ['people.read']), {
        personId: SHARED_LOGICAL_ID,
        assignmentTypeId: 'bible-reading',
        enabled: true,
      }),
    ).toThrow(/missing capability eligibility\.write/);
    expect(uow.snapshot(TENANT_A)).toEqual(before);
    expect(uow.commits).toHaveLength(0);
  });

  it('valid same-tenant eligibility write succeeds and records audit + event', () => {
    const uow = new TrackingPeopleUow([personA()]);
    const service = new EligibilityService(uow, runtime());
    const updated = service.setEligibility(
      ctx(TENANT_A, ACTOR_A, ['people.read', 'eligibility.write']),
      { personId: SHARED_LOGICAL_ID, assignmentTypeId: 'bible-reading', enabled: true },
    );
    expect(updated.eligibility.some((g) => g.assignmentTypeId === 'bible-reading' && g.enabled)).toBe(true);
    expect(uow.commits).toHaveLength(1);
    expect(uow.commits[0]?.auditEvent.actorId).toBe(ACTOR_A);
    expect(uow.commits[0]?.domainEvent.type).toBe('EligibilityChanged');
  });
});

describe('KP1 adversarial gate — Availability', () => {
  it('foreign tenant availability mutation is rejected — atomicity', () => {
    const uow = new TrackingPeopleUow([personB()]);
    const service = new AvailabilityService(uow, runtime());
    const before = uow.snapshot(TENANT_B);
    expect(() =>
      service.addUnavailability(ctx(TENANT_A, ACTOR_A, ['people.read', 'availability.write']), {
        personId: SHARED_LOGICAL_ID,
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-08T00:00:00.000Z',
      }),
    ).toThrow(/Person not found|Cross-tenant|missing capability/);
    expect(uow.snapshot(TENANT_B)).toEqual(before);
    expect(uow.commits).toHaveLength(0);
  });

  it('missing availability.write capability rejects before mutation', () => {
    const uow = new TrackingPeopleUow([personA()]);
    const service = new AvailabilityService(uow, runtime());
    const before = uow.snapshot(TENANT_A);
    expect(() =>
      service.addUnavailability(ctx(TENANT_A, ACTOR_A, ['people.read']), {
        personId: SHARED_LOGICAL_ID,
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-08T00:00:00.000Z',
      }),
    ).toThrow(/missing capability availability\.write/);
    expect(uow.snapshot(TENANT_A)).toEqual(before);
    expect(uow.commits).toHaveLength(0);
  });

  it('valid same-tenant availability write succeeds', () => {
    const uow = new TrackingPeopleUow([personA()]);
    const service = new AvailabilityService(uow, runtime());
    const updated = service.addUnavailability(
      ctx(TENANT_A, ACTOR_A, ['people.read', 'availability.write']),
      {
        personId: SHARED_LOGICAL_ID,
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-08T00:00:00.000Z',
        reasonCode: 'away',
      },
    );
    expect(updated.availability).toHaveLength(1);
    expect(uow.commits).toHaveLength(1);
    expect(uow.commits[0]?.domainEvent.type).toBe('AvailabilityChanged');
  });
});

function midweekMeeting(tenantId: string): Readonly<MidweekMeeting> {
  return createMidweekMeeting({
    id: SHARED_LOGICAL_ID,
    tenantId,
    date: '2026-08-26',
    localTime: '19:00',
    timezone: 'Europe/Lisbon',
    now: '2026-08-24T12:00:00.000Z',
  });
}

function midweekHarness(seedMeeting: Readonly<MidweekMeeting> = midweekMeeting(TENANT_A)) {
  const changes: MidweekSchedulingChange[] = [];
  let counter = 0;
  const uow: MidweekSchedulingUnitOfWork = {
    findMeeting: () => seedMeeting,
    findStudentAssignment: () => undefined,
    findNonStudentAssignment: () => undefined,
    listStudentAssignments: () => [],
    listNonStudentAssignments: () => [],
    findPerson: () => undefined,
    findPartDefinition: () => undefined,
    listConflictAssignments: () => [],
    resolveSlotWindow: () => ({
      startsAt: '2026-08-26T18:00:00.000Z',
      endsAt: '2026-08-26T18:05:00.000Z',
    }),
    commit: (_context, change) => {
      changes.push(change);
    },
  };
  const schedulingRuntime: MidweekSchedulingRuntime = {
    now: () => '2026-08-24T12:00:00.000Z',
    nextId: (scope) => `kp1-${scope}-${++counter}`,
  };
  return { service: new MidweekSchedulingService(uow, schedulingRuntime), changes };
}

describe('KP1 adversarial gate — Midweek writes', () => {
  it('rejects a foreign-tenant meeting returned by an adversarial port without committing', () => {
    const { service, changes } = midweekHarness(midweekMeeting(TENANT_B));
    expect(() =>
      service.addSlot(ctx(TENANT_A, ACTOR_A, ['schedule.write']), SHARED_LOGICAL_ID, {
        position: 0,
        durationMinutes: 5,
        titleKey: 'part.reading',
      }),
    ).toThrow(/Cross-tenant access denied/);
    expect(changes).toHaveLength(0);
  });

  it('rejects a midweek write without schedule.write before committing', () => {
    const { service, changes } = midweekHarness();
    expect(() =>
      service.createDraftMeeting(ctx(TENANT_A, ACTOR_A, []), {
        date: '2026-08-27',
        localTime: '19:00',
        timezone: 'Europe/Lisbon',
      }),
    ).toThrow(/missing capability schedule\.write/);
    expect(changes).toHaveLength(0);
  });

  it('valid same-tenant midweek creation binds tenant and actor to AccessContext', () => {
    const { service, changes } = midweekHarness();
    const created = service.createDraftMeeting(ctx(TENANT_A, ACTOR_A, ['schedule.write']), {
      date: '2026-08-27',
      localTime: '19:00',
      timezone: 'Europe/Lisbon',
    });
    expect(created.tenantId).toBe(TENANT_A);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.auditEvents[0]).toMatchObject({ tenantId: TENANT_A, actorId: ACTOR_A });
    expect(changes[0]?.domainEvents[0]).toMatchObject({ tenantId: TENANT_A, actorId: ACTOR_A });
  });
});

describe('KP1 adversarial gate — forged context & input invariants', () => {
  it('capabilities can only be supplied via AccessContext; inputs cannot grant authorization', () => {
    const uow = new TrackingPeopleUow([personA()]);
    const service = new PeopleDirectoryService(uow, runtime());
    expect(() =>
      service.updateProfile(ctx(TENANT_A, ACTOR_A, []), {
        personId: SHARED_LOGICAL_ID,
        displayName: 'Injected Caps',
      }),
    ).toThrow(/missing capability/);
    expect(uow.commits).toHaveLength(0);
  });

  it('actorId is taken exclusively from AccessContext (no request-body override path)', () => {
    const uow = new TrackingPeopleUow([personA()]);
    const service = new PeopleDirectoryService(uow, runtime());
    service.updateProfile(ctx(TENANT_A, 'trusted-actor-99', ['people.read', 'people.write']), {
      personId: SHARED_LOGICAL_ID,
      displayName: 'Renamed',
    });
    expect(uow.commits[0]?.auditEvent.actorId).toBe('trusted-actor-99');
    expect(uow.commits[0]?.domainEvent.actorId).toBe('trusted-actor-99');
  });

  it('tenantId on created aggregates always originates from authorized context', () => {
    const uow = new TrackingPeopleUow();
    const service = new PeopleDirectoryService(uow, runtime());
    const created = service.create(ctx(TENANT_A, ACTOR_A, ['people.write']), {
      displayName: 'Context Owned',
    });
    expect(created.tenantId).toBe(TENANT_A);
  });
});

import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  type AccessContext,
  type CongregationProfile,
} from '@eutaktos/domain';
import {
  CongregationSettingsService,
  type CongregationChange,
  type CongregationUnitOfWork,
} from './congregation-service';
import type { ApplicationRuntime } from './people-service';

class FakeCongregationUnitOfWork implements CongregationUnitOfWork {
  readonly profiles = new Map<string, CongregationProfile>();
  readonly creates: CongregationChange[] = [];
  readonly updates: CongregationChange[] = [];

  constructor(seed: readonly CongregationProfile[] = []) {
    for (const profile of seed) this.profiles.set(profile.tenantId, profile);
  }

  findProfile(context: AccessContext): CongregationProfile | undefined {
    return this.profiles.get(context.tenantId);
  }

  commitCreate(context: AccessContext, change: CongregationChange): CongregationProfile {
    if (change.profile.tenantId !== context.tenantId) throw new Error('cross-tenant create');
    if (this.profiles.has(context.tenantId)) throw new Error('duplicate congregation profile');
    this.profiles.set(context.tenantId, change.profile);
    this.creates.push(change);
    return change.profile;
  }

  commitUpdate(context: AccessContext, change: CongregationChange): CongregationProfile {
    if (change.profile.tenantId !== context.tenantId) throw new Error('cross-tenant update');
    if (!this.profiles.has(context.tenantId)) throw new Error('missing congregation profile');
    this.profiles.set(context.tenantId, change.profile);
    this.updates.push(change);
    return change.profile;
  }
}

function runtime(): ApplicationRuntime {
  const counters = { person: 0, availability: 0, audit: 0, event: 0 };
  return {
    now: () => '2026-08-20T16:30:00.000Z',
    nextId: scope => `${scope}-${++counters[scope]}`,
  };
}

function context(capabilities: AccessContext['capabilities'] = ['tenant.manage']): Readonly<AccessContext> {
  return createAccessContext({
    tenantId: 'tenant-a',
    actorId: 'admin-1',
    capabilities,
  });
}

function input() {
  return {
    name: '  Central   Congregation ',
    timezone: 'Europe/Lisbon',
    defaultLocale: 'pt-pt',
    midweekMeeting: { weekday: 2 as const, localTime: '19:30' },
    weekendMeeting: { weekday: 0 as const, localTime: '10:00' },
  };
}

describe('CongregationSettingsService', () => {
  it('creates normalized tenant settings with atomic audit and event metadata', () => {
    const unitOfWork = new FakeCongregationUnitOfWork();
    const service = new CongregationSettingsService(unitOfWork, runtime());

    const profile = service.save(context(), input(), { correlationId: 'request-1' });

    expect(profile).toEqual({
      tenantId: 'tenant-a',
      name: 'Central Congregation',
      timezone: 'Europe/Lisbon',
      defaultLocale: 'pt-PT',
      midweekMeeting: { weekday: 2, localTime: '19:30' },
      weekendMeeting: { weekday: 0, localTime: '10:00' },
    });
    expect(unitOfWork.creates).toHaveLength(1);
    expect(unitOfWork.creates[0]?.auditEvent).toMatchObject({
      tenantId: 'tenant-a',
      resourceType: 'congregation',
      resourceId: 'tenant-a',
      action: 'create',
      actorId: 'admin-1',
    });
    expect(unitOfWork.creates[0]?.domainEvent).toMatchObject({
      tenantId: 'tenant-a',
      type: 'CongregationCreated',
      aggregateId: 'tenant-a',
      actorId: 'admin-1',
      correlationId: 'request-1',
    });
  });

  it('updates only changed settings and emits privacy-minimized metadata', () => {
    const seeded = {
      tenantId: 'tenant-a',
      name: 'Central Congregation',
      timezone: 'Europe/Lisbon',
      defaultLocale: 'pt-PT',
      midweekMeeting: { weekday: 2 as const, localTime: '19:30' },
      weekendMeeting: { weekday: 0 as const, localTime: '10:00' },
    };
    const unitOfWork = new FakeCongregationUnitOfWork([seeded]);
    const service = new CongregationSettingsService(unitOfWork, runtime());

    const profile = service.save(context(), { ...input(), timezone: 'Atlantic/Azores' });

    expect(profile.timezone).toBe('Atlantic/Azores');
    expect(unitOfWork.updates).toHaveLength(1);
    expect(unitOfWork.updates[0]?.auditEvent.changedFields).toEqual(['timezone']);
    expect(unitOfWork.updates[0]?.domainEvent.type).toBe('CongregationUpdated');
    expect(unitOfWork.updates[0]?.domainEvent).not.toHaveProperty('name');
  });

  it('does not generate audit noise for a normalized no-op update', () => {
    const seeded = {
      tenantId: 'tenant-a',
      name: 'Central Congregation',
      timezone: 'Europe/Lisbon',
      defaultLocale: 'pt-PT',
      midweekMeeting: { weekday: 2 as const, localTime: '19:30' },
      weekendMeeting: { weekday: 0 as const, localTime: '10:00' },
    };
    const unitOfWork = new FakeCongregationUnitOfWork([seeded]);
    const service = new CongregationSettingsService(unitOfWork, runtime());

    expect(service.save(context(), input())).toBe(seeded);
    expect(unitOfWork.creates).toHaveLength(0);
    expect(unitOfWork.updates).toHaveLength(0);
  });

  it('requires tenant.manage for both reads and writes', () => {
    const service = new CongregationSettingsService(new FakeCongregationUnitOfWork(), runtime());

    expect(() => service.get(context([]))).toThrow('missing capability tenant.manage');
    expect(() => service.save(context([]), input())).toThrow('missing capability tenant.manage');
  });

  it('defends against a cross-tenant profile returned by a faulty adapter', () => {
    const unitOfWork = new FakeCongregationUnitOfWork();
    unitOfWork.findProfile = () => ({
      tenantId: 'tenant-b',
      name: 'Other',
      timezone: 'Europe/Lisbon',
      defaultLocale: 'en',
      midweekMeeting: { weekday: 3, localTime: '19:00' },
      weekendMeeting: { weekday: 0, localTime: '10:00' },
    });
    const service = new CongregationSettingsService(unitOfWork, runtime());

    expect(() => service.get(context())).toThrow('Cross-tenant access denied');
    expect(() => service.save(context(), input())).toThrow('Cross-tenant access denied');
  });

  it('delegates timezone locale and weekly-slot validation to the domain', () => {
    const service = new CongregationSettingsService(new FakeCongregationUnitOfWork(), runtime());

    expect(() => service.save(context(), { ...input(), timezone: 'Mars/Olympus' })).toThrow('valid IANA timezone');
    expect(() => service.save(context(), { ...input(), defaultLocale: 'not a locale!' })).toThrow('valid locale');
    expect(() => service.save(context(), {
      ...input(),
      weekendMeeting: { weekday: 2, localTime: '19:30' },
    })).toThrow('cannot occupy the same weekly slot');
  });
});

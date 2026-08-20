import {
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createCongregationProfile,
  createDomainEvent,
  type AccessContext,
  type AuditEvent,
  type CongregationProfile,
  type DomainEvent,
  type WeeklyMeetingTime,
} from '@eutaktos/domain';
import {
  eventCorrelation,
  type ApplicationRuntime,
  type RequestMetadata,
} from './people-service';

export interface SaveCongregationSettingsInput {
  name: string;
  timezone: string;
  defaultLocale: string;
  midweekMeeting: WeeklyMeetingTime;
  weekendMeeting: WeeklyMeetingTime;
}

export interface CongregationChange {
  profile: Readonly<CongregationProfile>;
  auditEvent: Readonly<AuditEvent>;
  domainEvent: Readonly<DomainEvent>;
}

/**
 * Persistence implementations must commit the congregation settings, immutable
 * audit record and outbox/domain event atomically. Tenant scope comes from the
 * verified AccessContext, never from caller-provided settings data.
 */
export interface CongregationUnitOfWork {
  findProfile(context: AccessContext): CongregationProfile | undefined;
  commitCreate(context: AccessContext, change: CongregationChange): CongregationProfile;
  commitUpdate(context: AccessContext, change: CongregationChange): CongregationProfile;
}

function sameMeeting(left: WeeklyMeetingTime, right: WeeklyMeetingTime): boolean {
  return left.weekday === right.weekday && left.localTime === right.localTime;
}

function changedFields(
  existing: CongregationProfile,
  next: CongregationProfile,
): readonly string[] {
  const fields: string[] = [];
  if (existing.name !== next.name) fields.push('name');
  if (existing.timezone !== next.timezone) fields.push('timezone');
  if (existing.defaultLocale !== next.defaultLocale) fields.push('defaultLocale');
  if (!sameMeeting(existing.midweekMeeting, next.midweekMeeting)) fields.push('midweekMeeting');
  if (!sameMeeting(existing.weekendMeeting, next.weekendMeeting)) fields.push('weekendMeeting');
  return fields;
}

export class CongregationSettingsService {
  readonly #unitOfWork: CongregationUnitOfWork;
  readonly #runtime: ApplicationRuntime;

  constructor(unitOfWork: CongregationUnitOfWork, runtime: ApplicationRuntime) {
    this.#unitOfWork = unitOfWork;
    this.#runtime = runtime;
  }

  get(context: AccessContext): CongregationProfile | undefined {
    assertCapability(context, 'tenant.manage');
    const profile = this.#unitOfWork.findProfile(context);
    if (profile) assertResourceTenant(context, profile);
    return profile;
  }

  save(
    context: AccessContext,
    input: SaveCongregationSettingsInput,
    metadata: RequestMetadata = {},
  ): CongregationProfile {
    assertCapability(context, 'tenant.manage');

    const existing = this.#unitOfWork.findProfile(context);
    if (existing) assertResourceTenant(context, existing);

    const profile = createCongregationProfile({
      tenantId: context.tenantId,
      name: input.name,
      timezone: input.timezone,
      defaultLocale: input.defaultLocale,
      midweekMeeting: input.midweekMeeting,
      weekendMeeting: input.weekendMeeting,
    });

    const fields = existing
      ? changedFields(existing, profile)
      : ['defaultLocale', 'midweekMeeting', 'name', 'timezone', 'weekendMeeting'];

    if (existing && fields.length === 0) return existing;

    const occurredAt = this.#runtime.now();
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'congregation',
      resourceId: context.tenantId,
      action: existing ? 'update' : 'create',
      actorId: context.actorId,
      occurredAt,
      changedFields: fields,
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: existing ? 'CongregationUpdated' : 'CongregationCreated',
      aggregateId: context.tenantId,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    const change = { profile, auditEvent, domainEvent };
    return existing
      ? this.#unitOfWork.commitUpdate(context, change)
      : this.#unitOfWork.commitCreate(context, change);
  }
}

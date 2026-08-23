import type { CongregationChange, CongregationUnitOfWork } from '@eutaktos/application';
import {
  createCongregationProfile,
  type AccessContext,
  type CongregationProfile,
  type Weekday,
  type WeeklyMeetingTime,
} from '@eutaktos/domain';
import type { EntityRow } from './_db';
import { SupabaseRestDatabase } from './_db';

type PersistedCongregationProfile = Readonly<CongregationProfile & { id: string }>;
type PendingCongregationChange = {
  readonly profile: PersistedCongregationProfile;
  readonly expectedVersion: number | null;
  readonly auditEvent: unknown;
  readonly domainEvent: unknown;
};

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid stored congregation profile');
  return value as Readonly<Record<string, unknown>>;
}

function exactString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid stored congregation ${field}`);
  return value;
}

function meeting(value: unknown, field: string): WeeklyMeetingTime {
  const data = record(value);
  if (!Number.isInteger(data.weekday) || (data.weekday as number) < 0 || (data.weekday as number) > 6) {
    throw new Error(`Invalid stored congregation ${field}.weekday`);
  }
  const localTime = exactString(data.localTime, `${field}.localTime`);
  return { weekday: data.weekday as Weekday, localTime };
}

function storedProfile(row: EntityRow, tenantId: string): Readonly<CongregationProfile> {
  if (row.tenant_id !== tenantId || row.entity_type !== 'congregation' || row.entity_id !== tenantId) {
    throw new Error('Cross-tenant stored congregation profile');
  }
  const data = record(row.data);
  if (data.id !== tenantId || data.tenantId !== tenantId) throw new Error('Invalid stored congregation identity');
  return createCongregationProfile({
    tenantId,
    name: exactString(data.name, 'name'),
    timezone: exactString(data.timezone, 'timezone'),
    defaultLocale: exactString(data.defaultLocale, 'defaultLocale'),
    midweekMeeting: meeting(data.midweekMeeting, 'midweekMeeting'),
    weekendMeeting: meeting(data.weekendMeeting, 'weekendMeeting'),
  });
}

function ensureTenant(context: AccessContext, tenantId: string): void {
  if (context.tenantId !== tenantId) throw new Error('Cross-tenant access denied');
}

function persisted(profile: Readonly<CongregationProfile>): PersistedCongregationProfile {
  return Object.freeze({ id: profile.tenantId, ...profile });
}

export class CongregationSnapshotUnitOfWork implements CongregationUnitOfWork {
  readonly #tenantId: string;
  #profile?: Readonly<CongregationProfile>;
  #version?: number;
  #pending?: PendingCongregationChange;

  constructor(tenantId: string, rows: readonly EntityRow[]) {
    this.#tenantId = tenantId;
    if (rows.length > 1) throw new Error('Multiple congregation profiles found');
    const row = rows[0];
    if (row) {
      this.#profile = storedProfile(row, tenantId);
      this.#version = row.version;
    }
  }

  findProfile(context: AccessContext): CongregationProfile | undefined {
    ensureTenant(context, this.#tenantId);
    return this.#profile ? { ...this.#profile, midweekMeeting: { ...this.#profile.midweekMeeting }, weekendMeeting: { ...this.#profile.weekendMeeting } } : undefined;
  }

  commitCreate(context: AccessContext, change: CongregationChange): CongregationProfile {
    ensureTenant(context, this.#tenantId);
    if (this.#profile || this.#version !== undefined) throw new Error('Congregation profile already exists');
    if (change.profile.tenantId !== this.#tenantId) throw new Error('Cross-tenant congregation change');
    if (this.#pending) throw new Error('Only one congregation mutation is allowed per request');
    this.#pending = {
      profile: persisted(change.profile),
      expectedVersion: null,
      auditEvent: change.auditEvent,
      domainEvent: change.domainEvent,
    };
    this.#profile = change.profile;
    this.#version = 1;
    return change.profile;
  }

  commitUpdate(context: AccessContext, change: CongregationChange): CongregationProfile {
    ensureTenant(context, this.#tenantId);
    if (!this.#profile || this.#version === undefined) throw new Error('Congregation profile not found');
    if (change.profile.tenantId !== this.#tenantId) throw new Error('Cross-tenant congregation change');
    if (this.#pending) throw new Error('Only one congregation mutation is allowed per request');
    const expectedVersion = this.#version;
    this.#pending = {
      profile: persisted(change.profile),
      expectedVersion,
      auditEvent: change.auditEvent,
      domainEvent: change.domainEvent,
    };
    this.#profile = change.profile;
    this.#version = expectedVersion + 1;
    return change.profile;
  }

  async flush(database: SupabaseRestDatabase): Promise<void> {
    const pending = this.#pending;
    if (!pending) return;
    await database.applyEntityChange({
      p_tenant_id: this.#tenantId,
      p_entity_type: 'congregation',
      p_entity_id: this.#tenantId,
      p_data: pending.profile,
      p_expected_version: pending.expectedVersion,
      p_audit: pending.auditEvent,
      p_event: pending.domainEvent,
    });
    this.#pending = undefined;
  }
}

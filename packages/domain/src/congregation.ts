import type { PersonId, TenantId } from './people';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklyMeetingTime {
  weekday: Weekday;
  localTime: string;
}

export interface CongregationProfile {
  tenantId: TenantId;
  name: string;
  timezone: string;
  defaultLocale: string;
  midweekMeeting: WeeklyMeetingTime;
  weekendMeeting: WeeklyMeetingTime;
}

export type DelegatedScope =
  | 'availability.submit'
  | 'reports.submit'
  | 'requests.submit';

export interface Delegation {
  tenantId: TenantId;
  grantorId: PersonId;
  delegateId: PersonId;
  scopes: readonly DelegatedScope[];
  startsAt: string;
  endsAt?: string;
  grantedAt: string;
}

function required(value: string, field: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseInstant(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ISO date: ${value}`);
  return timestamp;
}

function validateTimezone(value: string): string {
  const timezone = required(value, 'timezone');
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new Error('timezone must be a valid IANA timezone');
  }
  return timezone;
}

function validateLocale(value: string): string {
  const locale = required(value, 'defaultLocale');
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? locale;
  } catch {
    throw new Error('defaultLocale must be a valid locale');
  }
}

function validateMeetingTime(input: WeeklyMeetingTime): WeeklyMeetingTime {
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
    throw new Error('weekday must be between 0 and 6');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.localTime)) {
    throw new Error('localTime must use 24-hour HH:mm format');
  }
  return { ...input };
}

export function createCongregationProfile(input: CongregationProfile): Readonly<CongregationProfile> {
  required(input.tenantId, 'tenantId');
  const name = required(input.name, 'congregation name');
  const timezone = validateTimezone(input.timezone);
  const defaultLocale = validateLocale(input.defaultLocale);
  const midweekMeeting = validateMeetingTime(input.midweekMeeting);
  const weekendMeeting = validateMeetingTime(input.weekendMeeting);

  if (
    midweekMeeting.weekday === weekendMeeting.weekday &&
    midweekMeeting.localTime === weekendMeeting.localTime
  ) {
    throw new Error('Midweek and weekend meetings cannot occupy the same weekly slot');
  }

  return Object.freeze({
    ...input,
    name,
    timezone,
    defaultLocale,
    midweekMeeting: Object.freeze(midweekMeeting),
    weekendMeeting: Object.freeze(weekendMeeting),
  });
}

export function createDelegation(input: Delegation): Readonly<Delegation> {
  required(input.tenantId, 'tenantId');
  required(input.grantorId, 'grantorId');
  required(input.delegateId, 'delegateId');
  if (input.grantorId === input.delegateId) throw new Error('A person cannot delegate to themselves');

  const startsAt = parseInstant(input.startsAt);
  const grantedAt = parseInstant(input.grantedAt);
  const endsAt = input.endsAt ? parseInstant(input.endsAt) : Number.POSITIVE_INFINITY;
  if (endsAt <= startsAt) throw new Error('Delegation must end after it starts');
  if (grantedAt > startsAt) throw new Error('Delegation cannot be granted after it starts');

  const scopes = [...new Set(input.scopes)].sort();
  if (scopes.length === 0) throw new Error('Delegation requires at least one scope');

  return Object.freeze({ ...input, scopes: Object.freeze(scopes) });
}

export function isDelegationActiveAt(input: Delegation, instant: string, scope: DelegatedScope): boolean {
  const delegation = createDelegation(input);
  const target = parseInstant(instant);
  const startsAt = parseInstant(delegation.startsAt);
  const endsAt = delegation.endsAt ? parseInstant(delegation.endsAt) : Number.POSITIVE_INFINITY;
  return delegation.scopes.includes(scope) && target >= startsAt && target < endsAt;
}

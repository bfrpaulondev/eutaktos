import type { TenantId } from './people';

export type PublicTalkScheduleId = string;
export type PublicTalkScheduleType = 'local' | 'away';
export type PublicTalkScheduleState = 'draft' | 'confirmed' | 'cancelled' | 'completed';

export const PUBLIC_TALK_SCHEDULE_TYPES: readonly PublicTalkScheduleType[] = Object.freeze(['local', 'away'] as const);
export const PUBLIC_TALK_SCHEDULE_STATES: readonly PublicTalkScheduleState[] = Object.freeze(['draft', 'confirmed', 'cancelled', 'completed'] as const);

const TRANSITIONS: Readonly<Record<PublicTalkScheduleState, readonly PublicTalkScheduleState[]>> = Object.freeze({
  draft: Object.freeze(['confirmed', 'cancelled'] as const),
  confirmed: Object.freeze(['completed', 'cancelled'] as const),
  cancelled: Object.freeze([] as const),
  completed: Object.freeze([] as const),
});

export interface PublicTalkScheduleAssignment {
  readonly id: PublicTalkScheduleId;
  readonly tenantId: TenantId;
  readonly weekendMeetingId: string;
  readonly talkOutlineId: string;
  readonly speakerId: string;
  readonly speakerCongregationId: string;
  readonly date: string;
  readonly localTime: string;
  readonly timezone: string;
  readonly locationId: string | null;
  readonly type: PublicTalkScheduleType;
  readonly visiting: boolean;
  readonly state: PublicTalkScheduleState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function instant(value: string, field = 'timestamp'): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO instant`);
  return value;
}

function dateOnly(value: string): string {
  const normalized = required(value, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error('date must use YYYY-MM-DD format');
  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error('date is not a valid calendar date');
  return normalized;
}

function localTime(value: string): string {
  const normalized = required(value, 'localTime');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) throw new Error('localTime must use 24-hour HH:mm format');
  return normalized;
}

function timezone(value: string): string {
  const normalized = required(value, 'timezone');
  try { new Intl.DateTimeFormat('en', { timeZone: normalized }).format(new Date(0)); }
  catch { throw new Error('timezone must be a valid IANA timezone'); }
  return normalized;
}

function typeOf(value: unknown): PublicTalkScheduleType {
  if (value !== 'local' && value !== 'away') throw new Error('type must be local or away');
  return value;
}

function visitingOf(value: unknown): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') throw new Error('visiting must be a boolean');
  return value;
}

function location(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('locationId must be a string or null');
  const normalized = value.trim();
  return normalized || null;
}

export function assertPublicTalkScheduleStructure(value: Readonly<PublicTalkScheduleAssignment>): void {
  if (value.type === 'away' && value.visiting) {
    throw new Error('Away public talks cannot be marked as visiting');
  }
}

export function createPublicTalkSchedule(input: {
  id: PublicTalkScheduleId;
  tenantId: TenantId;
  weekendMeetingId: string;
  talkOutlineId: string;
  speakerId: string;
  speakerCongregationId: string;
  date: string;
  localTime: string;
  timezone: string;
  locationId?: string | null;
  type: PublicTalkScheduleType;
  visiting?: boolean;
  now: string;
}): Readonly<PublicTalkScheduleAssignment> {
  const assignment = Object.freeze({
    id: required(input.id, 'id'),
    tenantId: required(input.tenantId, 'tenantId'),
    weekendMeetingId: required(input.weekendMeetingId, 'weekendMeetingId'),
    talkOutlineId: required(input.talkOutlineId, 'talkOutlineId'),
    speakerId: required(input.speakerId, 'speakerId'),
    speakerCongregationId: required(input.speakerCongregationId, 'speakerCongregationId'),
    date: dateOnly(input.date),
    localTime: localTime(input.localTime),
    timezone: timezone(input.timezone),
    locationId: location(input.locationId),
    type: typeOf(input.type),
    visiting: visitingOf(input.visiting),
    state: 'draft' as const,
    createdAt: instant(input.now, 'now'),
    updatedAt: input.now,
  });
  assertPublicTalkScheduleStructure(assignment);
  return assignment;
}

function transition(
  assignment: Readonly<PublicTalkScheduleAssignment>,
  state: PublicTalkScheduleState,
  now: string,
): Readonly<PublicTalkScheduleAssignment> {
  instant(now, 'now');
  if (!TRANSITIONS[assignment.state].includes(state)) throw new Error(`Invalid public talk schedule transition: ${assignment.state} -> ${state}`);
  return Object.freeze({ ...assignment, state, updatedAt: now });
}

export function confirmPublicTalkSchedule(assignment: Readonly<PublicTalkScheduleAssignment>, now: string): Readonly<PublicTalkScheduleAssignment> {
  return transition(assignment, 'confirmed', now);
}

export function cancelPublicTalkSchedule(assignment: Readonly<PublicTalkScheduleAssignment>, now: string): Readonly<PublicTalkScheduleAssignment> {
  return transition(assignment, 'cancelled', now);
}

export function completePublicTalkSchedule(assignment: Readonly<PublicTalkScheduleAssignment>, now: string): Readonly<PublicTalkScheduleAssignment> {
  return transition(assignment, 'completed', now);
}

export function updatePublicTalkSchedule(
  assignment: Readonly<PublicTalkScheduleAssignment>,
  changes: {
    weekendMeetingId?: string;
    talkOutlineId?: string;
    speakerId?: string;
    speakerCongregationId?: string;
    date?: string;
    localTime?: string;
    timezone?: string;
    locationId?: string | null;
    type?: PublicTalkScheduleType;
    visiting?: boolean;
  },
  now: string,
): Readonly<PublicTalkScheduleAssignment> {
  if (assignment.state !== 'draft') throw new Error('Only draft public talk schedules can be updated');
  instant(now, 'now');
  const updated = Object.freeze({
    ...assignment,
    ...(changes.weekendMeetingId !== undefined ? { weekendMeetingId: required(changes.weekendMeetingId, 'weekendMeetingId') } : {}),
    ...(changes.talkOutlineId !== undefined ? { talkOutlineId: required(changes.talkOutlineId, 'talkOutlineId') } : {}),
    ...(changes.speakerId !== undefined ? { speakerId: required(changes.speakerId, 'speakerId') } : {}),
    ...(changes.speakerCongregationId !== undefined ? { speakerCongregationId: required(changes.speakerCongregationId, 'speakerCongregationId') } : {}),
    ...(changes.date !== undefined ? { date: dateOnly(changes.date) } : {}),
    ...(changes.localTime !== undefined ? { localTime: localTime(changes.localTime) } : {}),
    ...(changes.timezone !== undefined ? { timezone: timezone(changes.timezone) } : {}),
    ...(Object.prototype.hasOwnProperty.call(changes, 'locationId') ? { locationId: location(changes.locationId) } : {}),
    ...(changes.type !== undefined ? { type: typeOf(changes.type) } : {}),
    ...(Object.prototype.hasOwnProperty.call(changes, 'visiting') ? { visiting: visitingOf(changes.visiting) } : {}),
    updatedAt: now,
  });
  assertPublicTalkScheduleStructure(updated);
  return updated;
}

export function assertPublicTalkScheduleTenant(assignment: Readonly<PublicTalkScheduleAssignment>, tenantId: TenantId): void {
  if (assignment.tenantId !== tenantId) throw new Error('Cross-tenant public talk schedule access denied');
}

export function publicTalkSchedulesForTenant(
  assignments: readonly Readonly<PublicTalkScheduleAssignment>[],
  tenantId: TenantId,
): readonly Readonly<PublicTalkScheduleAssignment>[] {
  return assignments.filter(item => item.tenantId === tenantId);
}

export function publicTalkSchedulesForSpeaker(
  assignments: readonly Readonly<PublicTalkScheduleAssignment>[],
  tenantId: TenantId,
  speakerId: string,
): readonly Readonly<PublicTalkScheduleAssignment>[] {
  const speaker = required(speakerId, 'speakerId');
  return assignments.filter(item => item.tenantId === tenantId && item.speakerId === speaker);
}

export function publicTalkSchedulesInDateRange(
  assignments: readonly Readonly<PublicTalkScheduleAssignment>[],
  tenantId: TenantId,
  from: string,
  to: string,
): readonly Readonly<PublicTalkScheduleAssignment>[] {
  const start = dateOnly(from); const end = dateOnly(to);
  if (end < start) throw new Error('Date range must end on or after it starts');
  return assignments.filter(item => item.tenantId === tenantId && item.date >= start && item.date <= end);
}

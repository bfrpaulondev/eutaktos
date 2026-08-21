import type { TenantId } from './people';

// ---- Type aliases ----

export type WeekendMeetingId = string;
export type MeetingLocationId = string;

// ---- Enums as union types ----

export type WeekendMeetingState = 'draft' | 'published' | 'archived';

const VALID_STATES: readonly WeekendMeetingState[] = Object.freeze(
  ['draft', 'published', 'archived'] as const,
);

// ---- Sub-structures ----

export interface PublicTalkAssignment {
  readonly outlineId?: string;
  readonly speakerId?: string;
  readonly speakerCongregationId?: string;
}

export interface WatchtowerStudyAssignment {
  readonly conductorId?: string;
  readonly readerId?: string;
}

// ---- Meeting Aggregate ----

export interface WeekendMeeting {
  readonly id: WeekendMeetingId;
  readonly tenantId: TenantId;
  readonly date: string;            // YYYY-MM-DD in meeting timezone
  readonly localTime: string;      // HH:mm 24-hour format
  readonly timezone: string;       // IANA timezone
  readonly publicTalk: Readonly<PublicTalkAssignment>;
  readonly watchtowerStudy: Readonly<WatchtowerStudyAssignment>;
  readonly chairmanId?: string;
  readonly locationId?: MeetingLocationId;
  readonly state: WeekendMeetingState;
  readonly createdAt: string;      // ISO 8601 instant
  readonly updatedAt: string;      // ISO 8601 instant
}

// ---- Validation helpers (module-private) ----

function required(value: string | undefined, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseInstant(value: string): number {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ISO date: ${String(value)}`);
  }
  return Date.parse(value);
}

function validateDateOnly(value: string): string {
  const date = required(value, 'date');
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
    throw new Error('date must use YYYY-MM-DD format');
  }
  const parsed = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(parsed)) throw new Error('date is not a valid calendar date');
  // Verify the parsed date matches the requested date (catches Feb 29 on non-leap)
  const reconstituted = new Date(parsed);
  const yyyy = String(reconstituted.getUTCFullYear());
  const mm = String(reconstituted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(reconstituted.getUTCDate()).padStart(2, '0');
  if (date !== `${yyyy}-${mm}-${dd}`) throw new Error('date is not a valid calendar date');
  return date;
}

function validateLocalTime(value: string): string {
  const time = required(value, 'localTime');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('localTime must use 24-hour HH:mm format');
  }
  return time;
}

function validateTimezone(value: string): string {
  const tz = required(value, 'timezone');
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz }).format(new Date(0));
  } catch {
    throw new Error('timezone must be a valid IANA timezone');
  }
  return tz;
}

function validateState(value: string): WeekendMeetingState {
  if (!VALID_STATES.includes(value as WeekendMeetingState)) {
    throw new Error(`Invalid meeting state: ${String(value)}`);
  }
  return value as WeekendMeetingState;
}

function optionalId(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  return required(value, field);
}

function freezePublicTalk(input: Partial<PublicTalkAssignment>): Readonly<PublicTalkAssignment> {
  const result: { outlineId?: string; speakerId?: string; speakerCongregationId?: string } = {};
  if (input.outlineId !== undefined) result.outlineId = required(input.outlineId, 'outlineId');
  if (input.speakerId !== undefined) result.speakerId = required(input.speakerId, 'speakerId');
  if (input.speakerCongregationId !== undefined) result.speakerCongregationId = required(input.speakerCongregationId, 'speakerCongregationId');
  return Object.freeze(result) as Readonly<PublicTalkAssignment>;
}

function freezeWatchtowerStudy(input: Partial<WatchtowerStudyAssignment>): Readonly<WatchtowerStudyAssignment> {
  const result: { conductorId?: string; readerId?: string } = {};
  if (input.conductorId !== undefined) result.conductorId = required(input.conductorId, 'conductorId');
  if (input.readerId !== undefined) result.readerId = required(input.readerId, 'readerId');
  return Object.freeze(result) as Readonly<WatchtowerStudyAssignment>;
}

// ---- Factory / lifecycle functions ----

/**
 * Create a new WeekendMeeting in `draft` state.
 * All inputs are validated; the returned object is deeply frozen.
 */
export function createWeekendMeeting(input: {
  id: WeekendMeetingId;
  tenantId: TenantId;
  date: string;
  localTime: string;
  timezone: string;
  publicTalk?: Partial<PublicTalkAssignment>;
  watchtowerStudy?: Partial<WatchtowerStudyAssignment>;
  chairmanId?: string;
  locationId?: MeetingLocationId;
  now: string;
}): Readonly<WeekendMeeting> {
  const now = required(input.now, 'now');
  parseInstant(now);

  const id = required(input.id, 'meetingId');
  const tenantId = required(input.tenantId, 'tenantId');
  const date = validateDateOnly(input.date);
  const localTime = validateLocalTime(input.localTime);
  const timezone = validateTimezone(input.timezone);
  const publicTalk = freezePublicTalk(input.publicTalk ?? {});
  const watchtowerStudy = freezeWatchtowerStudy(input.watchtowerStudy ?? {});
  const chairmanId = optionalId(input.chairmanId, 'chairmanId');

  if (input.locationId !== undefined) {
    required(input.locationId, 'locationId');
  }

  return Object.freeze({
    id,
    tenantId,
    date,
    localTime,
    timezone,
    publicTalk,
    watchtowerStudy,
    ...(chairmanId !== undefined ? { chairmanId } : {}),
    ...(input.locationId ? { locationId: input.locationId } : {}),
    state: 'draft',
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Transition a meeting to `published` state.
 * Only `draft` meetings can be published.
 */
export function publishWeekendMeeting(
  meeting: Readonly<WeekendMeeting>,
  now: string,
): Readonly<WeekendMeeting> {
  parseInstant(now);
  if (meeting.state !== 'draft') {
    throw new Error(`Cannot publish meeting in '${meeting.state}' state`);
  }
  return Object.freeze({ ...meeting, state: 'published' as const, updatedAt: now });
}

/**
 * Transition a meeting to `archived` state.
 * Only `published` meetings can be archived.
 */
export function archiveWeekendMeeting(
  meeting: Readonly<WeekendMeeting>,
  now: string,
): Readonly<WeekendMeeting> {
  parseInstant(now);
  if (meeting.state !== 'published') {
    throw new Error(`Cannot archive meeting in '${meeting.state}' state`);
  }
  return Object.freeze({ ...meeting, state: 'archived' as const, updatedAt: now });
}

/**
 * Update mutable fields (date, localTime, timezone, locationId) on a draft meeting.
 * Only draft meetings can be updated.
 */
export function updateWeekendMeeting(
  meeting: Readonly<WeekendMeeting>,
  changes: {
    date?: string;
    localTime?: string;
    timezone?: string;
    locationId?: string | null;
  },
  now: string,
): Readonly<WeekendMeeting> {
  parseInstant(now);
  if (meeting.state !== 'draft') {
    throw new Error(`Cannot update a '${meeting.state}' meeting`);
  }

  const date = changes.date !== undefined ? validateDateOnly(changes.date) : meeting.date;
  const localTime = changes.localTime !== undefined ? validateLocalTime(changes.localTime) : meeting.localTime;
  const timezone = changes.timezone !== undefined ? validateTimezone(changes.timezone) : meeting.timezone;

  // Determine locationId: null explicitly clears it
  let locationId: MeetingLocationId | undefined = meeting.locationId;
  if (changes.locationId !== undefined) {
    locationId = changes.locationId === null ? undefined : required(changes.locationId, 'locationId');
  }

  const { locationId: _oldLocationId, ...rest } = meeting as WeekendMeeting & { locationId?: string };
  void _oldLocationId;

  return Object.freeze({
    ...rest,
    date,
    localTime,
    timezone,
    ...(locationId !== undefined ? { locationId } : {}),
    updatedAt: now,
  });
}

/**
 * Assign or update the public talk and speaker for a draft meeting.
 */
export function assignPublicTalk(
  meeting: Readonly<WeekendMeeting>,
  outlineId: string,
  now: string,
  speakerId?: string,
  speakerCongregationId?: string,
): Readonly<WeekendMeeting> {
  parseInstant(now);
  if (meeting.state !== 'draft') {
    throw new Error(`Cannot modify a '${meeting.state}' meeting`);
  }

  const validatedOutlineId = required(outlineId, 'outlineId');
  const validatedSpeakerId = optionalId(speakerId, 'speakerId');
  const validatedCongregationId = optionalId(speakerCongregationId, 'speakerCongregationId');

  const publicTalk: { outlineId: string; speakerId?: string; speakerCongregationId?: string } = { outlineId: validatedOutlineId };
  if (validatedSpeakerId !== undefined) publicTalk.speakerId = validatedSpeakerId;
  if (validatedCongregationId !== undefined) publicTalk.speakerCongregationId = validatedCongregationId;

  return Object.freeze({ ...meeting, publicTalk: Object.freeze(publicTalk) as Readonly<PublicTalkAssignment>, updatedAt: now });
}

/**
 * Clear the public talk assignment from a draft meeting.
 */
export function clearPublicTalk(
  meeting: Readonly<WeekendMeeting>,
  now: string,
): Readonly<WeekendMeeting> {
  parseInstant(now);
  if (meeting.state !== 'draft') {
    throw new Error(`Cannot modify a '${meeting.state}' meeting`);
  }
  return Object.freeze({ ...meeting, publicTalk: Object.freeze({}), updatedAt: now });
}

/**
 * Assign the watchtower study conductor and reader for a draft meeting.
 */
export function assignWatchtowerStudy(
  meeting: Readonly<WeekendMeeting>,
  conductorId: string,
  readerId: string,
  now: string,
): Readonly<WeekendMeeting> {
  parseInstant(now);
  if (meeting.state !== 'draft') {
    throw new Error(`Cannot modify a '${meeting.state}' meeting`);
  }

  const validatedConductorId = required(conductorId, 'conductorId');
  const validatedReaderId = required(readerId, 'readerId');

  return Object.freeze({
    ...meeting,
    watchtowerStudy: Object.freeze({ conductorId: validatedConductorId, readerId: validatedReaderId }),
    updatedAt: now,
  });
}

/**
 * Assign the chairman for a draft meeting.
 */
export function assignChairman(
  meeting: Readonly<WeekendMeeting>,
  personId: string,
  now: string,
): Readonly<WeekendMeeting> {
  parseInstant(now);
  if (meeting.state !== 'draft') {
    throw new Error(`Cannot modify a '${meeting.state}' meeting`);
  }

  const validatedPersonId = required(personId, 'personId');
  return Object.freeze({ ...meeting, chairmanId: validatedPersonId, updatedAt: now });
}

// ---- Query / guard functions ----

/** Assert that a meeting belongs to the given tenant. */
export function assertWeekendMeetingTenant(
  meeting: Readonly<WeekendMeeting>,
  tenantId: TenantId,
): void {
  if (meeting.tenantId !== tenantId) {
    throw new Error('Cross-tenant weekend meeting access denied');
  }
}

/** Filter meetings by tenant. */
export function filterWeekendMeetingsByTenant(
  meetings: readonly Readonly<WeekendMeeting>[],
  tenantId: TenantId,
): readonly Readonly<WeekendMeeting>[] {
  return meetings.filter(m => m.tenantId === tenantId);
}

/** Sort meetings by date ascending (earliest first), then by id for stability. */
export function orderWeekendMeetingsByDate(
  meetings: readonly Readonly<WeekendMeeting>[],
): readonly Readonly<WeekendMeeting>[] {
  return [...meetings].sort((a, b) => {
    const delta = a.date.localeCompare(b.date);
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}

/**
 * Check whether a meeting is effectively immutable (published or archived).
 * This is a convenience read — it does NOT authorize mutations.
 */
export function isWeekendMeetingLocked(meeting: Readonly<WeekendMeeting>): boolean {
  return meeting.state === 'published' || meeting.state === 'archived';
}

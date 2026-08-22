import type { TenantId } from './people';

// ---- Type aliases ----

export type MidweekMeetingId = string;
export type MeetingSlotId = string;
export type MeetingLocationId = string;

// ---- Enums as union types ----

export type MidweekMeetingState = 'draft' | 'published' | 'cancelled' | 'archived';

const VALID_STATES: readonly MidweekMeetingState[] = Object.freeze(
  ['draft', 'published', 'cancelled', 'archived'] as const,
);

// ---- Slot / Section ----

export interface MeetingSlot {
  readonly id: MeetingSlotId;
  readonly position: number;
  readonly durationMinutes: number;
  readonly titleKey: string;
  readonly partDefinitionId?: string;
}

// ---- Meeting Aggregate ----

export interface MidweekMeeting {
  readonly id: MidweekMeetingId;
  readonly tenantId: TenantId;
  readonly date: string;            // YYYY-MM-DD in meeting timezone
  readonly localTime: string;      // HH:mm 24-hour format
  readonly timezone: string;       // IANA timezone
  readonly locationId?: MeetingLocationId;
  readonly state: MidweekMeetingState;
  readonly slots: readonly MeetingSlot[];
  readonly createdAt: string;      // ISO 8601 instant
  readonly updatedAt: string;      // ISO 8601 instant
}

// ---- Validation helpers (module-private) ----

function required(value: string, field: string): string {
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

function validateState(value: string): MidweekMeetingState {
  if (!VALID_STATES.includes(value as MidweekMeetingState)) {
    throw new Error(`Invalid meeting state: ${String(value)}`);
  }
  return value as MidweekMeetingState;
}

function validateSlots(slots: readonly MeetingSlot[]): readonly MeetingSlot[] {
  if (!Array.isArray(slots)) throw new Error('slots must be an array');

  const seenIds = new Set<string>();
  const seenPositions = new Set<number>();

  for (const slot of slots) {
    const id = required(slot.id, 'slotId');
    if (seenIds.has(id)) throw new Error(`Duplicate slot id: ${id}`);
    seenIds.add(id);

    if (typeof slot.position !== 'number' || slot.position < 0 || !Number.isInteger(slot.position)) {
      throw new Error('slot position must be a non-negative integer');
    }
    if (seenPositions.has(slot.position)) {
      throw new Error(`Duplicate slot position: ${slot.position}`);
    }
    seenPositions.add(slot.position);

    if (typeof slot.durationMinutes !== 'number' || slot.durationMinutes <= 0 || !Number.isFinite(slot.durationMinutes)) {
      throw new Error('slot durationMinutes must be a positive number');
    }

    const titleKey = required(slot.titleKey, 'slotTitleKey');
    if (titleKey.length > 120) throw new Error('slot titleKey is too long');

    if (slot.partDefinitionId !== undefined) {
      const partDefId = required(slot.partDefinitionId, 'partDefinitionId');
      if (partDefId.length > 120) throw new Error('partDefinitionId is too long');
    }
  }

  // Return defensively cloned and sorted by position
  return Object.freeze(
    [...slots]
      .sort((a, b) => a.position - b.position)
      .map(s => Object.freeze({ ...s })),
  );
}

// ---- Factory / lifecycle functions ----

/**
 * Create a new MidweekMeeting in `draft` state.
 * All inputs are validated; the returned object is deeply frozen.
 */
export function createMidweekMeeting(input: {
  id: MidweekMeetingId;
  tenantId: TenantId;
  date: string;
  localTime: string;
  timezone: string;
  locationId?: MeetingLocationId;
  slots?: readonly MeetingSlot[];
  now: string;
}): Readonly<MidweekMeeting> {
  const now = required(input.now, 'now');
  parseInstant(now);

  const id = required(input.id, 'meetingId');
  const tenantId = required(input.tenantId, 'tenantId');
  const date = validateDateOnly(input.date);
  const localTime = validateLocalTime(input.localTime);
  const timezone = validateTimezone(input.timezone);
  const slots = validateSlots(input.slots ?? []);

  if (input.locationId !== undefined) {
    required(input.locationId, 'locationId');
  }

  return Object.freeze({
    id,
    tenantId,
    date,
    localTime,
    timezone,
    ...(input.locationId ? { locationId: input.locationId } : {}),
    state: 'draft',
    slots,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Transition a meeting to `published` state.
 * Only `draft` meetings can be published.
 */
export function publishMidweekMeeting(
  meeting: Readonly<MidweekMeeting>,
  now: string,
): Readonly<MidweekMeeting> {
  parseInstant(now);
  if (meeting.state !== 'draft') {
    throw new Error(`Cannot publish meeting in '${meeting.state}' state`);
  }
  return Object.freeze({ ...meeting, state: 'published', updatedAt: now });
}

/** Transition a draft or published meeting to its terminal `cancelled` state. */
export function cancelMidweekMeeting(
  meeting: Readonly<MidweekMeeting>,
  now: string,
): Readonly<MidweekMeeting> {
  parseInstant(now);
  if (meeting.state !== 'draft' && meeting.state !== 'published') throw new Error(`Cannot cancel meeting in '${meeting.state}' state`);
  return Object.freeze({ ...meeting, state: 'cancelled', updatedAt: now });
}

/** Archive a published or cancelled meeting after its lifecycle is closed. */
export function archiveMidweekMeeting(
  meeting: Readonly<MidweekMeeting>,
  now: string,
): Readonly<MidweekMeeting> {
  parseInstant(now);
  if (meeting.state !== 'published' && meeting.state !== 'cancelled') {
    throw new Error(`Cannot archive meeting in '${meeting.state}' state`);
  }
  return Object.freeze({ ...meeting, state: 'archived', updatedAt: now });
}

/**
 * Add a slot to a draft meeting. Slots are sorted by position.
 * Only draft meetings accept slot changes.
 */
export function addMeetingSlot(
  meeting: Readonly<MidweekMeeting>,
  slot: MeetingSlot,
): Readonly<MidweekMeeting> {
  if (meeting.state !== 'draft') {
    throw new Error(`Cannot modify slots on a '${meeting.state}' meeting`);
  }
  const existingIds = new Set(meeting.slots.map(s => s.id));
  const normalizedSlot = { ...slot, id: required(slot.id, 'slotId') };
  if (existingIds.has(normalizedSlot.id)) {
    throw new Error(`Slot id already exists: ${normalizedSlot.id}`);
  }
  const newSlots = [...meeting.slots, normalizedSlot];
  const validatedSlots = validateSlots(newSlots);
  return Object.freeze({ ...meeting, slots: validatedSlots, updatedAt: meeting.updatedAt });
}

/**
 * Remove a slot from a draft meeting by slot id.
 * Only draft meetings accept slot changes.
 */
export function removeMeetingSlot(
  meeting: Readonly<MidweekMeeting>,
  slotId: MeetingSlotId,
): Readonly<MidweekMeeting> {
  if (meeting.state !== 'draft') {
    throw new Error(`Cannot modify slots on a '${meeting.state}' meeting`);
  }
  required(slotId, 'slotId');
  const filtered = meeting.slots.filter(s => s.id !== slotId);
  if (filtered.length === meeting.slots.length) {
    throw new Error(`Slot not found: ${slotId}`);
  }
  return Object.freeze({ ...meeting, slots: validateSlots(filtered) });
}

/**
 * Update mutable fields (date, localTime, timezone, locationId) on a draft meeting.
 * Only draft meetings can be updated.
 */
export function updateMidweekMeeting(
  meeting: Readonly<MidweekMeeting>,
  changes: {
    date?: string;
    localTime?: string;
    timezone?: string;
    locationId?: string | null;
  },
  now: string,
): Readonly<MidweekMeeting> {
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

  // Destructure to omit old locationId from spread, then conditionally add
  const { locationId: _oldLocationId, ...rest } = meeting as MidweekMeeting & { locationId?: string };
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

// ---- Query / guard functions ----

/** Assert that a meeting belongs to the given tenant. */
export function assertMeetingTenant(meeting: Readonly<MidweekMeeting>, tenantId: TenantId): void {
  if (meeting.tenantId !== tenantId) {
    throw new Error('Cross-tenant meeting access denied');
  }
}

/** Filter meetings by tenant. */
export function filterMeetingsByTenant(
  meetings: readonly Readonly<MidweekMeeting>[],
  tenantId: TenantId,
): readonly Readonly<MidweekMeeting>[] {
  return meetings.filter(m => m.tenantId === tenantId);
}

/** Sort meetings by date descending (most recent first), then by id for stability. */
export function orderMeetingsByDate(
  meetings: readonly Readonly<MidweekMeeting>[],
): readonly Readonly<MidweekMeeting>[] {
  return [...meetings].sort((a, b) => {
    const delta = a.date.localeCompare(b.date);
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}

/**
 * Check whether a meeting is effectively immutable (published or archived).
 * This is a convenience read — it does NOT authorize mutations.
 */
export function isMeetingLocked(meeting: Readonly<MidweekMeeting>): boolean {
  return meeting.state === 'published' || meeting.state === 'cancelled' || meeting.state === 'archived';
}

/** Get a slot by id from a meeting. Returns undefined if not found. */
export function findSlotById(
  meeting: Readonly<MidweekMeeting>,
  slotId: MeetingSlotId,
): Readonly<MeetingSlot> | undefined {
  return meeting.slots.find(s => s.id === slotId);
}

/** Get total scheduled duration in minutes from all slots. */
export function totalScheduledMinutes(meeting: Readonly<MidweekMeeting>): number {
  return meeting.slots.reduce((sum, s) => sum + s.durationMinutes, 0);
}

/** Validate and normalize a MeetingSlot on its own (for testing/import). */
export function validateMeetingSlot(slot: MeetingSlot): Readonly<MeetingSlot> {
  const id = required(slot.id, 'slotId');
  if (typeof slot.position !== 'number' || slot.position < 0 || !Number.isInteger(slot.position)) {
    throw new Error('slot position must be a non-negative integer');
  }
  if (typeof slot.durationMinutes !== 'number' || slot.durationMinutes <= 0 || !Number.isFinite(slot.durationMinutes)) {
    throw new Error('slot durationMinutes must be a positive number');
  }
  const titleKey = required(slot.titleKey, 'slotTitleKey');
  if (titleKey.length > 120) throw new Error('slot titleKey is too long');

  const result: MeetingSlot = { id, position: slot.position, durationMinutes: slot.durationMinutes, titleKey };
  if (slot.partDefinitionId !== undefined) {
    return Object.freeze({ ...result, partDefinitionId: required(slot.partDefinitionId, 'partDefinitionId') });
  }
  return Object.freeze(result);
}

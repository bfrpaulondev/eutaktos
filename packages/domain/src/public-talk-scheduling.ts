/**
 * K38 — Public Talk Scheduling
 *
 * Domain model for scheduling public talks (weekend meeting public discourse).
 * This is a reference-only model: all IDs are foreign references, no embedded entities.
 *
 * NOTE (tenant congregation enforcement):
 *   Visiting speaker's congregation must differ from the tenant's home congregation.
 *   This cannot be enforced at the domain level because this model does not carry
 *   the tenant's congregation ID. The application layer MUST enforce this constraint.
 */
import type { TenantId } from './people';

// ─── ID types ────────────────────────────────────────────────────────────────
export type PublicTalkAssignmentId = string;
export type WeekendMeetingId = string;
export type TalkOutlineId = string;
export type SpeakerId = string;
export type CongregationId = string;
export type LocationId = string;

// ─── Value types ─────────────────────────────────────────────────────────────
export type TalkAssignmentType = 'local' | 'away';
export type TalkAssignmentState = 'draft' | 'confirmed' | 'cancelled' | 'completed';

export const TALK_ASSIGNMENT_TYPES: readonly TalkAssignmentType[] =
  Object.freeze(['local', 'away'] as const);

export const TALK_ASSIGNMENT_STATES: readonly TalkAssignmentState[] =
  Object.freeze(['draft', 'confirmed', 'cancelled', 'completed'] as const);

// ─── Valid state transitions ─────────────────────────────────────────────────
const VALID_TRANSITIONS: Readonly<Record<TalkAssignmentState, readonly TalkAssignmentState[]>> = {
  draft:     ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  cancelled: [],
  completed: [],
};

// ─── Aggregate root ──────────────────────────────────────────────────────────
export interface PublicTalkAssignment {
  readonly id: PublicTalkAssignmentId;
  readonly tenantId: TenantId;
  readonly weekendMeetingId: WeekendMeetingId;
  readonly talkOutlineId: TalkOutlineId;
  readonly speakerId: SpeakerId;
  readonly speakerCongregationId: CongregationId;
  readonly date: string;            // YYYY-MM-DD
  readonly localTime: string;       // HH:mm
  readonly timezone: string;        // IANA timezone
  readonly locationId: LocationId | null;
  readonly type: TalkAssignmentType;
  readonly visiting: boolean;
  readonly state: TalkAssignmentState;
  readonly createdAt: string;       // ISO instant
  readonly updatedAt: string;       // ISO instant
}

// ─── Validation helpers ──────────────────────────────────────────────────────
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ISO date: ${String(value)}`);
  }
}

function validateDateString(value: string): void {
  if (typeof value !== 'string') throw new Error('date must be a string');
  const trimmed = value.trim();
  // YYYY-MM-DD pattern
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`date must be YYYY-MM-DD format, got: ${value}`);
  }
  const parsed = Date.parse(trimmed + 'T00:00:00Z');
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid date: ${value}`);
  }
  // Verify the date didn't roll over (e.g. 2027-02-29 → Mar 1)
  const dateParts = trimmed.split('-');
  const d = new Date(parsed);
  if (d.getUTCFullYear() !== parseInt(dateParts[0], 10) ||
      d.getUTCMonth() + 1 !== parseInt(dateParts[1], 10) ||
      d.getUTCDate() !== parseInt(dateParts[2], 10)) {
    throw new Error(`Invalid date: ${value}`);
  }
}

function validateLocalTime(value: string): void {
  if (typeof value !== 'string') throw new Error('localTime must be a string');
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    throw new Error(`localTime must be HH:mm format, got: ${value}`);
  }
  const hours = parseInt(trimmed.slice(0, 2), 10);
  const minutes = parseInt(trimmed.slice(3, 5), 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`localTime out of range, got: ${value}`);
  }
}

/**
 * Basic IANA timezone validation. Full validation is impractical in pure JS,
 * so we check the shape and verify the Intl API recognises it.
 */
function validateTimezone(value: string): void {
  if (typeof value !== 'string') throw new Error('timezone must be a string');
  const trimmed = value.trim();
  if (!trimmed) throw new Error('timezone is required');
  // IANA timezones are like "Europe/London", "America/New_York", "UTC"
  if (!/^[A-Za-z_/]+$/.test(trimmed)) {
    throw new Error(`Invalid timezone format: ${value}`);
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
  } catch {
    throw new Error(`Unrecognised IANA timezone: ${value}`);
  }
}

function normalizeLocationId(value: string | null | undefined): LocationId | null {
  if (value === null || value === undefined || value === '') return null;
  return required(value, 'locationId');
}

function validateTalkAssignmentType(value: string): TalkAssignmentType {
  if (!TALK_ASSIGNMENT_TYPES.includes(value as TalkAssignmentType)) {
    throw new Error(`Invalid type: ${value}. Must be 'local' or 'away'`);
  }
  return value as TalkAssignmentType;
}

function validateTalkAssignmentState(value: string): TalkAssignmentState {
  if (!TALK_ASSIGNMENT_STATES.includes(value as TalkAssignmentState)) {
    throw new Error(`Invalid state: ${value}. Must be one of: ${TALK_ASSIGNMENT_STATES.join(', ')}`);
  }
  return value as TalkAssignmentState;
}

// ─── Structural consistency ───────────────────────────────────────────────────

/**
 * Prevent structurally impossible combinations.
 *
 * Rules:
 *  - type='away' AND visiting=true → INVALID (an away talk means our speaker
 *    goes elsewhere; visiting means their speaker comes to us — these are
 *    contradictory).
 *  - type='local' AND visiting=true → VALID (a visiting speaker at our
 *    local meeting).
 */
export function validateStructuralConsistency(assignment: Readonly<PublicTalkAssignment>): void {
  if (assignment.type === 'away' && assignment.visiting) {
    throw new Error(
      'Structural inconsistency: type "away" (our speaker at another congregation) ' +
      'cannot have visiting=true (another congregation\'s speaker at our meeting)',
    );
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createPublicTalkAssignment(input: {
  id: PublicTalkAssignmentId;
  tenantId: TenantId;
  weekendMeetingId: WeekendMeetingId;
  talkOutlineId: TalkOutlineId;
  speakerId: SpeakerId;
  speakerCongregationId: CongregationId;
  date: string;            // YYYY-MM-DD
  localTime: string;       // HH:mm
  timezone: string;        // IANA
  locationId?: LocationId | null;
  type: TalkAssignmentType;
  visiting?: boolean;
  now: string;             // ISO instant
}): Readonly<PublicTalkAssignment> {
  validateInstant(input.now);

  const id = required(input.id, 'id');
  const tenantId = required(input.tenantId, 'tenantId');
  const weekendMeetingId = required(input.weekendMeetingId, 'weekendMeetingId');
  const talkOutlineId = required(input.talkOutlineId, 'talkOutlineId');
  const speakerId = required(input.speakerId, 'speakerId');
  const speakerCongregationId = required(input.speakerCongregationId, 'speakerCongregationId');

  validateDateString(input.date);
  validateLocalTime(input.localTime);
  validateTimezone(input.timezone);

  const date = input.date.trim();
  const localTime = input.localTime.trim();
  const timezone = input.timezone.trim();
  const locationId = normalizeLocationId(input.locationId);
  const type = validateTalkAssignmentType(input.type);
  const visiting = Boolean(input.visiting);

  const assignment: Readonly<PublicTalkAssignment> = Object.freeze({
    id,
    tenantId,
    weekendMeetingId,
    talkOutlineId,
    speakerId,
    speakerCongregationId,
    date,
    localTime,
    timezone,
    locationId,
    type,
    visiting,
    state: 'draft',
    createdAt: input.now,
    updatedAt: input.now,
  });

  validateStructuralConsistency(assignment);
  return assignment;
}

// ─── State transitions ───────────────────────────────────────────────────────

function transitionState(
  assignment: Readonly<PublicTalkAssignment>,
  newState: TalkAssignmentState,
  now: string,
): Readonly<PublicTalkAssignment> {
  validateInstant(now);
  if (!VALID_TRANSITIONS[assignment.state]?.includes(newState)) {
    throw new Error(`Invalid transition: ${assignment.state} → ${newState}`);
  }
  return Object.freeze({ ...assignment, state: newState, updatedAt: now });
}

export function confirmTalkAssignment(
  assignment: Readonly<PublicTalkAssignment>,
  now: string,
): Readonly<PublicTalkAssignment> {
  return transitionState(assignment, 'confirmed', now);
}

export function cancelTalkAssignment(
  assignment: Readonly<PublicTalkAssignment>,
  now: string,
): Readonly<PublicTalkAssignment> {
  return transitionState(assignment, 'cancelled', now);
}

export function completeTalkAssignment(
  assignment: Readonly<PublicTalkAssignment>,
  now: string,
): Readonly<PublicTalkAssignment> {
  return transitionState(assignment, 'completed', now);
}

// ─── Update (draft only) ────────────────────────────────────────────────────

export function updateTalkAssignment(
  assignment: Readonly<PublicTalkAssignment>,
  changes: {
    weekendMeetingId?: WeekendMeetingId;
    talkOutlineId?: TalkOutlineId;
    speakerId?: SpeakerId;
    speakerCongregationId?: CongregationId;
    date?: string;
    localTime?: string;
    timezone?: string;
    locationId?: LocationId | null;
    type?: TalkAssignmentType;
    visiting?: boolean;
  },
  now: string,
): Readonly<PublicTalkAssignment> {
  if (assignment.state !== 'draft') {
    throw new Error(`Can only update draft assignments, current state: ${assignment.state}`);
  }
  validateInstant(now);

  const date = changes.date !== undefined ? (() => { validateDateString(changes.date); return changes.date.trim(); })() : assignment.date;
  const localTime = changes.localTime !== undefined ? (() => { validateLocalTime(changes.localTime); return changes.localTime.trim(); })() : assignment.localTime;
  const timezone = changes.timezone !== undefined ? (() => { validateTimezone(changes.timezone); return changes.timezone.trim(); })() : assignment.timezone;
  const locationId = changes.locationId !== undefined ? normalizeLocationId(changes.locationId) : assignment.locationId;
  const type = changes.type !== undefined ? validateTalkAssignmentType(changes.type) : assignment.type;
  const visiting = changes.visiting !== undefined ? Boolean(changes.visiting) : assignment.visiting;

  const updated: Readonly<PublicTalkAssignment> = Object.freeze({
    ...assignment,
    weekendMeetingId: changes.weekendMeetingId !== undefined ? required(changes.weekendMeetingId, 'weekendMeetingId') : assignment.weekendMeetingId,
    talkOutlineId: changes.talkOutlineId !== undefined ? required(changes.talkOutlineId, 'talkOutlineId') : assignment.talkOutlineId,
    speakerId: changes.speakerId !== undefined ? required(changes.speakerId, 'speakerId') : assignment.speakerId,
    speakerCongregationId: changes.speakerCongregationId !== undefined ? required(changes.speakerCongregationId, 'speakerCongregationId') : assignment.speakerCongregationId,
    date,
    localTime,
    timezone,
    locationId,
    type,
    visiting,
    updatedAt: now,
  });

  validateStructuralConsistency(updated);
  return updated;
}

// ─── Tenant guard ────────────────────────────────────────────────────────────

export function assertTalkAssignmentTenant(
  assignment: Readonly<PublicTalkAssignment>,
  tenantId: TenantId,
): void {
  if (assignment.tenantId !== tenantId) {
    throw new Error('Cross-tenant talk assignment access denied');
  }
}

// ─── Query helpers ───────────────────────────────────────────────────────────

export function filterTalkAssignmentsByTenant(
  assignments: readonly Readonly<PublicTalkAssignment>[],
  tenantId: TenantId,
): readonly Readonly<PublicTalkAssignment>[] {
  return assignments.filter(a => a.tenantId === tenantId);
}

export function filterTalkAssignmentsByDateRange(
  assignments: readonly Readonly<PublicTalkAssignment>[],
  from: string,  // YYYY-MM-DD (inclusive)
  to: string,    // YYYY-MM-DD (inclusive)
): readonly Readonly<PublicTalkAssignment>[] {
  validateDateString(from);
  validateDateString(to);
  return assignments.filter(a => a.date >= from && a.date <= to);
}

export function filterTalkAssignmentsBySpeaker(
  assignments: readonly Readonly<PublicTalkAssignment>[],
  speakerId: SpeakerId,
): readonly Readonly<PublicTalkAssignment>[] {
  return assignments.filter(a => a.speakerId === speakerId);
}

export function filterTalkAssignmentsByOutline(
  assignments: readonly Readonly<PublicTalkAssignment>[],
  outlineId: TalkOutlineId,
): readonly Readonly<PublicTalkAssignment>[] {
  return assignments.filter(a => a.talkOutlineId === outlineId);
}

export function filterLocalTalks(
  assignments: readonly Readonly<PublicTalkAssignment>[],
): readonly Readonly<PublicTalkAssignment>[] {
  return assignments.filter(a => a.type === 'local');
}

export function filterAwayTalks(
  assignments: readonly Readonly<PublicTalkAssignment>[],
): readonly Readonly<PublicTalkAssignment>[] {
  return assignments.filter(a => a.type === 'away');
}

export function orderTalkAssignmentsByDate(
  assignments: readonly Readonly<PublicTalkAssignment>[],
): readonly Readonly<PublicTalkAssignment>[] {
  return [...assignments].sort((a, b) => a.date.localeCompare(b.date) || a.localTime.localeCompare(b.localTime));
}

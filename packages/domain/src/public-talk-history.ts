/**
 * K39 — Public Talk History
 *
 * Immutable, append-only history of public talk assignments.
 * This records OBJECTIVE history — no scoring, no ranking, no favorites.
 *
 * Rules:
 *   - Append-only: no update, no delete functions are exported.
 *   - All objects frozen (deeply immutable).
 *   - Tenant isolation enforced on every operation.
 *   - Published history cannot be silently rewritten.
 */
import type { TenantId } from './people';

// ─── Reference ID types (foreign keys — no embedded entities) ─────────────────
export type TalkOutlineId = string;
export type SpeakerId = string;
export type CongregationId = string;
export type WeekendMeetingId = string;

// ─── ID types ────────────────────────────────────────────────────────────────
export type PublicTalkHistoryId = string;

// ─── Value types ─────────────────────────────────────────────────────────────
export type PublicTalkHistoryType = 'local' | 'away';
export type PublicTalkHistoryState = 'completed' | 'cancelled';

export const PUBLIC_TALK_HISTORY_TYPES: readonly PublicTalkHistoryType[] =
  Object.freeze(['local', 'away'] as const);

export const PUBLIC_TALK_HISTORY_STATES: readonly PublicTalkHistoryState[] =
  Object.freeze(['completed', 'cancelled'] as const);

// ─── Record type ─────────────────────────────────────────────────────────────
export interface PublicTalkHistoryRecord {
  readonly id: PublicTalkHistoryId;
  readonly tenantId: TenantId;
  readonly speakerId: SpeakerId;
  readonly talkOutlineId: TalkOutlineId;
  readonly congregationId: CongregationId;
  readonly date: string;               // YYYY-MM-DD
  readonly type: PublicTalkHistoryType;
  readonly state: PublicTalkHistoryState;
  readonly recordedAt: string;          // ISO 8601 — immutable
  readonly weekendMeetingId: WeekendMeetingId;
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
  if (
    d.getUTCFullYear() !== parseInt(dateParts[0], 10) ||
    d.getUTCMonth() + 1 !== parseInt(dateParts[1], 10) ||
    d.getUTCDate() !== parseInt(dateParts[2], 10)
  ) {
    throw new Error(`Invalid date: ${value}`);
  }
}

function validateType(value: string): PublicTalkHistoryType {
  if (!PUBLIC_TALK_HISTORY_TYPES.includes(value as PublicTalkHistoryType)) {
    throw new Error(`Invalid type: ${value}. Must be 'local' or 'away'`);
  }
  return value as PublicTalkHistoryType;
}

function validateState(value: string): PublicTalkHistoryState {
  if (!PUBLIC_TALK_HISTORY_STATES.includes(value as PublicTalkHistoryState)) {
    throw new Error(`Invalid state: ${value}. Must be 'completed' or 'cancelled'`);
  }
  return value as PublicTalkHistoryState;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a frozen, immutable public talk history record.
 * This is append-only: once created, the record is eternally fixed.
 */
export function recordPublicTalkHistory(input: {
  id: PublicTalkHistoryId;
  tenantId: TenantId;
  speakerId: SpeakerId;
  talkOutlineId: TalkOutlineId;
  congregationId: CongregationId;
  date: string;                   // YYYY-MM-DD
  type: PublicTalkHistoryType;
  state: PublicTalkHistoryState;
  recordedAt: string;             // ISO 8601
  weekendMeetingId: WeekendMeetingId;
}): Readonly<PublicTalkHistoryRecord> {
  validateInstant(input.recordedAt);
  validateDateString(input.date);

  const type = validateType(input.type);
  const state = validateState(input.state);

  return Object.freeze({
    id: required(input.id, 'id'),
    tenantId: required(input.tenantId, 'tenantId'),
    speakerId: required(input.speakerId, 'speakerId'),
    talkOutlineId: required(input.talkOutlineId, 'talkOutlineId'),
    congregationId: required(input.congregationId, 'congregationId'),
    date: input.date.trim(),
    type,
    state,
    recordedAt: input.recordedAt,
    weekendMeetingId: required(input.weekendMeetingId, 'weekendMeetingId'),
  });
}

// ─── Normalize / import ──────────────────────────────────────────────────────

/**
 * Validate and normalize an existing record (e.g. from import or deserialization).
 * Returns a frozen copy. Throws on invalid data.
 */
export function normalizePublicTalkHistoryRecord(
  input: PublicTalkHistoryRecord,
): Readonly<PublicTalkHistoryRecord> {
  validateInstant(input.recordedAt);
  validateDateString(input.date);
  const type = validateType(input.type);
  const state = validateState(input.state);

  return Object.freeze({
    id: required(input.id, 'id'),
    tenantId: required(input.tenantId, 'tenantId'),
    speakerId: required(input.speakerId, 'speakerId'),
    talkOutlineId: required(input.talkOutlineId, 'talkOutlineId'),
    congregationId: required(input.congregationId, 'congregationId'),
    date: input.date.trim(),
    type,
    state,
    recordedAt: input.recordedAt,
    weekendMeetingId: required(input.weekendMeetingId, 'weekendMeetingId'),
  });
}

// ─── Tenant guard ────────────────────────────────────────────────────────────

/**
 * Assert that a record belongs to the given tenant.
 * Throws on cross-tenant access.
 */
export function assertPublicTalkHistoryTenant(
  record: Readonly<PublicTalkHistoryRecord>,
  tenantId: TenantId,
): void {
  if (record.tenantId !== tenantId) {
    throw new Error('Cross-tenant public talk history access denied');
  }
}

// ─── Query helpers ───────────────────────────────────────────────────────────

/** Filter records by tenant. */
export function filterPublicTalkHistoryByTenant(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  tenantId: TenantId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return records.filter(r => r.tenantId === tenantId);
}

/** Filter records by speaker. */
export function filterPublicTalkHistoryBySpeaker(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  speakerId: SpeakerId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return records.filter(r => r.speakerId === speakerId);
}

/** Filter records by talk outline. */
export function filterPublicTalkHistoryByOutline(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  outlineId: TalkOutlineId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return records.filter(r => r.talkOutlineId === outlineId);
}

/** Filter records by congregation. */
export function filterPublicTalkHistoryByCongregation(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  congregationId: CongregationId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return records.filter(r => r.congregationId === congregationId);
}

/** Filter records by date range (inclusive on both bounds). */
export function filterPublicTalkHistoryByDateRange(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  from: string,   // YYYY-MM-DD (inclusive)
  to: string,     // YYYY-MM-DD (inclusive)
): readonly Readonly<PublicTalkHistoryRecord>[] {
  validateDateString(from);
  validateDateString(to);
  return records.filter(r => r.date >= from && r.date <= to);
}

/** Most recent date for a given outline (null if never used). */
export function lastUseOfOutline(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  outlineId: TalkOutlineId,
): string | null {
  const matching = records.filter(r => r.talkOutlineId === outlineId);
  if (matching.length === 0) return null;
  return matching.reduce((latest, r) => (r.date > latest ? r.date : latest), matching[0].date);
}

/** Most recent date for a given speaker (null if never used). */
export function lastUseOfSpeaker(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  speakerId: SpeakerId,
): string | null {
  const matching = records.filter(r => r.speakerId === speakerId);
  if (matching.length === 0) return null;
  return matching.reduce((latest, r) => (r.date > latest ? r.date : latest), matching[0].date);
}

/** All history records for a given outline. */
export function historyOfOutline(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  outlineId: TalkOutlineId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return records.filter(r => r.talkOutlineId === outlineId);
}

/** All history records for a given speaker. */
export function historyOfSpeaker(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  speakerId: SpeakerId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return records.filter(r => r.speakerId === speakerId);
}

/** Past speaker+outline combinations. */
export function previousCombinations(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  speakerId: SpeakerId,
  outlineId: TalkOutlineId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return records.filter(r => r.speakerId === speakerId && r.talkOutlineId === outlineId);
}

/** Sort records by date ascending, then by id for stable tie-breaking. */
export function orderPublicTalkHistoryByDate(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return [...records].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Count talks for an outline, optionally within a date range. */
export function countTalksByOutline(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  outlineId: TalkOutlineId,
  from?: string,   // YYYY-MM-DD (inclusive)
  to?: string,     // YYYY-MM-DD (inclusive)
): number {
  if (from !== undefined) validateDateString(from);
  if (to !== undefined) validateDateString(to);
  return records.filter(r => {
    if (r.talkOutlineId !== outlineId) return false;
    if (from !== undefined && r.date < from) return false;
    if (to !== undefined && r.date > to) return false;
    return true;
  }).length;
}

/** Count talks for a speaker, optionally within a date range. */
export function countTalksBySpeaker(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  speakerId: SpeakerId,
  from?: string,   // YYYY-MM-DD (inclusive)
  to?: string,     // YYYY-MM-DD (inclusive)
): number {
  if (from !== undefined) validateDateString(from);
  if (to !== undefined) validateDateString(to);
  return records.filter(r => {
    if (r.speakerId !== speakerId) return false;
    if (from !== undefined && r.date < from) return false;
    if (to !== undefined && r.date > to) return false;
    return true;
  }).length;
}

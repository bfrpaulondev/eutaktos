import type { TenantId, PersonId } from './people';

export type AssignmentHistoryRecordId = string;
export type AssignmentId = string;
export type AssignmentMeetingId = string;
export type PartType = string;

export type AssignmentHistoryState = 'assigned' | 'completed' | 'cancelled';

export interface AssignmentHistoryRecord {
  readonly id: AssignmentHistoryRecordId;
  readonly tenantId: TenantId;
  readonly assignmentId: AssignmentId;
  readonly personId: PersonId;
  readonly partType: PartType;
  readonly meetingDate: string; // YYYY-MM-DD
  readonly state: AssignmentHistoryState;
  readonly recordedAt: string; // ISO 8601
  readonly meetingId: AssignmentMeetingId;
}

export interface RecordAssignmentHistoryInput {
  id: AssignmentHistoryRecordId;
  tenantId: TenantId;
  assignmentId: AssignmentId;
  personId: PersonId;
  partType: PartType;
  meetingDate: string;
  state: AssignmentHistoryState;
  recordedAt: string;
  meetingId: AssignmentMeetingId;
}

const VALID_STATES: readonly string[] = ['assigned', 'completed', 'cancelled'] as const;

const YYYY_MM_DD_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function validateMeetingDate(value: string): void {
  if (typeof value !== 'string') throw new Error('meetingDate must be a string');
  const trimmed = value.trim();
  if (!YYYY_MM_DD_RE.test(trimmed)) throw new Error(`meetingDate must be YYYY-MM-DD: ${value}`);
  // Validate it represents a real calendar date (not rolled over by JS)
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  // Use UTC date to avoid timezone issues
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid meetingDate: ${value}`);
  }
}

function validateState(value: string): asserts value is AssignmentHistoryState {
  if (typeof value !== 'string' || !VALID_STATES.includes(value)) {
    throw new Error(`Invalid state: ${String(value)}`);
  }
}

/**
 * Create a new assignment history record. The returned object is deeply frozen
 * and immutable — this is an append-only model with no update or delete.
 */
export function recordAssignmentHistory(input: RecordAssignmentHistoryInput): Readonly<AssignmentHistoryRecord> {
  const id = required(input.id, 'historyRecordId');
  const tenantId = required(input.tenantId, 'tenantId');
  const assignmentId = required(input.assignmentId, 'assignmentId');
  const personId = required(input.personId, 'personId');
  const partType = required(input.partType, 'partType');
  const meetingDate = required(input.meetingDate, 'meetingDate');
  const meetingId = required(input.meetingId, 'meetingId');

  validateMeetingDate(meetingDate);
  validateInstant(input.recordedAt);
  validateState(input.state);

  return Object.freeze({
    id,
    tenantId,
    assignmentId,
    personId,
    partType,
    meetingDate,
    state: input.state,
    recordedAt: input.recordedAt,
    meetingId,
  });
}

/**
 * Validate and freeze an imported/existing assignment history record.
 * Used when loading records from an external source or persistence layer.
 */
export function normalizeAssignmentHistoryRecord(
  input: AssignmentHistoryRecord,
): Readonly<AssignmentHistoryRecord> {
  const id = required(input.id, 'historyRecordId');
  const tenantId = required(input.tenantId, 'tenantId');
  const assignmentId = required(input.assignmentId, 'assignmentId');
  const personId = required(input.personId, 'personId');
  const partType = required(input.partType, 'partType');
  const meetingDate = required(input.meetingDate, 'meetingDate');
  const meetingId = required(input.meetingId, 'meetingId');

  validateMeetingDate(meetingDate);
  validateInstant(input.recordedAt);
  validateState(input.state);

  return Object.freeze({
    id,
    tenantId,
    assignmentId,
    personId,
    partType,
    meetingDate,
    state: input.state,
    recordedAt: input.recordedAt,
    meetingId,
  });
}

/** Guard: throws if the record does not belong to the given tenant. */
export function assertHistoryTenant(record: Readonly<AssignmentHistoryRecord>, tenantId: TenantId): void {
  if (record.tenantId !== tenantId) throw new Error('Cross-tenant assignment history access denied');
}

/** Query: filter history records by tenant. */
export function filterHistoryByTenant(
  records: readonly Readonly<AssignmentHistoryRecord>[],
  tenantId: TenantId,
): readonly Readonly<AssignmentHistoryRecord>[] {
  return records.filter(r => r.tenantId === tenantId);
}

/** Query: filter history records by person. */
export function filterHistoryByPerson(
  records: readonly Readonly<AssignmentHistoryRecord>[],
  personId: PersonId,
): readonly Readonly<AssignmentHistoryRecord>[] {
  return records.filter(r => r.personId === personId);
}

/** Query: filter history records by meeting. */
export function filterHistoryByMeeting(
  records: readonly Readonly<AssignmentHistoryRecord>[],
  meetingId: AssignmentMeetingId,
): readonly Readonly<AssignmentHistoryRecord>[] {
  return records.filter(r => r.meetingId === meetingId);
}

/** Query: filter history records by date range (inclusive, YYYY-MM-DD). */
export function filterHistoryByDateRange(
  records: readonly Readonly<AssignmentHistoryRecord>[],
  from: string,
  to: string,
): readonly Readonly<AssignmentHistoryRecord>[] {
  validateMeetingDate(from);
  validateMeetingDate(to);
  if (from > to) throw new Error('from date must not be after to date');
  return records.filter(r => r.meetingDate >= from && r.meetingDate <= to);
}

/** Query: filter history records by part type. */
export function filterHistoryByPartType(
  records: readonly Readonly<AssignmentHistoryRecord>[],
  partType: PartType,
): readonly Readonly<AssignmentHistoryRecord>[] {
  return records.filter(r => r.partType === partType);
}

/** Query: filter history records by state. */
export function filterHistoryByState(
  records: readonly Readonly<AssignmentHistoryRecord>[],
  state: AssignmentHistoryState,
): readonly Readonly<AssignmentHistoryRecord>[] {
  return records.filter(r => r.state === state);
}

/** Sort: order history ascending by meetingDate, then recordedAt, then id. */
export function orderHistoryByDate(
  records: readonly Readonly<AssignmentHistoryRecord>[],
): readonly Readonly<AssignmentHistoryRecord>[] {
  return [...records].sort((a, b) => {
    const dateCmp = a.meetingDate.localeCompare(b.meetingDate);
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
    if (timeCmp !== 0) return timeCmp;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Count how many assignment records a person has in a given date range.
 */
export function countAssignmentsInPeriod(
  records: readonly Readonly<AssignmentHistoryRecord>[],
  personId: PersonId,
  from: string,
  to: string,
): number {
  return filterHistoryByDateRange(
    filterHistoryByPerson(records, personId),
    from,
    to,
  ).length;
}

/**
 * Find the most recent meeting date for a person, optionally before a given date.
 */
export function lastAssignmentDate(
  records: readonly Readonly<AssignmentHistoryRecord>[],
  personId: PersonId,
  beforeDate?: string,
): string | null {
  let filtered = filterHistoryByPerson(records, personId);
  if (beforeDate !== undefined) {
    validateMeetingDate(beforeDate);
    filtered = filtered.filter(r => r.meetingDate < beforeDate);
  }
  if (filtered.length === 0) return null;
  const ordered = orderHistoryByDate(filtered);
  return ordered[ordered.length - 1].meetingDate;
}

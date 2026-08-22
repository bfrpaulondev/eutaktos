import type { AssignmentHistoryRecord } from './assignment-history';
export type { AssignmentHistoryRecord } from './assignment-history';

/**
 * K27 — Student History and Recency Queries
 *
 * Pure, deterministic consultation-only queries over the real K26 assignment
 * history record. They never score, rank, recommend or infer suitability.
 */

const YYYY_MM_DD_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateMeetingDate(value: string): void {
  if (typeof value !== 'string') throw new Error('Date must be a string');
  const trimmed = value.trim();
  if (!YYYY_MM_DD_RE.test(trimmed)) throw new Error(`Date must be YYYY-MM-DD: ${value}`);
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid date: ${value}`);
  }
}

function daysBetween(earlier: string, later: string): number {
  const parse = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.floor((parse(later) - parse(earlier)) / 86_400_000);
}

export function lastAssignment(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): AssignmentHistoryRecord | undefined {
  let best: AssignmentHistoryRecord | undefined;
  for (const record of history) {
    if (record.personId !== personId || record.tenantId !== tenantId || record.state !== 'completed') continue;
    if (
      best === undefined ||
      record.meetingDate > best.meetingDate ||
      (record.meetingDate === best.meetingDate && record.recordedAt > best.recordedAt) ||
      (record.meetingDate === best.meetingDate && record.recordedAt === best.recordedAt && record.id > best.id)
    ) best = record;
  }
  return best;
}

export function lastAssignmentDate(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): string | undefined {
  return lastAssignment(history, personId, tenantId)?.meetingDate;
}

export interface AssignmentCountOptions {
  readonly from?: string;
  readonly to?: string;
  readonly partType?: string;
}

export function assignmentCount(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
  options?: AssignmentCountOptions,
): number {
  let from: string | undefined;
  let to: string | undefined;
  if (options?.from !== undefined) { validateMeetingDate(options.from); from = options.from; }
  if (options?.to !== undefined) { validateMeetingDate(options.to); to = options.to; }
  if (from !== undefined && to !== undefined && from > to) throw new Error('from date must not be after to date');

  return history.filter(record =>
    record.personId === personId &&
    record.tenantId === tenantId &&
    record.state === 'completed' &&
    (from === undefined || record.meetingDate >= from) &&
    (to === undefined || record.meetingDate <= to) &&
    (options?.partType === undefined || record.partType === options.partType)
  ).length;
}

export function assignmentCountByPartType(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of history) {
    if (record.personId !== personId || record.tenantId !== tenantId || record.state !== 'completed') continue;
    counts.set(record.partType, (counts.get(record.partType) ?? 0) + 1);
  }
  return counts;
}

export function historyByPerson(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): readonly AssignmentHistoryRecord[] {
  return history
    .filter(record => record.personId === personId && record.tenantId === tenantId)
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate) || b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));
}

export function historyByPartType(
  history: readonly AssignmentHistoryRecord[],
  partType: string,
  tenantId: string,
): readonly AssignmentHistoryRecord[] {
  return history
    .filter(record => record.partType === partType && record.tenantId === tenantId)
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate) || b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));
}

export function daysSinceLastAssignment(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
  referenceDate: string,
): number | null {
  validateMeetingDate(referenceDate);
  const last = lastAssignmentDate(history, personId, tenantId);
  if (last === undefined) return null;
  return daysBetween(last, referenceDate);
}

export function personsAssignedInDateRange(
  history: readonly AssignmentHistoryRecord[],
  personIds: readonly string[],
  tenantId: string,
  from: string,
  to: string,
): ReadonlySet<string> {
  validateMeetingDate(from);
  validateMeetingDate(to);
  if (from > to) throw new Error('from date must not be after to date');
  const candidates = new Set(personIds);
  const result = new Set<string>();
  for (const record of history) {
    if (record.tenantId === tenantId && record.state === 'completed' && candidates.has(record.personId) && record.meetingDate >= from && record.meetingDate <= to) {
      result.add(record.personId);
    }
  }
  return result;
}

export function uniquePartTypesForPerson(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): ReadonlySet<string> {
  const result = new Set<string>();
  for (const record of history) {
    if (record.personId === personId && record.tenantId === tenantId) result.add(record.partType);
  }
  return result;
}

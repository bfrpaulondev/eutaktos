/**
 * K27 — Student History and Recency Queries
 *
 * Pure, deterministic query functions over assignment history records.
 * These are CONSULTATION ONLY — they never score, rank, recommend, or infer
 * spiritual suitability. They only compute factual history metrics.
 */

// ── Local interface (K26 not yet merged to main) ─────────────────────────

export interface AssignmentHistoryRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly assignmentId: string;
  readonly personId: string;
  readonly partType: string;
  readonly meetingDate: string; // YYYY-MM-DD
  readonly state: 'assigned' | 'completed' | 'cancelled';
  readonly recordedAt: string;
  readonly meetingId: string;
}

// ── Date validation ──────────────────────────────────────────────────────

const YYYY_MM_DD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a YYYY-MM-DD date string.
 * Uses UTC to avoid timezone rollover issues.
 */
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

/**
 * Compute the number of calendar days between two YYYY-MM-DD strings.
 * Returns a non-negative integer (or null if never assigned — handled by caller).
 * Uses lexicographic comparison internally where possible.
 */
function daysBetween(earlier: string, later: string): number {
  const parse = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  const msPerDay = 86_400_000;
  return Math.floor((parse(later) - parse(earlier)) / msPerDay);
}

// ── Query Functions ──────────────────────────────────────────────────────

/**
 * lastAssignment — last assignment record for a person (or undefined).
 * Returns the record with the greatest meetingDate (lexicographic).
 * Ties broken by recordedAt (ISO parse), then id.
 * Only considers records matching the given tenantId.
 */
export function lastAssignment(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): AssignmentHistoryRecord | undefined {
  let best: AssignmentHistoryRecord | undefined;
  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (r.personId !== personId || r.tenantId !== tenantId) continue;
    if (
      best === undefined ||
      r.meetingDate > best.meetingDate ||
      (r.meetingDate === best.meetingDate && r.recordedAt > best.recordedAt) ||
      (r.meetingDate === best.meetingDate && r.recordedAt === best.recordedAt && r.id > best.id)
    ) {
      best = r;
    }
  }
  return best;
}

/**
 * lastAssignmentDate — the meeting date of the last assignment for a person (or undefined).
 * Only considers records matching the given tenantId.
 */
export function lastAssignmentDate(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): string | undefined {
  const record = lastAssignment(history, personId, tenantId);
  return record?.meetingDate;
}

export interface AssignmentCountOptions {
  readonly from?: string; // YYYY-MM-DD inclusive
  readonly to?: string; // YYYY-MM-DD inclusive
  readonly partType?: string;
}

/**
 * assignmentCount — count of assignments for a person.
 * Optional date range (inclusive) and partType filter.
 * Only considers records matching the given tenantId.
 */
export function assignmentCount(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
  options?: AssignmentCountOptions,
): number {
  let from: string | undefined;
  let to: string | undefined;
  if (options?.from !== undefined) {
    validateMeetingDate(options.from);
    from = options.from;
  }
  if (options?.to !== undefined) {
    validateMeetingDate(options.to);
    to = options.to;
  }
  if (from !== undefined && to !== undefined && from > to) {
    throw new Error('from date must not be after to date');
  }

  const partType = options?.partType;
  let count = 0;
  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (r.personId !== personId || r.tenantId !== tenantId) continue;
    if (from !== undefined && r.meetingDate < from) continue;
    if (to !== undefined && r.meetingDate > to) continue;
    if (partType !== undefined && r.partType !== partType) continue;
    count++;
  }
  return count;
}

/**
 * assignmentCountByPartType — Map<partType, count> for all part types a person has.
 * Only considers records matching the given tenantId.
 */
export function assignmentCountByPartType(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (r.personId !== personId || r.tenantId !== tenantId) continue;
    counts.set(r.partType, (counts.get(r.partType) ?? 0) + 1);
  }
  return counts;
}

/**
 * historyByPerson — all records for a person, ordered by meetingDate desc.
 * Only considers records matching the given tenantId.
 * Does not mutate input.
 */
export function historyByPerson(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): readonly AssignmentHistoryRecord[] {
  const filtered: AssignmentHistoryRecord[] = [];
  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (r.personId === personId && r.tenantId === tenantId) {
      filtered.push(r);
    }
  }
  return filtered.sort((a, b) => {
    const dateCmp = b.meetingDate.localeCompare(a.meetingDate);
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = b.recordedAt.localeCompare(a.recordedAt);
    if (timeCmp !== 0) return timeCmp;
    return b.id.localeCompare(a.id);
  });
}

/**
 * historyByPartType — all records for a part type, ordered by meetingDate desc.
 * Only considers records matching the given tenantId.
 * Does not mutate input.
 */
export function historyByPartType(
  history: readonly AssignmentHistoryRecord[],
  partType: string,
  tenantId: string,
): readonly AssignmentHistoryRecord[] {
  const filtered: AssignmentHistoryRecord[] = [];
  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (r.partType === partType && r.tenantId === tenantId) {
      filtered.push(r);
    }
  }
  return filtered.sort((a, b) => {
    const dateCmp = b.meetingDate.localeCompare(a.meetingDate);
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = b.recordedAt.localeCompare(a.recordedAt);
    if (timeCmp !== 0) return timeCmp;
    return b.id.localeCompare(a.id);
  });
}

/**
 * daysSinceLastAssignment — number of days since the person's last assignment
 * relative to a reference date. Returns null if the person has never been assigned.
 * Both meetingDate and referenceDate are YYYY-MM-DD strings.
 * Only considers records matching the given tenantId.
 */
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

/**
 * personsAssignedInDateRange — set of personIds who have at least one
 * assignment in the given inclusive date range.
 * Only considers records matching the given tenantId.
 * Filters the provided personIds list to those who appear in the history.
 */
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

  // Build a Set of candidate personIds for O(1) lookup
  const candidateSet = new Set(personIds);
  const result = new Set<string>();

  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (r.tenantId !== tenantId) continue;
    if (!candidateSet.has(r.personId)) continue;
    if (r.meetingDate < from || r.meetingDate > to) continue;
    result.add(r.personId);
  }

  return result;
}

/**
 * uniquePartTypesForPerson — set of distinct part types a person has been assigned.
 * Only considers records matching the given tenantId.
 */
export function uniquePartTypesForPerson(
  history: readonly AssignmentHistoryRecord[],
  personId: string,
  tenantId: string,
): ReadonlySet<string> {
  const types = new Set<string>();
  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (r.personId === personId && r.tenantId === tenantId) {
      types.add(r.partType);
    }
  }
  return types;
}

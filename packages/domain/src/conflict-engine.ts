/**
 * K28 — Scheduling Conflict Engine Core
 *
 * Pure, deterministic conflict detection for scheduling assignments.
 * No side effects, no I/O, no random. Same inputs → same outputs always.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SchedulingAssignment {
  readonly id: string;
  readonly tenantId: string;
  readonly meetingId: string;
  readonly slotId: string;
  readonly personId: string;
  readonly meetingDate: string; // YYYY-MM-DD
  readonly startTime: string;  // HH:mm
  readonly endTime: string;    // HH:mm
  readonly classId?: string;
}

export type ConflictType =
  | 'same-person-incompatible-slots'
  | 'same-person-time-overlap'
  | 'same-person-simultaneous-classes'
  | 'duplicate-assignment'
  | 'person-unavailable';

export interface Conflict {
  readonly type: ConflictType;
  readonly assignmentIds: readonly string[];
  readonly personId: string;
  readonly description: string;
}

export interface UnavailablePeriod {
  readonly personId: string;
  readonly startsAt: string; // ISO 8601 instant
  readonly endsAt: string;   // ISO 8601 instant
}

export interface ConflictDetectionOptions {
  readonly exclusiveSlotPairs?: readonly (readonly [string, string])[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse "HH:mm" to minutes since midnight. Returns NaN on invalid input. */
function parseHhMm(time: string): number {
  if (typeof time !== 'string' || time.length === 0) return NaN;
  const parts = time.split(':');
  if (parts.length < 1 || parts.length > 2) return NaN;
  const h = Number(parts[0]!);
  const m = parts.length === 2 ? Number(parts[1]!) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

/** Check if two time ranges [s1,e1) and [s2,e2) overlap. Half-open intervals. */
function timesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  if (!Number.isFinite(s1) || !Number.isFinite(e1) || !Number.isFinite(s2) || !Number.isFinite(e2)) return false;
  if (e1 <= s1 || e2 <= s2) return false; // invalid ranges
  return s1 < e2 && s2 < e1;
}

/** Parse YYYY-MM-DD to a Date at midnight UTC. Returns NaN-time on failure. */
function parseDate(dateStr: string): number {
  if (typeof dateStr !== 'string' || dateStr.length !== 10) return NaN;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return NaN;
  const y = Number(parts[0]!);
  const mo = Number(parts[1]!) - 1;
  const d = Number(parts[2]!);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN;
  const dt = new Date(Date.UTC(y, mo, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return NaN;
  return dt.getTime();
}

/** Convert a meeting date + HH:mm to an ISO 8601 instant string (UTC). */
function meetingDateTimeToInstant(meetingDate: string, time: string): string | null {
  const dateMs = parseDate(meetingDate);
  const mins = parseHhMm(time);
  if (!Number.isFinite(dateMs) || !Number.isFinite(mins)) return null;
  return new Date(dateMs + mins * 60_000).toISOString();
}

// ─── Core Engine ─────────────────────────────────────────────────────────────

/**
 * Detect all scheduling conflicts in a set of assignments.
 *
 * PURE: no side effects, no I/O, no random. Same inputs → same outputs.
 */
export function detectConflicts(
  assignments: readonly SchedulingAssignment[],
  unavailablePeriods: readonly UnavailablePeriod[] = [],
  options: ConflictDetectionOptions = {},
): readonly Conflict[] {
  const conflicts: Conflict[] = [];
  const exclusivePairs: ReadonlySet<string> = buildExclusiveSet(options.exclusiveSlotPairs);

  // Build index: tenantId -> meetingId -> meetingDate -> personId -> SchedulingAssignment[]
  const index = buildAssignmentIndex(assignments);

  for (const meetings of index.values()) {
    for (const dates of meetings.values()) {
      for (const [meetingDate, personMap] of dates) {
        for (const [personId, personAssignments] of personMap) {
          // Get meetingId from the first assignment in the group
          const meetingId = personAssignments[0]?.meetingId ?? '';

          // 1. Duplicate detection
          detectDuplicates(personAssignments, personId, conflicts);

          // 2. Incompatible slot detection
          detectIncompatibleSlots(personAssignments, personId, exclusivePairs, meetingId, conflicts);

          // 3. Time overlap detection
          detectTimeOverlaps(personAssignments, personId, meetingId, meetingDate, conflicts);

          // 4. Simultaneous class detection
          detectSimultaneousClasses(personAssignments, personId, meetingId, meetingDate, conflicts);

          // 5. Person unavailability detection
          detectUnavailability(personAssignments, personId, unavailablePeriods, meetingDate, conflicts);
        }
      }
    }
  }

  return Object.freeze(conflicts);
}

/**
 * Check if adding a hypothetical assignment would cause a conflict.
 *
 * PURE: constructs a temporary assignment and runs detectConflicts.
 */
export function hasConflict(
  existingAssignments: readonly SchedulingAssignment[],
  personId: string,
  meetingId: string,
  meetingDate: string,
  startTime: string,
  endTime: string,
  slotId?: string,
  classId?: string,
  options?: ConflictDetectionOptions,
  unavailablePeriods?: readonly UnavailablePeriod[],
): boolean {
  // Determine tenantId from existing assignments for the same person+meeting
  const tenantMatch = existingAssignments.find(
    (a) => a.personId === personId && a.meetingId === meetingId && a.meetingDate === meetingDate,
  );
  const tenantId = tenantMatch?.tenantId ?? '_check';

  const hypothetical: SchedulingAssignment = Object.freeze({
    id: '__hypothetical__',
    tenantId,
    meetingId,
    meetingDate,
    slotId: slotId ?? '__check-slot__',
    personId,
    startTime,
    endTime,
    classId,
  });

  const all = [...existingAssignments, hypothetical];
  const conflicts = detectConflicts(all, unavailablePeriods ?? [], options);
  return conflicts.some((c) => c.assignmentIds.includes('__hypothetical__'));
}

// ─── Detection sub-routines ──────────────────────────────────────────────────

function buildExclusiveSet(
  pairs: readonly (readonly [string, string])[] | undefined,
): ReadonlySet<string> {
  const set = new Set<string>();
  if (!pairs) return set;
  for (const [a, b] of pairs) {
    if (a && b) {
      set.add(`${a}<->${b}`);
      set.add(`${b}<->${a}`);
    }
  }
  return set;
}

type AssignmentIndex = Map<string, Map<string, Map<string, Map<string, SchedulingAssignment[]>>>>;

function buildAssignmentIndex(
  assignments: readonly SchedulingAssignment[],
): AssignmentIndex {
  const index: AssignmentIndex = new Map();
  for (const a of assignments) {
    if (!a || typeof a.tenantId !== 'string' || typeof a.meetingId !== 'string') continue;
    let meetings = index.get(a.tenantId);
    if (!meetings) { meetings = new Map(); index.set(a.tenantId, meetings); }
    let dates = meetings.get(a.meetingId);
    if (!dates) { dates = new Map(); meetings.set(a.meetingId, dates); }
    let personMap = dates.get(a.meetingDate);
    if (!personMap) { personMap = new Map(); dates.set(a.meetingDate, personMap); }
    let list = personMap.get(a.personId);
    if (!list) { list = []; personMap.set(a.personId, list); }
    list.push(a);
  }
  return index;
}

function detectDuplicates(
  asgns: SchedulingAssignment[],
  personId: string,
  conflicts: Conflict[],
): void {
  // Same person + same slot + same meeting = duplicate
  const seen = new Map<string, SchedulingAssignment[]>();
  for (const a of asgns) {
    const key = `${a.meetingId}|${a.slotId}`;
    let group = seen.get(key);
    if (!group) { group = []; seen.set(key, group); }
    group.push(a);
  }
  for (const [, group] of seen) {
    if (group.length > 1) {
      conflicts.push(
        Object.freeze({
          type: 'duplicate-assignment',
          assignmentIds: group.map((a) => a.id),
          personId,
          description: `Person ${personId} has duplicate assignments in meeting ${group[0]!.meetingId}, slot ${group[0]!.slotId}`,
        }),
      );
    }
  }
}

function detectIncompatibleSlots(
  asgns: SchedulingAssignment[],
  personId: string,
  exclusivePairs: ReadonlySet<string>,
  meetingId: string,
  conflicts: Conflict[],
): void {
  if (exclusivePairs.size === 0) return;
  for (let i = 0; i < asgns.length; i++) {
    for (let j = i + 1; j < asgns.length; j++) {
      const a = asgns[i]!;
      const b = asgns[j]!;
      if (a.slotId === b.slotId) continue;
      if (exclusivePairs.has(`${a.slotId}<->${b.slotId}`)) {
        conflicts.push(
          Object.freeze({
            type: 'same-person-incompatible-slots',
            assignmentIds: [a.id, b.id],
            personId,
            description: `Person ${personId} is assigned to incompatible slots ${a.slotId} and ${b.slotId} in meeting ${meetingId}`,
          }),
        );
      }
    }
  }
}

function detectTimeOverlaps(
  asgns: SchedulingAssignment[],
  personId: string,
  meetingId: string,
  meetingDate: string,
  conflicts: Conflict[],
): void {
  for (let i = 0; i < asgns.length; i++) {
    for (let j = i + 1; j < asgns.length; j++) {
      const a = asgns[i]!;
      const b = asgns[j]!;
      // Skip if same slot (that's a duplicate, not a time overlap)
      if (a.slotId === b.slotId) continue;
      const s1 = parseHhMm(a.startTime);
      const e1 = parseHhMm(a.endTime);
      const s2 = parseHhMm(b.startTime);
      const e2 = parseHhMm(b.endTime);
      if (timesOverlap(s1, e1, s2, e2)) {
        conflicts.push(
          Object.freeze({
            type: 'same-person-time-overlap',
            assignmentIds: [a.id, b.id],
            personId,
            description: `Person ${personId} has overlapping time ranges ${a.startTime}-${a.endTime} and ${b.startTime}-${b.endTime} in meeting ${meetingId} on ${meetingDate}`,
          }),
        );
      }
    }
  }
}

function detectSimultaneousClasses(
  asgns: SchedulingAssignment[],
  personId: string,
  meetingId: string,
  meetingDate: string,
  conflicts: Conflict[],
): void {
  const classAssignments = asgns.filter((a) => a.classId);
  if (classAssignments.length < 2) return;

  const seen = new Map<string, SchedulingAssignment[]>();
  for (const a of classAssignments) {
    const cid = a.classId!;
    let group = seen.get(cid);
    if (!group) { group = []; seen.set(cid, group); }
    group.push(a);
  }

  // Report each pair of different classes at the same meeting
  const classIds = [...seen.keys()];
  for (let i = 0; i < classIds.length; i++) {
    for (let j = i + 1; j < classIds.length; j++) {
      const groupA = seen.get(classIds[i]!)!;
      const groupB = seen.get(classIds[j]!)!;
      const allIds = [...groupA.map((a) => a.id), ...groupB.map((a) => a.id)];
      conflicts.push(
        Object.freeze({
          type: 'same-person-simultaneous-classes',
          assignmentIds: allIds,
          personId,
          description: `Person ${personId} is assigned to multiple classes (${classIds[i]} and ${classIds[j]}) in meeting ${meetingId} on ${meetingDate}`,
        }),
      );
    }
  }
}

function detectUnavailability(
  asgns: SchedulingAssignment[],
  personId: string,
  unavailablePeriods: readonly UnavailablePeriod[],
  meetingDate: string,
  conflicts: Conflict[],
): void {
  const personUnavail = unavailablePeriods.filter((u) => u.personId === personId);
  if (personUnavail.length === 0) return;

  for (const a of asgns) {
    const startInstant = meetingDateTimeToInstant(meetingDate, a.startTime);
    const endInstant = meetingDateTimeToInstant(meetingDate, a.endTime);
    if (!startInstant || !endInstant) continue;

    for (const u of personUnavail) {
      const meetingStart = Date.parse(startInstant);
      const meetingEnd = Date.parse(endInstant);
      const unavailStart = Date.parse(u.startsAt);
      const unavailEnd = Date.parse(u.endsAt);
      if (!Number.isFinite(meetingStart) || !Number.isFinite(meetingEnd)) continue;
      if (!Number.isFinite(unavailStart) || !Number.isFinite(unavailEnd)) continue;

      // Overlap: meeting starts before unavail ends AND meeting ends after unavail starts
      if (meetingStart < unavailEnd && meetingEnd > unavailStart) {
        conflicts.push(
          Object.freeze({
            type: 'person-unavailable',
            assignmentIds: [a.id],
            personId,
            description: `Person ${personId} is unavailable during assignment ${a.id} on ${meetingDate} (${a.startTime}-${a.endTime})`,
          }),
        );
        break; // One unavailability conflict per assignment is enough
      }
    }
  }
}

import type { TenantId, PersonId } from './people';

export interface ConflictAssignment {
  readonly tenantId: TenantId;
  readonly assignmentId: string;
  readonly personId: PersonId;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface UnavailableInterval {
  readonly tenantId: TenantId;
  readonly personId: PersonId;
  readonly sourceId: string;
  readonly startsAt: string;
  readonly endsAt: string;
}

export type ConflictKind = 'assignment-overlap' | 'unavailable';

export interface SchedulingConflict {
  readonly kind: ConflictKind;
  readonly tenantId: TenantId;
  readonly personId: PersonId;
  readonly sourceId: string;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.includes('\0')) throw new Error(`${field} contains a forbidden character`);
  return normalized;
}

function instant(value: string, field: string): number {
  if (typeof value !== 'string') throw new Error(`${field} must be an ISO instant`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be an ISO instant`);
  return parsed;
}

function validateWindow(startsAt: string, endsAt: string): void {
  const start = instant(startsAt, 'startsAt');
  const end = instant(endsAt, 'endsAt');
  if (end <= start) throw new Error('Conflict window must end after it starts');
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return instant(aStart, 'startsAt') < instant(bEnd, 'endsAt') &&
    instant(bStart, 'startsAt') < instant(aEnd, 'endsAt');
}

function validateAssignment(value: ConflictAssignment): ConflictAssignment {
  const tenantId = required(value.tenantId, 'tenantId');
  const assignmentId = required(value.assignmentId, 'assignmentId');
  const personId = required(value.personId, 'personId');
  validateWindow(value.startsAt, value.endsAt);
  return Object.freeze({ ...value, tenantId, assignmentId, personId });
}

function validateUnavailable(value: UnavailableInterval): UnavailableInterval {
  const tenantId = required(value.tenantId, 'tenantId');
  const personId = required(value.personId, 'personId');
  const sourceId = required(value.sourceId, 'sourceId');
  validateWindow(value.startsAt, value.endsAt);
  return Object.freeze({ ...value, tenantId, personId, sourceId });
}

export function detectSchedulingConflicts(input: {
  tenantId: TenantId;
  candidate: ConflictAssignment;
  assignments: readonly ConflictAssignment[];
  unavailable: readonly UnavailableInterval[];
}): readonly SchedulingConflict[] {
  const tenantId = required(input.tenantId, 'tenantId');
  const candidate = validateAssignment(input.candidate);
  if (candidate.tenantId !== tenantId) throw new Error('Cross-tenant candidate assignment access denied');
  if (!Array.isArray(input.assignments)) throw new Error('assignments must be an array');
  if (!Array.isArray(input.unavailable)) throw new Error('unavailable must be an array');

  const conflicts: SchedulingConflict[] = [];
  for (const raw of input.assignments) {
    const existing = validateAssignment(raw);
    if (existing.tenantId !== tenantId || existing.personId !== candidate.personId) continue;
    if (existing.assignmentId === candidate.assignmentId) continue;
    if (overlaps(candidate.startsAt, candidate.endsAt, existing.startsAt, existing.endsAt)) {
      conflicts.push(Object.freeze({
        kind: 'assignment-overlap' as const,
        tenantId,
        personId: candidate.personId,
        sourceId: existing.assignmentId,
      }));
    }
  }

  for (const raw of input.unavailable) {
    const period = validateUnavailable(raw);
    if (period.tenantId !== tenantId || period.personId !== candidate.personId) continue;
    if (overlaps(candidate.startsAt, candidate.endsAt, period.startsAt, period.endsAt)) {
      conflicts.push(Object.freeze({
        kind: 'unavailable' as const,
        tenantId,
        personId: candidate.personId,
        sourceId: period.sourceId,
      }));
    }
  }

  return Object.freeze(conflicts.sort((a, b) => a.kind.localeCompare(b.kind) || a.sourceId.localeCompare(b.sourceId)));
}

export function hasSchedulingConflict(input: Parameters<typeof detectSchedulingConflicts>[0]): boolean {
  return detectSchedulingConflicts(input).length > 0;
}

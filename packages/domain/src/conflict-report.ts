import type { TenantId, PersonId } from './people';
import type { ConflictAssignment, SchedulingConflict } from './conflict-engine';
import { detectSchedulingConflicts } from './conflict-engine';
import type { UnavailableInterval } from './conflict-engine';

// ─── Public types ───────────────────────────────────────────────────────────

/**
 * Severity of a conflict, used by the UI to decide how to surface it.
 *
 * - `blocking`  — must be resolved before publishing (e.g. same person twice, ineligible).
 * - `warning`   — should be reviewed but may proceed (e.g. recent repeat, soft overlap).
 * - `info`      — informational only (e.g. person already assigned to another slot).
 */
export type ConflictSeverity = 'blocking' | 'warning' | 'info';

/**
 * Structured conflict kind, richer than the basic `ConflictKind`.
 * Each kind is a stable, translatable identifier — never raw UI text.
 */
export type StructuredConflictKind =
  | 'assignment-overlap'
  | 'unavailable'
  | 'person-not-eligible'
  | 'person-inactive'
  | 'student-helper-same-person'
  | 'assistant-required-missing'
  | 'assistant-not-allowed'
  | 'slot-not-found'
  | 'meeting-not-draft'
  | 'part-definition-mismatch'
  | 'class-conflict'
  | 'concurrent-modification';

export interface StructuredConflict {
  readonly kind: StructuredConflictKind;
  readonly severity: ConflictSeverity;
  readonly tenantId: TenantId;
  readonly personId?: PersonId;
  readonly sourceId?: string;
  /** Translation key, never raw localized text. */
  readonly messageKey: string;
  /** Stable parameters for interpolation. */
  readonly params: Readonly<Record<string, string | number>>;
}

export interface ConflictReportInput {
  readonly tenantId: TenantId;
  readonly candidate: ConflictAssignment;
  readonly existingAssignments: readonly ConflictAssignment[];
  readonly unavailable: readonly UnavailableInterval[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function requiredString(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

function fromBasicConflict(conflict: SchedulingConflict): StructuredConflict {
  if (conflict.kind === 'assignment-overlap') {
    return Object.freeze({
      kind: 'assignment-overlap',
      severity: 'blocking',
      tenantId: conflict.tenantId,
      personId: conflict.personId,
      sourceId: conflict.sourceId,
      messageKey: 'midweek.conflict.assignmentOverlap',
      params: Object.freeze({ personId: conflict.personId, sourceAssignmentId: conflict.sourceId }),
    });
  }
  return Object.freeze({
    kind: 'unavailable',
    severity: 'blocking',
    tenantId: conflict.tenantId,
    personId: conflict.personId,
    sourceId: conflict.sourceId,
    messageKey: 'midweek.conflict.unavailable',
    params: Object.freeze({ personId: conflict.personId, sourceId: conflict.sourceId }),
  });
}

// ─── Report builders ───────────────────────────────────────────────────────

/**
 * Detect all conflicts for a candidate assignment window, returning structured
 * reports with severity, translation keys and stable parameters.
 *
 * Pure, deterministic, tenant-isolated. Wraps `detectSchedulingConflicts` and
 * enriches the result with structured metadata for the UI.
 */
export function buildConflictReport(input: ConflictReportInput): readonly StructuredConflict[] {
  requiredString(input.tenantId, 'tenantId');
  if (input.candidate.tenantId !== input.tenantId) {
    throw new Error('Cross-tenant candidate access denied');
  }
  const basic = detectSchedulingConflicts({
    tenantId: input.tenantId,
    candidate: input.candidate,
    assignments: input.existingAssignments,
    unavailable: input.unavailable,
  });
  return Object.freeze(basic.map(fromBasicConflict));
}

export function conflictPersonNotEligible(
  tenantId: TenantId,
  personId: PersonId,
  assignmentTypeId: string,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'person-not-eligible',
    severity: 'blocking',
    tenantId,
    personId,
    messageKey: 'midweek.conflict.personNotEligible',
    params: Object.freeze({ personId, assignmentTypeId }),
  });
}

export function conflictPersonInactive(
  tenantId: TenantId,
  personId: PersonId,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'person-inactive',
    severity: 'blocking',
    tenantId,
    personId,
    messageKey: 'midweek.conflict.personInactive',
    params: Object.freeze({ personId }),
  });
}

export function conflictStudentHelperSamePerson(
  tenantId: TenantId,
  personId: PersonId,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'student-helper-same-person',
    severity: 'blocking',
    tenantId,
    personId,
    messageKey: 'midweek.conflict.studentHelperSamePerson',
    params: Object.freeze({ personId }),
  });
}

export function conflictAssistantRequiredMissing(
  tenantId: TenantId,
  slotId: string,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'assistant-required-missing',
    severity: 'blocking',
    tenantId,
    messageKey: 'midweek.conflict.assistantRequiredMissing',
    params: Object.freeze({ slotId }),
  });
}

export function conflictAssistantNotAllowed(
  tenantId: TenantId,
  slotId: string,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'assistant-not-allowed',
    severity: 'blocking',
    tenantId,
    messageKey: 'midweek.conflict.assistantNotAllowed',
    params: Object.freeze({ slotId }),
  });
}

export function conflictSlotNotFound(
  tenantId: TenantId,
  slotId: string,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'slot-not-found',
    severity: 'blocking',
    tenantId,
    messageKey: 'midweek.conflict.slotNotFound',
    params: Object.freeze({ slotId }),
  });
}

export function conflictMeetingNotDraft(
  tenantId: TenantId,
  meetingId: string,
  currentState: string,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'meeting-not-draft',
    severity: 'blocking',
    tenantId,
    messageKey: 'midweek.conflict.meetingNotDraft',
    params: Object.freeze({ meetingId, currentState }),
  });
}

export function conflictPartDefinitionMismatch(
  tenantId: TenantId,
  slotId: string,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'part-definition-mismatch',
    severity: 'blocking',
    tenantId,
    messageKey: 'midweek.conflict.partDefinitionMismatch',
    params: Object.freeze({ slotId }),
  });
}

export function conflictClassConflict(
  tenantId: TenantId,
  personId: PersonId,
  classId: string,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'class-conflict',
    severity: 'blocking',
    tenantId,
    personId,
    messageKey: 'midweek.conflict.classConflict',
    params: Object.freeze({ personId, classId }),
  });
}

export function conflictConcurrentModification(
  tenantId: TenantId,
  meetingId: string,
): Readonly<StructuredConflict> {
  return Object.freeze({
    kind: 'concurrent-modification',
    severity: 'blocking',
    tenantId,
    messageKey: 'midweek.conflict.concurrentModification',
    params: Object.freeze({ meetingId }),
  });
}

/**
 * Filter: returns only `blocking` conflicts.
 * Used by `publishMeeting` validation: if any blocking conflict exists, publish is refused.
 */
export function blockingConflicts(
  conflicts: readonly Readonly<StructuredConflict>[],
): readonly Readonly<StructuredConflict>[] {
  return Object.freeze(conflicts.filter(c => c.severity === 'blocking'));
}

/**
 * Returns true if any blocking conflict exists.
 */
export function hasBlockingConflict(
  conflicts: readonly Readonly<StructuredConflict>[],
): boolean {
  return conflicts.some(c => c.severity === 'blocking');
}

/**
 * Tenant guard for a single conflict report.
 */
export function assertConflictTenant(
  conflict: Readonly<StructuredConflict>,
  tenantId: TenantId,
): void {
  if (conflict.tenantId !== tenantId) {
    throw new Error('Cross-tenant conflict access denied');
  }
}

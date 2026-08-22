import {
  detectSchedulingConflicts,
  isExplicitlyEligible,
  unavailableIntervalsForPerson,
  type AssignmentHistoryRecord,
  type ConflictAssignment,
  type CongregationPerson,
  type SchedulingConflict,
} from '@eutaktos/domain';
import { daysSinceLastAssignment, historyByPerson, historyByPartType } from '@eutaktos/domain';

export type LastAssignmentOrder = 'never' | 'longest-ago' | 'most-recent' | 'name';
export interface LastAssignmentRow {
  readonly personId: string;
  readonly displayName: string;
  readonly active: boolean;
  readonly lastAssignedOn?: string;
  readonly daysSinceLastAssignment?: number;
  readonly neverAssigned: boolean;
}
export interface ManualPlanningCandidate extends LastAssignmentRow {
  readonly explicitlyEligible: boolean;
  readonly conflicts: readonly SchedulingConflict[];
  readonly selectable: boolean;
  readonly recentHistory: readonly Readonly<AssignmentHistoryRecord>[];
}

function validDate(value: string): void { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))) throw new Error('referenceDate must be a valid YYYY-MM-DD date'); }
function completedHistory(history: readonly Readonly<AssignmentHistoryRecord>[]): readonly Readonly<AssignmentHistoryRecord>[] { return history.filter(record => record.state === 'completed'); }
function rowFor(person: CongregationPerson, history: readonly Readonly<AssignmentHistoryRecord>[], tenantId: string, partType: string, referenceDate: string): LastAssignmentRow {
  const relevant = completedHistory(historyByPartType(historyByPerson(history, person.id, tenantId), partType, tenantId));
  const lastAssignedOn = relevant[0]?.meetingDate;
  const days = lastAssignedOn ? daysSinceLastAssignment(relevant, person.id, tenantId, referenceDate) ?? undefined : undefined;
  return Object.freeze({ personId: person.id, displayName: person.displayName, active: person.active, ...(lastAssignedOn ? { lastAssignedOn } : {}), ...(days !== undefined ? { daysSinceLastAssignment: days } : {}), neverAssigned: !lastAssignedOn });
}

/** Objective recency only. It neither evaluates suitability nor recommends anyone. */
export function lastAssignmentRows(input: { tenantId: string; partType: string; referenceDate: string; people: readonly CongregationPerson[]; history: readonly Readonly<AssignmentHistoryRecord>[]; active?: boolean; order?: LastAssignmentOrder }): readonly LastAssignmentRow[] {
  validDate(input.referenceDate);
  const tenantId = input.tenantId.trim(); const partType = input.partType.trim();
  if (!tenantId || !partType) throw new Error('tenantId and partType are required');
  const rows = input.people.filter(person => person.tenantId === tenantId && (input.active === undefined || person.active === input.active)).map(person => rowFor(person, input.history, tenantId, partType, input.referenceDate));
  const order = input.order ?? 'longest-ago';
  rows.sort((left, right) => {
    if (order === 'name') return left.displayName.localeCompare(right.displayName);
    if (order === 'never') return Number(right.neverAssigned) - Number(left.neverAssigned) || left.displayName.localeCompare(right.displayName);
    if (order === 'most-recent') return (right.lastAssignedOn ?? '').localeCompare(left.lastAssignedOn ?? '') || left.displayName.localeCompare(right.displayName);
    return Number(right.neverAssigned) - Number(left.neverAssigned) || (right.daysSinceLastAssignment ?? -1) - (left.daysSinceLastAssignment ?? -1) || left.displayName.localeCompare(right.displayName);
  });
  return Object.freeze(rows);
}

/**
 * Produces a transparent, manual-choice list. `selectable` means only that every
 * objective condition passed: active, explicit eligibility and no detected conflict.
 * It is not a recommendation and no person is selected by this function.
 */
export function manualPlanningCandidates(input: { tenantId: string; assignmentTypeId: string; partType: string; referenceDate: string; startsAt: string; endsAt: string; people: readonly CongregationPerson[]; history: readonly Readonly<AssignmentHistoryRecord>[]; existingAssignments: readonly ConflictAssignment[]; recentLimit?: number }): readonly ManualPlanningCandidate[] {
  validDate(input.referenceDate);
  const tenantId = input.tenantId.trim(); const assignmentTypeId = input.assignmentTypeId.trim(); const partType = input.partType.trim();
  if (!tenantId || !assignmentTypeId || !partType) throw new Error('tenantId, assignmentTypeId and partType are required');
  const recentLimit = input.recentLimit ?? 5;
  if (!Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > 50) throw new Error('recentLimit must be between 1 and 50');
  const rows = input.people.filter(person => person.tenantId === tenantId).map(person => {
    const base = rowFor(person, input.history, tenantId, partType, input.referenceDate);
    const conflicts = detectSchedulingConflicts({ tenantId, candidate: { tenantId, assignmentId: `manual-preview:${person.id}`, personId: person.id, startsAt: input.startsAt, endsAt: input.endsAt }, assignments: input.existingAssignments, unavailable: unavailableIntervalsForPerson(person, tenantId) });
    const explicitlyEligible = isExplicitlyEligible(person, assignmentTypeId);
    const recentHistory = Object.freeze(completedHistory(historyByPerson(input.history, person.id, tenantId)).slice(0, recentLimit));
    return Object.freeze({ ...base, explicitlyEligible, conflicts, selectable: person.active && explicitlyEligible && conflicts.length === 0, recentHistory });
  });
  return Object.freeze(rows.sort((left, right) => left.displayName.localeCompare(right.displayName)));
}

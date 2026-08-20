import type { TenantId, PersonId } from './people';

export type TaskCompletionId = string;
export type TaskStatus = 'completed' | 'reopened';

export interface TaskCompletionRecord {
  readonly id: TaskCompletionId;
  readonly tenantId: TenantId;
  readonly taskId: string;
  readonly completedBy: PersonId;
  readonly completedAt: string;
  readonly status: TaskStatus;
  readonly reopenedAt: string | null;
  readonly reopenedBy: PersonId | null;
  readonly reopenReason: string | null;
}

function required(value: string, field: string): string {
  const n = value.trim(); if (!n) throw new Error(`${field} is required`); return n;
}
function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
}

export function createTaskCompletion(input: {
  id: TaskCompletionId; tenantId: TenantId; taskId: string;
  completedBy: PersonId; now: string;
}): Readonly<TaskCompletionRecord> {
  validateInstant(input.now);
  return Object.freeze({
    id: required(input.id, 'completionId'),
    tenantId: required(input.tenantId, 'tenantId'),
    taskId: required(input.taskId, 'taskId'),
    completedBy: required(input.completedBy, 'completedBy'),
    completedAt: input.now, status: 'completed',
    reopenedAt: null, reopenedBy: null, reopenReason: null,
  });
}

export function reopenTaskCompletion(
  record: Readonly<TaskCompletionRecord>,
  reopenedBy: PersonId, now: string, reason?: string,
): Readonly<TaskCompletionRecord> {
  if (record.status === 'reopened') throw new Error('Task completion already reopened');
  validateInstant(now);
  const reopenReason = reason?.trim() ?? null;
  if (reopenReason && reopenReason.length > 500) throw new Error('reopenReason too long');
  return Object.freeze({ ...record, status: 'reopened', reopenedAt: now, reopenedBy, reopenReason });
}

/** Deterministic ordering: by completedAt desc, then by id asc */
export function orderCompletionHistory(
  records: readonly Readonly<TaskCompletionRecord>[],
): readonly Readonly<TaskCompletionRecord>[] {
  return [...records].sort((a, b) => {
    const dt = Date.parse(b.completedAt) - Date.parse(a.completedAt);
    return dt || a.id.localeCompare(b.id);
  });
}

export function filterCompletionsByTenant(
  records: readonly Readonly<TaskCompletionRecord>[], tenantId: TenantId,
): readonly Readonly<TaskCompletionRecord>[] {
  return records.filter(r => r.tenantId === tenantId);
}

export function findCompletionsForTask(
  records: readonly Readonly<TaskCompletionRecord>[],
  tenantId: TenantId, taskId: string,
): readonly Readonly<TaskCompletionRecord>[] {
  return records.filter(r => r.tenantId === tenantId && r.taskId === taskId);
}

export function assertCompletionTenant(record: Readonly<TaskCompletionRecord>, tenantId: TenantId): void {
  if (record.tenantId !== tenantId) throw new Error('Cross-tenant completion access denied');
}

export function normalizeTaskCompletion(input: TaskCompletionRecord): Readonly<TaskCompletionRecord> {
  required(input.id, 'completionId'); required(input.tenantId, 'tenantId');
  required(input.taskId, 'taskId'); required(input.completedBy, 'completedBy');
  validateInstant(input.completedAt);
  if (input.status !== 'completed' && input.status !== 'reopened') throw new Error(`Invalid status: ${input.status}`);
  if (input.reopenedAt !== null) validateInstant(input.reopenedAt);
  if (input.reopenReason && input.reopenReason.length > 500) throw new Error('reopenReason too long');
  return Object.freeze({ ...input });
}

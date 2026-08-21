import type { TenantId, PersonId } from './people';

export type TaskCompletionId = string;
export type TaskStatus = 'completed' | 'reopened';
export interface TaskCompletionRecord {
  readonly id: TaskCompletionId; readonly tenantId: TenantId; readonly taskId: string;
  readonly completedBy: PersonId; readonly completedAt: string; readonly status: TaskStatus;
  readonly reopenedAt: string | null; readonly reopenedBy: PersonId | null; readonly reopenReason: string | null;
}
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function validateReason(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  if (normalized.length > 500) throw new Error('reopenReason too long');
  return normalized || null;
}
export function createTaskCompletion(input: {
  id: TaskCompletionId; tenantId: TenantId; taskId: string; completedBy: PersonId; now: string;
}): Readonly<TaskCompletionRecord> {
  validateInstant(input.now);
  return Object.freeze({
    id: required(input.id, 'completionId'), tenantId: required(input.tenantId, 'tenantId'),
    taskId: required(input.taskId, 'taskId'), completedBy: required(input.completedBy, 'completedBy'),
    completedAt: input.now, status: 'completed', reopenedAt: null, reopenedBy: null, reopenReason: null,
  });
}
export function reopenTaskCompletion(
  record: Readonly<TaskCompletionRecord>, reopenedBy: PersonId, now: string, reason?: string,
): Readonly<TaskCompletionRecord> {
  if (record.status === 'reopened') throw new Error('Task completion already reopened');
  validateInstant(now);
  if (Date.parse(now) < Date.parse(record.completedAt)) throw new Error('reopenedAt cannot be before completedAt');
  return Object.freeze({
    ...record, status: 'reopened', reopenedAt: now,
    reopenedBy: required(reopenedBy, 'reopenedBy'), reopenReason: validateReason(reason),
  });
}
export function orderCompletionHistory(records: readonly Readonly<TaskCompletionRecord>[]) {
  return [...records].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt) || a.id.localeCompare(b.id));
}
export function filterCompletionsByTenant(records: readonly Readonly<TaskCompletionRecord>[], tenantId: TenantId) {
  return records.filter((record) => record.tenantId === tenantId);
}
export function findCompletionsForTask(records: readonly Readonly<TaskCompletionRecord>[], tenantId: TenantId, taskId: string) {
  return records.filter((record) => record.tenantId === tenantId && record.taskId === taskId);
}
export function assertCompletionTenant(record: Readonly<TaskCompletionRecord>, tenantId: TenantId): void {
  if (record.tenantId !== tenantId) throw new Error('Cross-tenant completion access denied');
}
export function normalizeTaskCompletion(input: TaskCompletionRecord): Readonly<TaskCompletionRecord> {
  const id = required(input.id, 'completionId'); const tenantId = required(input.tenantId, 'tenantId');
  const taskId = required(input.taskId, 'taskId'); const completedBy = required(input.completedBy, 'completedBy');
  validateInstant(input.completedAt);
  if (input.status !== 'completed' && input.status !== 'reopened') throw new Error(`Invalid status: ${input.status}`);
  if (input.status === 'completed') {
    if (input.reopenedAt !== null || input.reopenedBy !== null || input.reopenReason !== null) throw new Error('completed records cannot contain reopen metadata');
  } else {
    if (input.reopenedAt === null) throw new Error('reopened record requires reopenedAt');
    validateInstant(input.reopenedAt);
    if (Date.parse(input.reopenedAt) < Date.parse(input.completedAt)) throw new Error('reopenedAt cannot be before completedAt');
    required(input.reopenedBy ?? '', 'reopenedBy');
  }
  return Object.freeze({ ...input, id, tenantId, taskId, completedBy, reopenReason: validateReason(input.reopenReason) });
}

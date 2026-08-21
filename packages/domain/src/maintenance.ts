import type { TenantId } from './people';

export type MaintenanceTaskId = string;
export type MaintenanceCategory = 'building' | 'equipment' | 'furniture' | 'landscaping' | 'other';
export const MAINTENANCE_CATEGORIES: readonly MaintenanceCategory[] = Object.freeze(['building', 'equipment', 'furniture', 'landscaping', 'other'] as const);
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export const MAINTENANCE_PRIORITIES: readonly MaintenancePriority[] = Object.freeze(['low', 'medium', 'high', 'urgent'] as const);
export type MaintenanceStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export const MAINTENANCE_STATUSES: readonly MaintenanceStatus[] = Object.freeze(['open', 'in_progress', 'completed', 'cancelled'] as const);
export interface MaintenanceTask {
  readonly id: MaintenanceTaskId; readonly tenantId: TenantId; readonly category: MaintenanceCategory;
  readonly title: string; readonly dueAt: string | null; readonly priority: MaintenancePriority;
  readonly status: MaintenanceStatus; readonly assigneeReferences: readonly string[];
  readonly createdAt: string; readonly completedAt: string | null;
}
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function normalizeAssignees(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values)) throw new Error('assigneeReferences must be an array');
  if (values.length > 50) throw new Error('Too many assignees (max 50)');
  return Object.freeze(values.map((value, index) => required(value, `assignee[${index}]`)));
}
function validateCategory(value: MaintenanceCategory): void {
  if (!MAINTENANCE_CATEGORIES.includes(value)) throw new Error(`Invalid category: ${value}`);
}
function validatePriority(value: MaintenancePriority): void {
  if (!MAINTENANCE_PRIORITIES.includes(value)) throw new Error(`Invalid priority: ${value}`);
}
const VALID_TRANSITIONS: Readonly<Record<MaintenanceStatus, readonly MaintenanceStatus[]>> = {
  open: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [],
};
export function createMaintenanceTask(input: {
  id: MaintenanceTaskId; tenantId: TenantId; category: MaintenanceCategory; title: string;
  dueAt: string | null; priority: MaintenancePriority; now: string; assigneeReferences?: readonly string[];
}): Readonly<MaintenanceTask> {
  validateInstant(input.now); if (input.dueAt !== null) validateInstant(input.dueAt);
  const title = required(input.title, 'title'); if (title.length > 500) throw new Error('title is too long (max 500)');
  validateCategory(input.category); validatePriority(input.priority);
  return Object.freeze({
    id: required(input.id, 'maintenanceTaskId'), tenantId: required(input.tenantId, 'tenantId'),
    category: input.category, title, dueAt: input.dueAt, priority: input.priority, status: 'open',
    assigneeReferences: normalizeAssignees(input.assigneeReferences ?? []), createdAt: input.now, completedAt: null,
  });
}
export function transitionMaintenanceStatus(task: Readonly<MaintenanceTask>, newStatus: MaintenanceStatus, now: string): Readonly<MaintenanceTask> {
  validateInstant(now);
  if (!MAINTENANCE_STATUSES.includes(newStatus) || !VALID_TRANSITIONS[task.status]?.includes(newStatus)) throw new Error(`Invalid transition: ${task.status} → ${newStatus}`);
  if (Date.parse(now) < Date.parse(task.createdAt)) throw new Error('transition timestamp cannot be before createdAt');
  return Object.freeze({ ...task, status: newStatus, completedAt: newStatus === 'completed' ? now : null });
}
export function assertMaintenanceTenant(task: Readonly<MaintenanceTask>, tenantId: TenantId): void {
  if (task.tenantId !== tenantId) throw new Error('Cross-tenant maintenance access denied');
}
export function normalizeMaintenanceTask(input: MaintenanceTask): Readonly<MaintenanceTask> {
  const id = required(input.id, 'maintenanceTaskId'); const tenantId = required(input.tenantId, 'tenantId');
  const title = required(input.title, 'title'); if (title.length > 500) throw new Error('title is too long (max 500)');
  validateCategory(input.category); validatePriority(input.priority);
  if (!MAINTENANCE_STATUSES.includes(input.status)) throw new Error('Invalid status');
  validateInstant(input.createdAt); if (input.dueAt !== null) validateInstant(input.dueAt);
  if (input.status === 'completed') {
    if (input.completedAt === null) throw new Error('completed task requires completedAt');
    validateInstant(input.completedAt);
    if (Date.parse(input.completedAt) < Date.parse(input.createdAt)) throw new Error('completedAt cannot be before createdAt');
  } else if (input.completedAt !== null) {
    throw new Error('non-completed task cannot contain completedAt');
  }
  return Object.freeze({ ...input, id, tenantId, title, assigneeReferences: normalizeAssignees(input.assigneeReferences) });
}

import type { TenantId } from './people';

export type MaintenanceTaskId = string;

export type MaintenanceCategory = 'building' | 'equipment' | 'furniture' | 'landscaping' | 'other';

export const MAINTENANCE_CATEGORIES: readonly MaintenanceCategory[] = Object.freeze([
  'building', 'equipment', 'furniture', 'landscaping', 'other',] as const);

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

export const MAINTENANCE_PRIORITIES: readonly MaintenancePriority[] = Object.freeze([
  'low', 'medium', 'high', 'urgent',] as const);

export type MaintenanceStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export const MAINTENANCE_STATUSES: readonly MaintenanceStatus[] = Object.freeze([
  'open', 'in_progress', 'completed', 'cancelled',] as const);

export interface MaintenanceTask {
  readonly id: MaintenanceTaskId;
  readonly tenantId: TenantId;
  readonly category: MaintenanceCategory;
  readonly title: string;
  readonly dueAt: string | null;
  readonly priority: MaintenancePriority;
  readonly status: MaintenanceStatus;
  readonly assigneeReferences: readonly string[];
  readonly createdAt: string;
  readonly completedAt: string | null;
}

function required(value: string, field: string): string {
  const n = value.trim(); if (!n) throw new Error(`${field} is required`); return n;
}
function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
}

const VALID_TRANSITIONS: Readonly<Record<MaintenanceStatus, readonly MaintenanceStatus[]>> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function createMaintenanceTask(input: {
  id: MaintenanceTaskId; tenantId: TenantId; category: MaintenanceCategory;
  title: string; dueAt: string | null; priority: MaintenancePriority; now: string;
  assigneeReferences?: readonly string[];
}): Readonly<MaintenanceTask> {
  validateInstant(input.now);
  if (input.dueAt !== null) validateInstant(input.dueAt);
  const title = required(input.title, 'title');
  if (title.length > 500) throw new Error('title is too long (max 500)');
  if (!MAINTENANCE_CATEGORIES.includes(input.category)) throw new Error(`Invalid category: ${input.category}`);
  if (!MAINTENANCE_PRIORITIES.includes(input.priority)) throw new Error(`Invalid priority: ${input.priority}`);

  return Object.freeze({
    id: required(input.id, 'maintenanceTaskId'),
    tenantId: required(input.tenantId, 'tenantId'),
    category: input.category, title, dueAt: input.dueAt, priority: input.priority,
    status: 'open',
    assigneeReferences: Object.freeze((input.assigneeReferences ?? []).map((a, i) => required(a, `assignee[${i}]`))),
    createdAt: input.now, completedAt: null,
  });
}

export function transitionMaintenanceStatus(
  task: Readonly<MaintenanceTask>, newStatus: MaintenanceStatus, now: string,
): Readonly<MaintenanceTask> {
  validateInstant(now);
  if (!VALID_TRANSITIONS[task.status].includes(newStatus)) {
    throw new Error(`Invalid transition: ${task.status} → ${newStatus}`);
  }
  return Object.freeze({
    ...task, status: newStatus,
    completedAt: newStatus === 'completed' ? now : task.completedAt,
  });
}

export function assertMaintenanceTenant(task: Readonly<MaintenanceTask>, tenantId: TenantId): void {
  if (task.tenantId !== tenantId) throw new Error('Cross-tenant maintenance access denied');
}

export function normalizeMaintenanceTask(input: MaintenanceTask): Readonly<MaintenanceTask> {
  required(input.id, 'maintenanceTaskId'); required(input.tenantId, 'tenantId');
  required(input.title, 'title'); validateInstant(input.createdAt);
  if (!MAINTENANCE_CATEGORIES.includes(input.category)) throw new Error(`Invalid category`);
  if (!MAINTENANCE_PRIORITIES.includes(input.priority)) throw new Error(`Invalid priority`);
  if (!MAINTENANCE_STATUSES.includes(input.status)) throw new Error(`Invalid status`);
  if (input.dueAt !== null) validateInstant(input.dueAt);
  if (input.completedAt !== null) validateInstant(input.completedAt);
  return Object.freeze({ ...input, assigneeReferences: Object.freeze([...input.assigneeReferences]) });
}

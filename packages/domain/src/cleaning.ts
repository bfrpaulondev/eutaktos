import type { TenantId } from './people';

export type CleaningId = string;
export type CleaningType = 'weekly' | 'after-meeting' | 'custom';
export const CLEANING_TYPES: readonly CleaningType[] = Object.freeze(['weekly', 'after-meeting', 'custom'] as const);
export interface CleaningArrangement {
  readonly id: CleaningId; readonly tenantId: TenantId; readonly scheduleReference: string;
  readonly assigneeReferences: readonly string[]; readonly type: CleaningType;
  readonly active: boolean; readonly createdAt: string;
}
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function validType(type: string): CleaningType {
  if (!CLEANING_TYPES.includes(type as CleaningType)) throw new Error(`Invalid cleaning type: ${type}`);
  return type as CleaningType;
}
function normalizeAssignees(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length === 0) throw new Error('At least one assignee is required');
  if (values.length > 50) throw new Error('Too many assignees (max 50)');
  return Object.freeze(values.map((value, index) => required(value, `assigneeReference[${index}]`)));
}
export function createCleaningArrangement(input: {
  id: CleaningId; tenantId: TenantId; scheduleReference: string; assigneeReferences: readonly string[];
  type: CleaningType; now: string;
}): Readonly<CleaningArrangement> {
  validateInstant(input.now);
  return Object.freeze({
    id: required(input.id, 'cleaningId'), tenantId: required(input.tenantId, 'tenantId'),
    scheduleReference: required(input.scheduleReference, 'scheduleReference'),
    assigneeReferences: normalizeAssignees(input.assigneeReferences), type: validType(input.type), active: true, createdAt: input.now,
  });
}
export function setCleaningActive(cleaning: Readonly<CleaningArrangement>, active: boolean): Readonly<CleaningArrangement> {
  if (typeof active !== 'boolean') throw new Error('active must be boolean');
  return Object.freeze({ ...cleaning, active });
}
export function updateCleaningAssignees(cleaning: Readonly<CleaningArrangement>, assigneeReferences: readonly string[]): Readonly<CleaningArrangement> {
  return Object.freeze({ ...cleaning, assigneeReferences: normalizeAssignees(assigneeReferences) });
}
export function assertCleaningTenant(cleaning: Readonly<CleaningArrangement>, tenantId: TenantId): void {
  if (cleaning.tenantId !== tenantId) throw new Error('Cross-tenant cleaning access denied');
}
export function normalizeCleaningArrangement(input: CleaningArrangement): Readonly<CleaningArrangement> {
  const id = required(input.id, 'cleaningId'); const tenantId = required(input.tenantId, 'tenantId');
  const scheduleReference = required(input.scheduleReference, 'scheduleReference'); validateInstant(input.createdAt);
  if (typeof input.active !== 'boolean') throw new Error('active must be boolean');
  return Object.freeze({ ...input, id, tenantId, scheduleReference, type: validType(input.type), assigneeReferences: normalizeAssignees(input.assigneeReferences) });
}

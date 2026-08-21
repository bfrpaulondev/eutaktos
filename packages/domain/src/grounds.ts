import type { TenantId } from './people';

export type GroundsId = string;
export interface GroundsSchedule {
  readonly id: GroundsId; readonly tenantId: TenantId; readonly area: string;
  readonly scheduleReference: string; readonly assigneeReferences: readonly string[];
  readonly active: boolean; readonly validFrom: string; readonly validUntil: string | null;
  readonly createdAt: string;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function normalizeAssignees(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.length === 0) throw new Error('At least one assignee is required');
  if (values.length > 50) throw new Error('Too many assignees (max 50)');
  return Object.freeze(values.map((value, index) => required(value, `assigneeReference[${index}]`)));
}
function validateWindow(validFrom: string, validUntil: string | null): void {
  validateInstant(validFrom);
  if (validUntil !== null) {
    validateInstant(validUntil);
    if (Date.parse(validUntil) < Date.parse(validFrom)) throw new Error('validUntil must not be before validFrom');
  }
}

export function createGroundsSchedule(input: {
  id: GroundsId; tenantId: TenantId; area: string; scheduleReference: string;
  assigneeReferences: readonly string[]; validFrom: string; validUntil: string | null; now: string;
}): Readonly<GroundsSchedule> {
  validateInstant(input.now); validateWindow(input.validFrom, input.validUntil);
  const area = required(input.area, 'area'); if (area.length > 200) throw new Error('area is too long (max 200)');
  return Object.freeze({
    id: required(input.id, 'groundsId'), tenantId: required(input.tenantId, 'tenantId'), area,
    scheduleReference: required(input.scheduleReference, 'scheduleReference'),
    assigneeReferences: normalizeAssignees(input.assigneeReferences), active: true,
    validFrom: input.validFrom, validUntil: input.validUntil, createdAt: input.now,
  });
}

export function isGroundsScheduleValid(grounds: Readonly<GroundsSchedule>, at: string): boolean {
  validateWindow(grounds.validFrom, grounds.validUntil); validateInstant(at);
  if (!grounds.active) return false;
  const timestamp = Date.parse(at);
  return timestamp >= Date.parse(grounds.validFrom)
    && (grounds.validUntil === null || timestamp <= Date.parse(grounds.validUntil));
}
export function setGroundsActive(grounds: Readonly<GroundsSchedule>, active: boolean): Readonly<GroundsSchedule> {
  if (typeof active !== 'boolean') throw new Error('active must be boolean');
  return Object.freeze({ ...grounds, active });
}
export function assertGroundsTenant(grounds: Readonly<GroundsSchedule>, tenantId: TenantId): void {
  if (grounds.tenantId !== tenantId) throw new Error('Cross-tenant grounds access denied');
}
export function normalizeGroundsSchedule(input: GroundsSchedule): Readonly<GroundsSchedule> {
  const id = required(input.id, 'groundsId'); const tenantId = required(input.tenantId, 'tenantId');
  const area = required(input.area, 'area'); if (area.length > 200) throw new Error('area is too long (max 200)');
  const scheduleReference = required(input.scheduleReference, 'scheduleReference');
  validateWindow(input.validFrom, input.validUntil); validateInstant(input.createdAt);
  if (typeof input.active !== 'boolean') throw new Error('active must be boolean');
  return Object.freeze({ ...input, id, tenantId, area, scheduleReference, assigneeReferences: normalizeAssignees(input.assigneeReferences) });
}

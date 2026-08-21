import type { TenantId } from './people';

export type GroundsId = string;

export interface GroundsSchedule {
  readonly id: GroundsId;
  readonly tenantId: TenantId;
  readonly area: string;
  readonly scheduleReference: string;
  readonly assigneeReferences: readonly string[];
  readonly active: boolean;
  readonly validFrom: string;
  readonly validUntil: string | null;
  readonly createdAt: string;
}

function required(value: string, field: string): string {
  const n = value.trim();
  if (!n) throw new Error(`${field} is required`);
  return n;
}

function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
}

export function createGroundsSchedule(input: {
  id: GroundsId;
  tenantId: TenantId;
  area: string;
  scheduleReference: string;
  assigneeReferences: readonly string[];
  validFrom: string;
  validUntil: string | null;
  now: string;
}): Readonly<GroundsSchedule> {
  validateInstant(input.now);
  validateInstant(input.validFrom);
  if (input.validUntil !== null) validateInstant(input.validUntil);
  if (input.assigneeReferences.length === 0) throw new Error('At least one assignee is required');
  if (input.area.trim().length > 200) throw new Error('area is too long (max 200)');

  return Object.freeze({
    id: required(input.id, 'groundsId'),
    tenantId: required(input.tenantId, 'tenantId'),
    area: required(input.area, 'area'),
    scheduleReference: required(input.scheduleReference, 'scheduleReference'),
    assigneeReferences: Object.freeze(input.assigneeReferences.map((a, i) => required(a, `assigneeReference[${i}]`))),
    active: true,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    createdAt: input.now,
  });
}

export function isGroundsScheduleValid(grounds: Readonly<GroundsSchedule>, at: string): boolean {
  validateInstant(at);
  if (!grounds.active) return false;
  const t = Date.parse(at);
  if (t < Date.parse(grounds.validFrom)) return false;
  if (grounds.validUntil !== null && t > Date.parse(grounds.validUntil)) return false;
  return true;
}

export function setGroundsActive(grounds: Readonly<GroundsSchedule>, active: boolean): Readonly<GroundsSchedule> {
  return Object.freeze({ ...grounds, active });
}

export function assertGroundsTenant(grounds: Readonly<GroundsSchedule>, tenantId: TenantId): void {
  if (grounds.tenantId !== tenantId) throw new Error('Cross-tenant grounds access denied');
}

export function normalizeGroundsSchedule(input: GroundsSchedule): Readonly<GroundsSchedule> {
  required(input.id, 'groundsId');
  required(input.tenantId, 'tenantId');
  required(input.area, 'area');
  required(input.scheduleReference, 'scheduleReference');
  validateInstant(input.validFrom);
  validateInstant(input.createdAt);
  if (input.validUntil !== null) validateInstant(input.validUntil);
  if (input.area.length > 200) throw new Error('area is too long (max 200)');
  return Object.freeze({ ...input, assigneeReferences: Object.freeze([...input.assigneeReferences]) });
}

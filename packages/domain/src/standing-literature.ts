import type { TenantId, PersonId } from './people';

export type StandingRequestId = string;
export interface StandingLiteratureRequest {
  readonly id: StandingRequestId; readonly tenantId: TenantId; readonly itemCode: string;
  readonly quantity: number; readonly effectiveFrom: string; readonly effectiveUntil: string | null;
  readonly active: boolean; readonly requesterId: PersonId; readonly createdAt: string;
}
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) throw new Error('quantity must be 1-9999');
}
function validateWindow(from: string, until: string | null): void {
  validateInstant(from);
  if (until !== null) {
    validateInstant(until);
    if (Date.parse(until) <= Date.parse(from)) throw new Error('effectiveUntil must be after effectiveFrom');
  }
}
export function createStandingRequest(input: {
  id: StandingRequestId; tenantId: TenantId; itemCode: string; quantity: number;
  effectiveFrom: string; effectiveUntil: string | null; requesterId: PersonId; now: string;
}): Readonly<StandingLiteratureRequest> {
  validateInstant(input.now); validateWindow(input.effectiveFrom, input.effectiveUntil); validateQuantity(input.quantity);
  return Object.freeze({
    id: required(input.id, 'standingRequestId'), tenantId: required(input.tenantId, 'tenantId'),
    itemCode: required(input.itemCode, 'itemCode'), quantity: input.quantity,
    effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil, active: true,
    requesterId: required(input.requesterId, 'requesterId'), createdAt: input.now,
  });
}
export function isStandingRequestActive(request: Readonly<StandingLiteratureRequest>, at: string): boolean {
  validateWindow(request.effectiveFrom, request.effectiveUntil); validateInstant(at);
  if (!request.active) return false;
  const timestamp = Date.parse(at);
  return timestamp >= Date.parse(request.effectiveFrom)
    && (request.effectiveUntil === null || timestamp <= Date.parse(request.effectiveUntil));
}
export function deactivateStandingRequest(request: Readonly<StandingLiteratureRequest>): Readonly<StandingLiteratureRequest> {
  return request.active ? Object.freeze({ ...request, active: false }) : request;
}
export function assertStandingRequestTenant(request: Readonly<StandingLiteratureRequest>, tenantId: TenantId): void {
  if (request.tenantId !== tenantId) throw new Error('Cross-tenant standing request access denied');
}
export function normalizeStandingRequest(input: StandingLiteratureRequest): Readonly<StandingLiteratureRequest> {
  const id = required(input.id, 'standingRequestId'); const tenantId = required(input.tenantId, 'tenantId');
  const itemCode = required(input.itemCode, 'itemCode'); const requesterId = required(input.requesterId, 'requesterId');
  validateQuantity(input.quantity); validateWindow(input.effectiveFrom, input.effectiveUntil); validateInstant(input.createdAt);
  if (typeof input.active !== 'boolean') throw new Error('active must be boolean');
  return Object.freeze({ ...input, id, tenantId, itemCode, requesterId });
}

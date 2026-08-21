import type { TenantId, PersonId } from './people';

export type LiteratureRequestId = string;
export type LiteratureRequestStatus = 'pending' | 'approved' | 'fulfilled' | 'cancelled';
export const LITERATURE_REQUEST_STATUSES: readonly LiteratureRequestStatus[] = Object.freeze(['pending', 'approved', 'fulfilled', 'cancelled'] as const);
const VALID_TRANSITIONS: Readonly<Record<LiteratureRequestStatus, readonly LiteratureRequestStatus[]>> = {
  pending: ['approved', 'cancelled'], approved: ['fulfilled', 'cancelled'], fulfilled: [], cancelled: [],
};
export interface LiteratureRequest {
  readonly id: LiteratureRequestId; readonly tenantId: TenantId; readonly requesterId: PersonId;
  readonly itemCode: string; readonly itemDescription: string; readonly quantity: number;
  readonly status: LiteratureRequestStatus; readonly requestedAt: string;
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
function validateDescription(description: string): void {
  if (description.length > 500) throw new Error('itemDescription too long (max 500)');
}
export function createLiteratureRequest(input: {
  id: LiteratureRequestId; tenantId: TenantId; requesterId: PersonId; itemCode: string;
  itemDescription: string; quantity: number; now: string;
}): Readonly<LiteratureRequest> {
  validateInstant(input.now); validateQuantity(input.quantity);
  const description = required(input.itemDescription, 'itemDescription'); validateDescription(description);
  return Object.freeze({
    id: required(input.id, 'requestId'), tenantId: required(input.tenantId, 'tenantId'),
    requesterId: required(input.requesterId, 'requesterId'), itemCode: required(input.itemCode, 'itemCode'),
    itemDescription: description, quantity: input.quantity, status: 'pending', requestedAt: input.now,
  });
}
export function transitionLiteratureRequest(request: Readonly<LiteratureRequest>, newStatus: LiteratureRequestStatus): Readonly<LiteratureRequest> {
  if (!LITERATURE_REQUEST_STATUSES.includes(newStatus) || !VALID_TRANSITIONS[request.status]?.includes(newStatus)) {
    throw new Error(`Invalid transition: ${request.status} → ${newStatus}`);
  }
  return Object.freeze({ ...request, status: newStatus });
}
export function assertLiteratureRequestTenant(request: Readonly<LiteratureRequest>, tenantId: TenantId): void {
  if (request.tenantId !== tenantId) throw new Error('Cross-tenant literature request access denied');
}
export function normalizeLiteratureRequest(input: LiteratureRequest): Readonly<LiteratureRequest> {
  const id = required(input.id, 'requestId'); const tenantId = required(input.tenantId, 'tenantId');
  const requesterId = required(input.requesterId, 'requesterId'); const itemCode = required(input.itemCode, 'itemCode');
  const itemDescription = required(input.itemDescription, 'itemDescription'); validateDescription(itemDescription);
  validateQuantity(input.quantity); validateInstant(input.requestedAt);
  if (!LITERATURE_REQUEST_STATUSES.includes(input.status)) throw new Error(`Invalid status: ${input.status}`);
  return Object.freeze({ ...input, id, tenantId, requesterId, itemCode, itemDescription });
}

import type { TenantId, PersonId } from './people';

export type LiteratureRequestId = string;
export type LiteratureRequestStatus = 'pending' | 'approved' | 'fulfilled' | 'cancelled';

export const LITERATURE_REQUEST_STATUSES: readonly LiteratureRequestStatus[] = Object.freeze([
  'pending', 'approved', 'fulfilled', 'cancelled',] as const);

const VALID_TRANSITIONS: Readonly<Record<LiteratureRequestStatus, readonly LiteratureRequestStatus[]>> = {
  pending: ['approved', 'cancelled'],
  approved: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

export interface LiteratureRequest {
  readonly id: LiteratureRequestId;
  readonly tenantId: TenantId;
  readonly requesterId: PersonId;
  readonly itemCode: string;
  readonly itemDescription: string;
  readonly quantity: number;
  readonly status: LiteratureRequestStatus;
  readonly requestedAt: string;
}

function required(v: string, f: string): string { const n = v.trim(); if (!n) throw new Error(`${f} is required`); return n; }
function validateInstant(v: string): void { if (!Number.isFinite(Date.parse(v))) throw new Error(`Invalid ISO date: ${v}`); }

export function createLiteratureRequest(input: {
  id: LiteratureRequestId; tenantId: TenantId; requesterId: PersonId;
  itemCode: string; itemDescription: string; quantity: number; now: string;
}): Readonly<LiteratureRequest> {
  validateInstant(input.now);
  const desc = required(input.itemDescription, 'itemDescription');
  if (desc.length > 500) throw new Error('itemDescription too long (max 500)');
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 9999)
    throw new Error('quantity must be 1-9999');
  return Object.freeze({
    id: required(input.id, 'requestId'), tenantId: required(input.tenantId, 'tenantId'),
    requesterId: required(input.requesterId, 'requesterId'),
    itemCode: required(input.itemCode, 'itemCode'),
    itemDescription: desc, quantity: input.quantity,
    status: 'pending', requestedAt: input.now,
  });
}

export function transitionLiteratureRequest(
  req: Readonly<LiteratureRequest>, newStatus: LiteratureRequestStatus,
): Readonly<LiteratureRequest> {
  if (!VALID_TRANSITIONS[req.status].includes(newStatus))
    throw new Error(`Invalid transition: ${req.status} → ${newStatus}`);
  return Object.freeze({ ...req, status: newStatus });
}

export function assertLiteratureRequestTenant(req: Readonly<LiteratureRequest>, tenantId: TenantId): void {
  if (req.tenantId !== tenantId) throw new Error('Cross-tenant literature request access denied');
}

export function normalizeLiteratureRequest(input: LiteratureRequest): Readonly<LiteratureRequest> {
  required(input.id, 'requestId'); required(input.tenantId, 'tenantId');
  required(input.itemCode, 'itemCode'); required(input.itemDescription, 'itemDescription');
  validateInstant(input.requestedAt);
  if (!LITERATURE_REQUEST_STATUSES.includes(input.status)) throw new Error(`Invalid status: ${input.status}`);
  if (input.itemDescription.length > 500) throw new Error('itemDescription too long');
  return Object.freeze({ ...input });
}

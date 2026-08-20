import type { TenantId, PersonId } from './people';

export type StandingRequestId = string;

export interface StandingLiteratureRequest {
  readonly id: StandingRequestId;
  readonly tenantId: TenantId;
  readonly itemCode: string;
  readonly quantity: number;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly active: boolean;
  readonly requesterId: PersonId;
  readonly createdAt: string;
}

function required(v: string, f: string): string { const n = v.trim(); if (!n) throw new Error(`${f} is required`); return n; }
function validateInstant(v: string): void { if (!Number.isFinite(Date.parse(v))) throw new Error(`Invalid ISO date: ${v}`); }

export function createStandingRequest(input: {
  id: StandingRequestId; tenantId: TenantId; itemCode: string;
  quantity: number; effectiveFrom: string; effectiveUntil: string | null;
  requesterId: PersonId; now: string;
}): Readonly<StandingLiteratureRequest> {
  validateInstant(input.now); validateInstant(input.effectiveFrom);
  if (input.effectiveUntil !== null) validateInstant(input.effectiveUntil);
  if (input.effectiveUntil !== null && Date.parse(input.effectiveUntil) <= Date.parse(input.effectiveFrom))
    throw new Error('effectiveUntil must be after effectiveFrom');
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 9999)
    throw new Error('quantity must be 1-9999');

  return Object.freeze({
    id: required(input.id, 'standingRequestId'),
    tenantId: required(input.tenantId, 'tenantId'),
    itemCode: required(input.itemCode, 'itemCode'),
    quantity: input.quantity, effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil, active: true,
    requesterId: required(input.requesterId, 'requesterId'),
    createdAt: input.now,
  });
}

export function isStandingRequestActive(req: Readonly<StandingLiteratureRequest>, at: string): boolean {
  validateInstant(at);
  if (!req.active) return false;
  const t = Date.parse(at);
  if (t < Date.parse(req.effectiveFrom)) return false;
  if (req.effectiveUntil !== null && t > Date.parse(req.effectiveUntil)) return false;
  return true;
}

export function deactivateStandingRequest(req: Readonly<StandingLiteratureRequest>): Readonly<StandingLiteratureRequest> {
  return Object.freeze({ ...req, active: false });
}

export function assertStandingRequestTenant(req: Readonly<StandingLiteratureRequest>, tenantId: TenantId): void {
  if (req.tenantId !== tenantId) throw new Error('Cross-tenant standing request access denied');
}

export function normalizeStandingRequest(input: StandingLiteratureRequest): Readonly<StandingLiteratureRequest> {
  required(input.id, 'standingRequestId'); required(input.tenantId, 'tenantId');
  required(input.itemCode, 'itemCode'); required(input.requesterId, 'requesterId');
  validateInstant(input.effectiveFrom); validateInstant(input.createdAt);
  if (input.effectiveUntil !== null) validateInstant(input.effectiveUntil);
  return Object.freeze({ ...input });
}

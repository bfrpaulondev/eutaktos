import type { TenantId } from './people';

export type HospitalityRequestId = string;

export type HospitalityStatus = 'pending' | 'assigned' | 'fulfilled' | 'cancelled';

export const HOSPITALITY_STATUSES: readonly HospitalityStatus[] = Object.freeze([
  'pending', 'assigned', 'fulfilled', 'cancelled',] as const);

const VALID_TRANSITIONS: Readonly<Record<HospitalityStatus, readonly HospitalityStatus[]>> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

export interface HospitalityRequest {
  readonly id: HospitalityRequestId;
  readonly tenantId: TenantId;
  readonly meetingReference: string;
  readonly eventReference: string | null;
  readonly date: string;
  readonly requestedCapacity: number;
  readonly assignedHostReferences: readonly string[];
  readonly status: HospitalityStatus;
  readonly createdAt: string;
}

function required(v: string, f: string): string { const n = v.trim(); if (!n) throw new Error(`${f} is required`); return n; }
function validateInstant(v: string): void { if (!Number.isFinite(Date.parse(v))) throw new Error(`Invalid ISO date: ${v}`); }

export function createHospitalityRequest(input: {
  id: HospitalityRequestId; tenantId: TenantId; meetingReference: string;
  eventReference?: string | null; date: string; requestedCapacity: number; now: string;
}): Readonly<HospitalityRequest> {
  validateInstant(input.now); validateInstant(input.date);
  if (!Number.isInteger(input.requestedCapacity) || input.requestedCapacity < 1 || input.requestedCapacity > 500)
    throw new Error('requestedCapacity must be 1-500');

  return Object.freeze({
    id: required(input.id, 'requestId'), tenantId: required(input.tenantId, 'tenantId'),
    meetingReference: required(input.meetingReference, 'meetingReference'),
    eventReference: input.eventReference?.trim() || null,
    date: input.date, requestedCapacity: input.requestedCapacity,
    assignedHostReferences: Object.freeze([]),
    status: 'pending', createdAt: input.now,
  });
}

export function transitionHospitalityStatus(
  req: Readonly<HospitalityRequest>, newStatus: HospitalityStatus,
): Readonly<HospitalityRequest> {
  if (!VALID_TRANSITIONS[req.status].includes(newStatus))
    throw new Error(`Invalid transition: ${req.status} → ${newStatus}`);
  return Object.freeze({ ...req, status: newStatus });
}

export function assignHosts(
  req: Readonly<HospitalityRequest>, hostReferences: readonly string[],
): Readonly<HospitalityRequest> {
  if (req.status !== 'pending' && req.status !== 'assigned') throw new Error('Can only assign hosts to pending or assigned requests');
  if (hostReferences.length === 0) throw new Error('At least one host required');
  if (hostReferences.length > 50) throw new Error('Too many hosts (max 50)');
  return Object.freeze({
    ...req, status: 'assigned',
    assignedHostReferences: Object.freeze(hostReferences.map((h, i) => required(h, `host[${i}]`))),
  });
}

export function assertHospitalityTenant(req: Readonly<HospitalityRequest>, tenantId: TenantId): void {
  if (req.tenantId !== tenantId) throw new Error('Cross-tenant hospitality access denied');
}

export function normalizeHospitalityRequest(input: HospitalityRequest): Readonly<HospitalityRequest> {
  required(input.id, 'requestId'); required(input.tenantId, 'tenantId');
  required(input.meetingReference, 'meetingReference');
  validateInstant(input.date); validateInstant(input.createdAt);
  if (!HOSPITALITY_STATUSES.includes(input.status)) throw new Error(`Invalid status: ${input.status}`);
  return Object.freeze({ ...input, assignedHostReferences: Object.freeze([...input.assignedHostReferences]) });
}

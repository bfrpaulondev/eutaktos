import type { TenantId } from './people';

export type HospitalityRequestId = string;
export type HospitalityStatus = 'pending' | 'assigned' | 'fulfilled' | 'cancelled';
export const HOSPITALITY_STATUSES: readonly HospitalityStatus[] = Object.freeze(['pending', 'assigned', 'fulfilled', 'cancelled'] as const);
const VALID_TRANSITIONS: Readonly<Record<HospitalityStatus, readonly HospitalityStatus[]>> = {
  pending: ['assigned', 'cancelled'], assigned: ['fulfilled', 'cancelled'], fulfilled: [], cancelled: [],
};
export interface HospitalityRequest {
  readonly id: HospitalityRequestId; readonly tenantId: TenantId; readonly meetingReference: string;
  readonly eventReference: string | null; readonly date: string; readonly requestedCapacity: number;
  readonly assignedHostReferences: readonly string[]; readonly status: HospitalityStatus; readonly createdAt: string;
}
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function validateCapacity(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 500) throw new Error('requestedCapacity must be 1-500');
}
function normalizeHosts(values: readonly string[]): readonly string[] {
  if (!Array.isArray(values)) throw new Error('assignedHostReferences must be an array');
  if (values.length > 50) throw new Error('Too many hosts (max 50)');
  return Object.freeze(values.map((value, index) => required(value, `host[${index}]`)));
}
function normalizeEventReference(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return required(value, 'eventReference');
}
export function createHospitalityRequest(input: {
  id: HospitalityRequestId; tenantId: TenantId; meetingReference: string; eventReference?: string | null;
  date: string; requestedCapacity: number; now: string;
}): Readonly<HospitalityRequest> {
  validateInstant(input.now); validateInstant(input.date); validateCapacity(input.requestedCapacity);
  return Object.freeze({
    id: required(input.id, 'requestId'), tenantId: required(input.tenantId, 'tenantId'),
    meetingReference: required(input.meetingReference, 'meetingReference'), eventReference: normalizeEventReference(input.eventReference),
    date: input.date, requestedCapacity: input.requestedCapacity, assignedHostReferences: Object.freeze([]),
    status: 'pending', createdAt: input.now,
  });
}
export function transitionHospitalityStatus(request: Readonly<HospitalityRequest>, newStatus: HospitalityStatus): Readonly<HospitalityRequest> {
  if (!HOSPITALITY_STATUSES.includes(newStatus) || !VALID_TRANSITIONS[request.status]?.includes(newStatus)) {
    throw new Error(`Invalid transition: ${request.status} → ${newStatus}`);
  }
  return Object.freeze({ ...request, status: newStatus });
}
export function assignHosts(request: Readonly<HospitalityRequest>, hostReferences: readonly string[]): Readonly<HospitalityRequest> {
  if (request.status !== 'pending' && request.status !== 'assigned') throw new Error('Can only assign hosts to pending or assigned requests');
  if (hostReferences.length === 0) throw new Error('At least one host required');
  return Object.freeze({ ...request, status: 'assigned', assignedHostReferences: normalizeHosts(hostReferences) });
}
export function assertHospitalityTenant(request: Readonly<HospitalityRequest>, tenantId: TenantId): void {
  if (request.tenantId !== tenantId) throw new Error('Cross-tenant hospitality access denied');
}
export function normalizeHospitalityRequest(input: HospitalityRequest): Readonly<HospitalityRequest> {
  const id = required(input.id, 'requestId'); const tenantId = required(input.tenantId, 'tenantId');
  const meetingReference = required(input.meetingReference, 'meetingReference');
  const eventReference = normalizeEventReference(input.eventReference); validateInstant(input.date); validateInstant(input.createdAt);
  validateCapacity(input.requestedCapacity);
  if (!HOSPITALITY_STATUSES.includes(input.status)) throw new Error(`Invalid status: ${input.status}`);
  return Object.freeze({ ...input, id, tenantId, meetingReference, eventReference, assignedHostReferences: normalizeHosts(input.assignedHostReferences) });
}

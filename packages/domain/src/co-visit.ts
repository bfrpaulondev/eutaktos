import type { TenantId } from './people';

export type VisitId = string;
export interface AgendaSlot { readonly title: string; readonly startsAt: string; readonly endsAt: string; }
export interface COVisit {
  readonly id: VisitId; readonly tenantId: TenantId; readonly startsAt: string; readonly endsAt: string;
  readonly agendaSlots: readonly AgendaSlot[]; readonly locationReference: string;
  readonly eventReferences: readonly string[]; readonly scheduleReferences: readonly string[]; readonly createdAt: string;
}
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function normalizeRefs(values: readonly string[], field: string): readonly string[] {
  if (!Array.isArray(values)) throw new Error(`${field} must be an array`);
  if (values.length > 200) throw new Error(`${field} has too many references (max 200)`);
  return Object.freeze(values.map((value, index) => required(value, `${field}[${index}]`)));
}
function normalizeAgendaSlots(slots: readonly AgendaSlot[], visitStart: string, visitEnd: string): readonly Readonly<AgendaSlot>[] {
  if (!Array.isArray(slots) || slots.length === 0) throw new Error('At least one agenda slot is required');
  if (slots.length > 50) throw new Error('Too many agenda slots (max 50)');
  const start = Date.parse(visitStart); const end = Date.parse(visitEnd);
  return Object.freeze(slots.map((slot, index) => {
    const title = required(slot.title, `agendaSlot[${index}].title`);
    if (title.length > 300) throw new Error(`agendaSlot[${index}].title too long (max 300)`);
    validateInstant(slot.startsAt); validateInstant(slot.endsAt);
    const slotStart = Date.parse(slot.startsAt); const slotEnd = Date.parse(slot.endsAt);
    if (slotEnd <= slotStart) throw new Error(`agendaSlot[${index}]: endsAt must be after startsAt`);
    if (slotStart < start) throw new Error(`Agenda slot "${title}" starts before the visit`);
    if (slotEnd > end) throw new Error(`Agenda slot "${title}" ends after the visit`);
    return Object.freeze({ title, startsAt: slot.startsAt, endsAt: slot.endsAt });
  }));
}
function validateVisitWindow(startsAt: string, endsAt: string): void {
  validateInstant(startsAt); validateInstant(endsAt);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('endsAt must be after startsAt');
}
export function createCOVisit(input: {
  id: VisitId; tenantId: TenantId; startsAt: string; endsAt: string; agendaSlots: readonly AgendaSlot[];
  locationReference: string; eventReferences?: readonly string[]; scheduleReferences?: readonly string[]; now: string;
}): Readonly<COVisit> {
  validateInstant(input.now); validateVisitWindow(input.startsAt, input.endsAt);
  return Object.freeze({
    id: required(input.id, 'visitId'), tenantId: required(input.tenantId, 'tenantId'),
    startsAt: input.startsAt, endsAt: input.endsAt,
    agendaSlots: normalizeAgendaSlots(input.agendaSlots, input.startsAt, input.endsAt),
    locationReference: required(input.locationReference, 'locationReference'),
    eventReferences: normalizeRefs(input.eventReferences ?? [], 'eventReferences'),
    scheduleReferences: normalizeRefs(input.scheduleReferences ?? [], 'scheduleReferences'), createdAt: input.now,
  });
}
export function orderAgendaSlots(visit: Readonly<COVisit>): Readonly<AgendaSlot[]> {
  return [...visit.agendaSlots].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title));
}
export function validateAgendaWithinVisit(visit: Readonly<COVisit>): void {
  validateVisitWindow(visit.startsAt, visit.endsAt);
  normalizeAgendaSlots(visit.agendaSlots, visit.startsAt, visit.endsAt);
}
export function assertCOVisitTenant(visit: Readonly<COVisit>, tenantId: TenantId): void {
  if (visit.tenantId !== tenantId) throw new Error('Cross-tenant CO visit access denied');
}
export function normalizeCOVisit(input: COVisit): Readonly<COVisit> {
  const id = required(input.id, 'visitId'); const tenantId = required(input.tenantId, 'tenantId');
  const locationReference = required(input.locationReference, 'locationReference');
  validateVisitWindow(input.startsAt, input.endsAt); validateInstant(input.createdAt);
  return Object.freeze({
    ...input, id, tenantId, locationReference,
    agendaSlots: normalizeAgendaSlots(input.agendaSlots, input.startsAt, input.endsAt),
    eventReferences: normalizeRefs(input.eventReferences, 'eventReferences'),
    scheduleReferences: normalizeRefs(input.scheduleReferences, 'scheduleReferences'),
  });
}

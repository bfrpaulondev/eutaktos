import type { TenantId } from './people';

export type VisitId = string;

export interface AgendaSlot {
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface COVisit {
  readonly id: VisitId;
  readonly tenantId: TenantId;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly agendaSlots: readonly AgendaSlot[];
  readonly locationReference: string;
  readonly eventReferences: readonly string[];
  readonly scheduleReferences: readonly string[];
  readonly createdAt: string;
}

function required(v: string, f: string): string { const n = v.trim(); if (!n) throw new Error(`${f} is required`); return n; }
function validateInstant(v: string): void { if (!Number.isFinite(Date.parse(v))) throw new Error(`Invalid ISO date: ${v}`); }

export function createCOVisit(input: {
  id: VisitId; tenantId: TenantId; startsAt: string; endsAt: string;
  agendaSlots: readonly AgendaSlot[]; locationReference: string;
  eventReferences?: readonly string[]; scheduleReferences?: readonly string[]; now: string;
}): Readonly<COVisit> {
  validateInstant(input.now); validateInstant(input.startsAt); validateInstant(input.endsAt);
  if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) throw new Error('endsAt must be after startsAt');
  if (input.agendaSlots.length === 0) throw new Error('At least one agenda slot is required');
  if (input.agendaSlots.length > 50) throw new Error('Too many agenda slots (max 50)');

  const validatedSlots = input.agendaSlots.map((s, i) => {
    const title = required(s.title, `agendaSlot[${i}].title`);
    if (title.length > 300) throw new Error(`agendaSlot[${i}].title too long (max 300)`);
    validateInstant(s.startsAt); validateInstant(s.endsAt);
    if (Date.parse(s.endsAt) <= Date.parse(s.startsAt))
      throw new Error(`agendaSlot[${i}]: endsAt must be after startsAt`);
    return Object.freeze({ title, startsAt: s.startsAt, endsAt: s.endsAt });
  });

  return Object.freeze({
    id: required(input.id, 'visitId'),
    tenantId: required(input.tenantId, 'tenantId'),
    startsAt: input.startsAt, endsAt: input.endsAt,
    agendaSlots: Object.freeze(validatedSlots),
    locationReference: required(input.locationReference, 'locationReference'),
    eventReferences: Object.freeze((input.eventReferences ?? []).map((e, i) => required(e, `eventRef[${i}]`))),
    scheduleReferences: Object.freeze((input.scheduleReferences ?? []).map((s, i) => required(s, `scheduleRef[${i}]`))),
    createdAt: input.now,
  });
}

/** Deterministic ordering: slots sorted by startsAt asc */
export function orderAgendaSlots(visit: Readonly<COVisit>): Readonly<AgendaSlot[]> {
  return [...visit.agendaSlots].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Validates that all agenda slots fall within the visit window */
export function validateAgendaWithinVisit(visit: Readonly<COVisit>): void {
  const visitStart = Date.parse(visit.startsAt);
  const visitEnd = Date.parse(visit.endsAt);
  for (const slot of visit.agendaSlots) {
    const slotStart = Date.parse(slot.startsAt);
    const slotEnd = Date.parse(slot.endsAt);
    if (slotStart < visitStart) throw new Error(`Agenda slot "${slot.title}" starts before the visit`);
    if (slotEnd > visitEnd) throw new Error(`Agenda slot "${slot.title}" ends after the visit`);
  }
}

export function assertCOVisitTenant(visit: Readonly<COVisit>, tenantId: TenantId): void {
  if (visit.tenantId !== tenantId) throw new Error('Cross-tenant CO visit access denied');
}

export function normalizeCOVisit(input: COVisit): Readonly<COVisit> {
  required(input.id, 'visitId'); required(input.tenantId, 'tenantId');
  required(input.locationReference, 'locationReference');
  validateInstant(input.startsAt); validateInstant(input.endsAt); validateInstant(input.createdAt);
  if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) throw new Error('endsAt must be after startsAt');
  if (input.agendaSlots.length === 0) throw new Error('At least one agenda slot is required');
  return Object.freeze({ ...input, agendaSlots: Object.freeze([...input.agendaSlots]) });
}

import type { TenantId } from './people';

export type CustomScheduleId = string;

export type ScheduleType = 'memorial' | 'custom_congregation';

export const SCHEDULE_TYPES: readonly ScheduleType[] = Object.freeze([
  'memorial', 'custom_congregation',] as const);

export interface DatedSlot {
  readonly date: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly locationReference: string | null;
}

export interface CustomSchedule {
  readonly id: CustomScheduleId;
  readonly tenantId: TenantId;
  readonly scheduleType: ScheduleType;
  readonly name: string;
  readonly slots: readonly DatedSlot[];
  readonly createdAt: string;
}

function required(v: string, f: string): string { const n = v.trim(); if (!n) throw new Error(`${f} is required`); return n; }
function validateInstant(v: string): void { if (!Number.isFinite(Date.parse(v))) throw new Error(`Invalid ISO date: ${v}`); }

export function createCustomSchedule(input: {
  id: CustomScheduleId; tenantId: TenantId; scheduleType: ScheduleType;
  name: string; slots: readonly DatedSlot[]; now: string;
}): Readonly<CustomSchedule> {
  validateInstant(input.now);
  if (!SCHEDULE_TYPES.includes(input.scheduleType)) throw new Error(`Invalid scheduleType: ${input.scheduleType}`);
  const name = required(input.name, 'name');
  if (name.length > 300) throw new Error('name is too long (max 300)');
  if (input.slots.length === 0) throw new Error('At least one slot is required');
  if (input.slots.length > 100) throw new Error('Too many slots (max 100)');

  const validatedSlots = input.slots.map((s, i) => {
    validateInstant(s.startsAt); validateInstant(s.endsAt);
    if (Date.parse(s.endsAt) <= Date.parse(s.startsAt)) throw new Error(`Slot ${i}: endsAt must be after startsAt`);
    if (s.locationReference?.trim() === '') throw new Error(`Slot ${i}: locationReference must not be blank`);
    return Object.freeze({
      date: s.date, startsAt: s.startsAt, endsAt: s.endsAt,
      locationReference: s.locationReference?.trim() ?? null,
    });
  });

  return Object.freeze({
    id: required(input.id, 'scheduleId'),
    tenantId: required(input.tenantId, 'tenantId'),
    scheduleType: input.scheduleType, name,
    slots: Object.freeze(validatedSlots),
    createdAt: input.now,
  });
}

/** Deterministic ordering: slots sorted by date asc, then startsAt asc */
export function orderScheduleSlots(schedule: Readonly<CustomSchedule>): Readonly<DatedSlot[]> {
  return [...schedule.slots].sort((a, b) => {
    const dd = a.date.localeCompare(b.date);
    if (dd !== 0) return dd;
    return a.startsAt.localeCompare(b.startsAt);
  });
}

export function assertCustomScheduleTenant(schedule: Readonly<CustomSchedule>, tenantId: TenantId): void {
  if (schedule.tenantId !== tenantId) throw new Error('Cross-tenant custom schedule access denied');
}

export function normalizeCustomSchedule(input: CustomSchedule): Readonly<CustomSchedule> {
  required(input.id, 'scheduleId'); required(input.tenantId, 'tenantId');
  required(input.name, 'name'); validateInstant(input.createdAt);
  if (!SCHEDULE_TYPES.includes(input.scheduleType)) throw new Error(`Invalid scheduleType`);
  if (input.slots.length === 0) throw new Error('At least one slot is required');
  return Object.freeze({ ...input, slots: Object.freeze([...input.slots]) });
}

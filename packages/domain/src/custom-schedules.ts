import type { TenantId } from './people';

export type CustomScheduleId = string;
export type ScheduleType = 'memorial' | 'custom_congregation';
export const SCHEDULE_TYPES: readonly ScheduleType[] = Object.freeze(['memorial', 'custom_congregation'] as const);
export interface DatedSlot {
  readonly date: string; readonly startsAt: string; readonly endsAt: string; readonly locationReference: string | null;
}
export interface CustomSchedule {
  readonly id: CustomScheduleId; readonly tenantId: TenantId; readonly scheduleType: ScheduleType;
  readonly name: string; readonly slots: readonly DatedSlot[]; readonly createdAt: string;
}
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function validateDateOnly(value: string, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must be YYYY-MM-DD`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${field} is not a valid calendar date`);
  }
  return value;
}
function normalizeSlots(slots: readonly DatedSlot[]): readonly Readonly<DatedSlot>[] {
  if (!Array.isArray(slots) || slots.length === 0) throw new Error('At least one slot is required');
  if (slots.length > 100) throw new Error('Too many slots (max 100)');
  return Object.freeze(slots.map((slot, index) => {
    const date = validateDateOnly(slot.date, `slot[${index}].date`);
    validateInstant(slot.startsAt); validateInstant(slot.endsAt);
    if (Date.parse(slot.endsAt) <= Date.parse(slot.startsAt)) throw new Error(`Slot ${index}: endsAt must be after startsAt`);
    let locationReference: string | null = null;
    if (slot.locationReference !== null) {
      if (typeof slot.locationReference !== 'string' || !slot.locationReference.trim()) throw new Error(`Slot ${index}: locationReference must not be blank`);
      locationReference = slot.locationReference.trim();
    }
    return Object.freeze({ date, startsAt: slot.startsAt, endsAt: slot.endsAt, locationReference });
  }));
}
export function createCustomSchedule(input: {
  id: CustomScheduleId; tenantId: TenantId; scheduleType: ScheduleType; name: string; slots: readonly DatedSlot[]; now: string;
}): Readonly<CustomSchedule> {
  validateInstant(input.now);
  if (!SCHEDULE_TYPES.includes(input.scheduleType)) throw new Error(`Invalid scheduleType: ${input.scheduleType}`);
  const name = required(input.name, 'name'); if (name.length > 300) throw new Error('name is too long (max 300)');
  return Object.freeze({
    id: required(input.id, 'scheduleId'), tenantId: required(input.tenantId, 'tenantId'),
    scheduleType: input.scheduleType, name, slots: normalizeSlots(input.slots), createdAt: input.now,
  });
}
export function orderScheduleSlots(schedule: Readonly<CustomSchedule>): Readonly<DatedSlot[]> {
  return [...schedule.slots].sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt));
}
export function assertCustomScheduleTenant(schedule: Readonly<CustomSchedule>, tenantId: TenantId): void {
  if (schedule.tenantId !== tenantId) throw new Error('Cross-tenant custom schedule access denied');
}
export function normalizeCustomSchedule(input: CustomSchedule): Readonly<CustomSchedule> {
  const id = required(input.id, 'scheduleId'); const tenantId = required(input.tenantId, 'tenantId');
  const name = required(input.name, 'name'); if (name.length > 300) throw new Error('name is too long (max 300)');
  validateInstant(input.createdAt);
  if (!SCHEDULE_TYPES.includes(input.scheduleType)) throw new Error('Invalid scheduleType');
  return Object.freeze({ ...input, id, tenantId, name, slots: normalizeSlots(input.slots) });
}

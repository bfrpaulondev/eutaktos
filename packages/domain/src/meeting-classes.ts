import type { TenantId } from './people';

// ── Types ──────────────────────────────────────────────────────────────────

export type MeetingClassId = string;
export type MeetingId = string;
export type SlotId = string;
export type LocationId = string;

export type MeetingClassType = 'main' | 'auxiliary';

export interface MeetingClassConfiguration {
  readonly maxStudents?: number;
  readonly [key: string]: unknown;
}

export interface MeetingClass {
  readonly id: MeetingClassId;
  readonly tenantId: TenantId;
  readonly meetingId: MeetingId;
  readonly classType: MeetingClassType;
  readonly locationId?: LocationId;
  readonly configuration: MeetingClassConfiguration;
  readonly slotIds: readonly SlotId[];
  readonly ordering: number;
  readonly createdAt: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ISO date: ${String(value)}`);
  }
}

function assertValidClassType(classType: string): MeetingClassType {
  if (classType !== 'main' && classType !== 'auxiliary') {
    throw new Error(`Invalid meeting class type: ${classType}`);
  }
  return classType;
}

function validateSlotIds(slotIds: readonly SlotId[]): readonly SlotId[] {
  if (!Array.isArray(slotIds)) throw new Error('slotIds must be an array');
  for (const slotId of slotIds) {
    if (typeof slotId !== 'string' || !slotId.trim()) {
      throw new Error('Each slotId must be a non-empty string');
    }
  }
  const trimmed = slotIds.map(s => s.trim());
  const seen = new Set<string>();
  for (const id of trimmed) {
    if (seen.has(id)) throw new Error('Duplicate slot IDs within a class are not allowed');
    seen.add(id);
  }
  return trimmed;
}

function validateConfiguration(configuration?: MeetingClassConfiguration): MeetingClassConfiguration {
  if (configuration === undefined || configuration === null) return Object.freeze({});
  if (typeof configuration !== 'object' || Array.isArray(configuration)) {
    throw new Error('configuration must be an object');
  }
  if (configuration.maxStudents !== undefined) {
    if (typeof configuration.maxStudents !== 'number' || !Number.isInteger(configuration.maxStudents) || configuration.maxStudents < 0) {
      throw new Error('maxStudents must be a non-negative integer');
    }
  }
  return Object.freeze({ ...configuration });
}

// ── Construction ───────────────────────────────────────────────────────────

export interface CreateMeetingClassInput {
  id: MeetingClassId;
  tenantId: TenantId;
  meetingId: MeetingId;
  classType: MeetingClassType;
  locationId?: LocationId;
  configuration?: MeetingClassConfiguration;
  slotIds?: readonly SlotId[];
  ordering: number;
  now: string;
}

export function createMeetingClass(input: CreateMeetingClassInput): Readonly<MeetingClass> {
  validateInstant(input.now);
  const id = required(input.id, 'classId');
  const tenantId = required(input.tenantId, 'tenantId');
  const meetingId = required(input.meetingId, 'meetingId');
  const classType = assertValidClassType(input.classType);
  const ordering = input.ordering;
  if (typeof ordering !== 'number' || !Number.isInteger(ordering) || ordering < 0) {
    throw new Error('ordering must be a non-negative integer');
  }
  if (classType === 'main' && ordering !== 0) {
    throw new Error('Main class must have ordering 0');
  }
  if (classType === 'auxiliary' && ordering < 1) {
    throw new Error('Auxiliary class must have ordering >= 1');
  }
  const locationId = input.locationId?.trim() || undefined;
  const configuration = validateConfiguration(input.configuration);
  const slotIds = Object.freeze(validateSlotIds(input.slotIds ?? []));

  return Object.freeze({
    id,
    tenantId,
    meetingId,
    classType,
    ...(locationId ? { locationId } : {}),
    configuration,
    slotIds,
    ordering,
    createdAt: input.now,
  });
}

// ── Convenience factories ──────────────────────────────────────────────────

export function createMainClass(
  meetingId: MeetingId,
  tenantId: TenantId,
  now: string,
): Readonly<MeetingClass> {
  return createMeetingClass({
    id: `main:${meetingId}`,
    tenantId,
    meetingId,
    classType: 'main',
    ordering: 0,
    now,
  });
}

export function createAuxiliaryClass(
  meetingId: MeetingId,
  tenantId: TenantId,
  ordering: number,
  now: string,
): Readonly<MeetingClass> {
  return createMeetingClass({
    id: `aux:${meetingId}:${ordering}`,
    tenantId,
    meetingId,
    classType: 'auxiliary',
    ordering,
    now,
  });
}

// ── Slot associations ──────────────────────────────────────────────────────

export function assignSlotToClass(
  meetingClass: Readonly<MeetingClass>,
  slotId: SlotId,
): Readonly<MeetingClass> {
  const normalizedSlotId = required(slotId, 'slotId');
  if (meetingClass.slotIds.includes(normalizedSlotId)) {
    throw new Error('Slot is already assigned to this class');
  }
  return Object.freeze({
    ...meetingClass,
    slotIds: Object.freeze([...meetingClass.slotIds, normalizedSlotId]),
  });
}

export function removeSlotFromClass(
  meetingClass: Readonly<MeetingClass>,
  slotId: SlotId,
): Readonly<MeetingClass> {
  const normalizedSlotId = required(slotId, 'slotId');
  if (!meetingClass.slotIds.includes(normalizedSlotId)) {
    throw new Error('Slot is not assigned to this class');
  }
  return Object.freeze({
    ...meetingClass,
    slotIds: Object.freeze(meetingClass.slotIds.filter(id => id !== normalizedSlotId)),
  });
}

// ── Tenant isolation ───────────────────────────────────────────────────────

export function assertClassTenant(
  meetingClass: Readonly<MeetingClass>,
  tenantId: TenantId,
): void {
  required(tenantId, 'tenantId');
  if (meetingClass.tenantId !== tenantId) {
    throw new Error('Cross-tenant meeting class access denied');
  }
}

// ── Validation ─────────────────────────────────────────────────────────────

export function validateNoSlotOverlap(
  classes: readonly Readonly<MeetingClass>[],
): void {
  const seen = new Map<string, MeetingClassId>();
  for (const meetingClass of classes) {
    for (const slotId of meetingClass.slotIds) {
      const existingClassId = seen.get(slotId);
      if (existingClassId !== undefined) {
        throw new Error(
          `Slot '${slotId}' is assigned to multiple classes: ${existingClassId} and ${meetingClass.id}`,
        );
      }
      seen.set(slotId, meetingClass.id);
    }
  }
}

// ── Query helpers ──────────────────────────────────────────────────────────

export function findMainClass(
  classes: readonly Readonly<MeetingClass>[],
): Readonly<MeetingClass> | undefined {
  return classes.find(c => c.classType === 'main');
}

export function filterAuxiliaryClasses(
  classes: readonly Readonly<MeetingClass>[],
): readonly Readonly<MeetingClass>[] {
  return classes.filter(c => c.classType === 'auxiliary');
}

export function orderClassesByOrdering(
  classes: readonly Readonly<MeetingClass>[],
): readonly Readonly<MeetingClass>[] {
  return [...classes].sort((a, b) => a.ordering - b.ordering);
}

export function totalCapacity(
  classes: readonly Readonly<MeetingClass>[],
): number {
  return classes.reduce((sum, c) => sum + (c.configuration.maxStudents ?? 0), 0);
}

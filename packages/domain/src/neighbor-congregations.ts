import type { TenantId, PersonId } from './people';
import type { Weekday } from './congregation';

// ── Types ──────────────────────────────────────────────────────────────

export type NeighborCongregationId = string;
export type ExternalReferenceId = string;
export type NeighborKind = 'nearby' | 'regional' | 'long-distance';
export const NEIGHBOR_KINDS: readonly NeighborKind[] = Object.freeze([
  'nearby',
  'regional',
  'long-distance',
] as const);

export interface NeighborCongregation {
  readonly id: NeighborCongregationId;
  readonly tenantId: TenantId;
  readonly externalReferenceId: ExternalReferenceId | null;
  readonly name: string;
  readonly meetingLocation: string | null;
  readonly meetingDay: Weekday;
  readonly meetingTime: string; // HH:mm
  readonly timezone: string; // IANA
  readonly language: string; // BCP 47
  readonly active: boolean;
  readonly contactPersonId: PersonId | null;
  readonly notes: string;
  readonly kind: NeighborKind;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NeighborCongregationInput {
  readonly id: NeighborCongregationId;
  readonly tenantId: TenantId;
  readonly externalReferenceId?: ExternalReferenceId | null;
  readonly name: string;
  readonly meetingLocation?: string | null;
  readonly meetingDay: Weekday;
  readonly meetingTime: string;
  readonly timezone: string;
  readonly language: string;
  readonly contactPersonId?: PersonId | null;
  readonly notes?: string;
  readonly kind: NeighborKind;
  readonly now: string;
}

export interface NeighborCongregationChanges {
  readonly name?: string;
  readonly meetingLocation?: string | null;
  readonly meetingDay?: Weekday;
  readonly meetingTime?: string;
  readonly timezone?: string;
  readonly language?: string;
  readonly contactPersonId?: PersonId | null;
  readonly notes?: string;
  readonly kind?: NeighborKind;
  readonly externalReferenceId?: ExternalReferenceId | null;
}

// ── Internal helpers ────────────────────────────────────────────────────

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ISO date: ${String(value)}`);
  }
}

function validateTimezone(value: string): string {
  const tz = required(value, 'timezone');
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz }).format(new Date(0));
  } catch {
    throw new Error('timezone must be a valid IANA timezone');
  }
  return tz;
}

function validateLanguage(value: string): string {
  const lang = required(value, 'language');
  try {
    Intl.getCanonicalLocales(lang);
  } catch {
    throw new Error('language must be a valid BCP 47 language tag');
  }
  return lang;
}

function validateWeekday(value: number): Weekday {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    throw new Error('meetingDay must be between 0 and 6');
  }
  return value as Weekday;
}

function validateMeetingTime(value: string): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim())) {
    throw new Error('meetingTime must use 24-hour HH:mm format');
  }
  return value.trim();
}

function validateKind(value: string): NeighborKind {
  if (!NEIGHBOR_KINDS.includes(value as NeighborKind)) {
    throw new Error(`kind must be one of: ${NEIGHBOR_KINDS.join(', ')}`);
  }
  return value as NeighborKind;
}

function validateNotes(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error('notes must be a string');
  const trimmed = value.trim();
  if (trimmed.length > 500) throw new Error('notes must be at most 500 characters');
  return trimmed;
}

function validateMeetingLocation(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('meetingLocation must be a string or null');
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  if (normalized.length > 300) throw new Error('meetingLocation must be at most 300 characters');
  return normalized;
}

function validateExternalReferenceId(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('externalReferenceId must be a string or null');
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function validateContactPersonId(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('contactPersonId must be a string or null');
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

// ── Public API ──────────────────────────────────────────────────────────

export function validateNeighborCongregation(input: NeighborCongregationInput): void {
  required(input.id, 'id');
  required(input.tenantId, 'tenantId');
  required(input.name, 'name');
  validateWeekday(input.meetingDay);
  validateMeetingTime(input.meetingTime);
  validateTimezone(input.timezone);
  validateLanguage(input.language);
  validateKind(input.kind);
  validateNotes(input.notes);
  validateMeetingLocation(input.meetingLocation);
  validateContactPersonId(input.contactPersonId);
  validateExternalReferenceId(input.externalReferenceId);
  validateInstant(input.now);
}

export function createNeighborCongregation(input: NeighborCongregationInput): Readonly<NeighborCongregation> {
  const id = required(input.id, 'id');
  const tenantId = required(input.tenantId, 'tenantId');
  const name = required(input.name, 'name');
  const meetingDay = validateWeekday(input.meetingDay);
  const meetingTime = validateMeetingTime(input.meetingTime);
  const timezone = validateTimezone(input.timezone);
  const language = validateLanguage(input.language);
  const kind = validateKind(input.kind);
  const notes = validateNotes(input.notes);
  const meetingLocation = validateMeetingLocation(input.meetingLocation);
  const contactPersonId = validateContactPersonId(input.contactPersonId);
  const externalReferenceId = validateExternalReferenceId(input.externalReferenceId);
  validateInstant(input.now);

  return Object.freeze({
    id,
    tenantId,
    externalReferenceId,
    name,
    meetingLocation,
    meetingDay,
    meetingTime,
    timezone,
    language,
    active: true,
    contactPersonId,
    notes,
    kind,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function updateNeighborCongregation(
  congregation: Readonly<NeighborCongregation>,
  changes: NeighborCongregationChanges,
  now: string,
): Readonly<NeighborCongregation> {
  validateInstant(now);

  const updated = {
    ...congregation,
    name: changes.name !== undefined ? required(changes.name, 'name') : congregation.name,
    meetingLocation: changes.meetingLocation !== undefined
      ? validateMeetingLocation(changes.meetingLocation)
      : congregation.meetingLocation,
    meetingDay: changes.meetingDay !== undefined
      ? validateWeekday(changes.meetingDay)
      : congregation.meetingDay,
    meetingTime: changes.meetingTime !== undefined
      ? validateMeetingTime(changes.meetingTime)
      : congregation.meetingTime,
    timezone: changes.timezone !== undefined
      ? validateTimezone(changes.timezone)
      : congregation.timezone,
    language: changes.language !== undefined
      ? validateLanguage(changes.language)
      : congregation.language,
    contactPersonId: changes.contactPersonId !== undefined
      ? validateContactPersonId(changes.contactPersonId)
      : congregation.contactPersonId,
    notes: changes.notes !== undefined
      ? validateNotes(changes.notes)
      : congregation.notes,
    kind: changes.kind !== undefined
      ? validateKind(changes.kind)
      : congregation.kind,
    externalReferenceId: changes.externalReferenceId !== undefined
      ? validateExternalReferenceId(changes.externalReferenceId)
      : congregation.externalReferenceId,
    updatedAt: now,
  };

  return Object.freeze(updated);
}

export function deactivateNeighborCongregation(
  congregation: Readonly<NeighborCongregation>,
  now: string,
): Readonly<NeighborCongregation> {
  validateInstant(now);
  if (!congregation.active) return congregation;
  return Object.freeze({ ...congregation, active: false, updatedAt: now });
}

export function activateNeighborCongregation(
  congregation: Readonly<NeighborCongregation>,
  now: string,
): Readonly<NeighborCongregation> {
  validateInstant(now);
  if (congregation.active) return congregation;
  return Object.freeze({ ...congregation, active: true, updatedAt: now });
}

export function assertNeighborCongregationTenant(
  congregation: Readonly<NeighborCongregation>,
  tenantId: TenantId,
): void {
  if (congregation.tenantId !== tenantId) {
    throw new Error('Cross-tenant neighbor congregation access denied');
  }
}

export function filterNeighborCongregationsByTenant(
  congregations: readonly Readonly<NeighborCongregation>[],
  tenantId: TenantId,
): readonly Readonly<NeighborCongregation>[] {
  return congregations.filter(c => c.tenantId === tenantId);
}

export function filterActiveNeighborCongregations(
  congregations: readonly Readonly<NeighborCongregation>[],
): readonly Readonly<NeighborCongregation>[] {
  return congregations.filter(c => c.active);
}

export function filterByKind(
  congregations: readonly Readonly<NeighborCongregation>[],
  kind: NeighborKind,
): readonly Readonly<NeighborCongregation>[] {
  return congregations.filter(c => c.kind === kind);
}

export function filterByLanguage(
  congregations: readonly Readonly<NeighborCongregation>[],
  language: string,
): readonly Readonly<NeighborCongregation>[] {
  return congregations.filter(c => c.language === language);
}

export function orderByName(
  congregations: readonly Readonly<NeighborCongregation>[],
): readonly Readonly<NeighborCongregation>[] {
  return [...congregations].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  );
}

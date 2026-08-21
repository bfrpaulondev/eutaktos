import type { TenantId, PersonId } from './people';

export type PublicSpeakerId = string;
export type CongregationId = string;

export interface PublicSpeakerInput {
  id: PublicSpeakerId;
  tenantId: TenantId;
  personId?: PersonId;
  name: string;
  congregationId: CongregationId;
  isVisiting: boolean;
  active?: boolean;
  notes?: string;
  preferredLanguage?: string;
}

export interface PublicSpeakerChanges {
  personId?: PersonId | undefined;
  name?: string;
  congregationId?: CongregationId;
  isVisiting?: boolean;
  notes?: string;
  preferredLanguage?: string;
}

export interface PublicSpeaker {
  readonly id: PublicSpeakerId;
  readonly tenantId: TenantId;
  readonly personId: PersonId | undefined;
  readonly name: string;
  readonly congregationId: CongregationId;
  readonly isVisiting: boolean;
  readonly active: boolean;
  readonly notes: string;
  readonly preferredLanguage: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---- internal helpers ----

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

function validateOptionalLength(value: string | undefined, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim().replace(/\s+/g, ' ');
  if (trimmed.length > max) throw new Error(`${field} is too long (max ${max})`);
  return trimmed || undefined;
}

function validateName(name: string): string {
  const normalized = required(name, 'name');
  if (normalized.length > 200) throw new Error('name is too long (max 200)');
  return normalized;
}

// ---- public API ----

export function validatePublicSpeaker(input: PublicSpeakerInput): void {
  required(input.id, 'id');
  required(input.tenantId, 'tenantId');
  validateName(input.name);
  required(input.congregationId, 'congregationId');
  if (typeof input.isVisiting !== 'boolean') throw new Error('isVisiting must be a boolean');
  if (input.active !== undefined && typeof input.active !== 'boolean') {
    throw new Error('active must be a boolean');
  }
  validateOptionalLength(input.notes, 'notes', 1000);
  validateOptionalLength(input.preferredLanguage, 'preferredLanguage', 50);
}

export function createPublicSpeaker(input: PublicSpeakerInput, now: string): Readonly<PublicSpeaker> {
  validateInstant(now);
  validatePublicSpeaker(input);

  const personId = input.personId !== undefined ? required(input.personId, 'personId') : undefined;
  const name = validateName(input.name);
  const congregationId = required(input.congregationId, 'congregationId');
  const active = input.active !== undefined ? input.active : true;
  const notes = validateOptionalLength(input.notes, 'notes', 1000) ?? '';
  const preferredLanguage = validateOptionalLength(input.preferredLanguage, 'preferredLanguage', 50);

  return Object.freeze({
    id: required(input.id, 'id'),
    tenantId: required(input.tenantId, 'tenantId'),
    personId,
    name,
    congregationId,
    isVisiting: input.isVisiting,
    active,
    notes,
    preferredLanguage,
    createdAt: now,
    updatedAt: now,
  });
}

export function updatePublicSpeaker(
  speaker: Readonly<PublicSpeaker>,
  changes: PublicSpeakerChanges,
  now: string,
): Readonly<PublicSpeaker> {
  validateInstant(now);

  return Object.freeze({
    ...speaker,
    ...(changes.personId !== undefined ? { personId: required(changes.personId, 'personId') } : {}),
    ...(changes.name !== undefined ? { name: validateName(changes.name) } : {}),
    ...(changes.congregationId !== undefined ? { congregationId: required(changes.congregationId, 'congregationId') } : {}),
    ...(changes.isVisiting !== undefined ? { isVisiting: changes.isVisiting } : {}),
    ...(changes.notes !== undefined ? { notes: validateOptionalLength(changes.notes, 'notes', 1000) ?? '' } : {}),
    ...(changes.preferredLanguage !== undefined ? { preferredLanguage: validateOptionalLength(changes.preferredLanguage, 'preferredLanguage', 50) } : {}),
    updatedAt: now,
  });
}

export function deactivatePublicSpeaker(
  speaker: Readonly<PublicSpeaker>,
  now: string,
): Readonly<PublicSpeaker> {
  validateInstant(now);
  if (!speaker.active) return speaker;
  return Object.freeze({ ...speaker, active: false, updatedAt: now });
}

export function activatePublicSpeaker(
  speaker: Readonly<PublicSpeaker>,
  now: string,
): Readonly<PublicSpeaker> {
  validateInstant(now);
  if (speaker.active) return speaker;
  return Object.freeze({ ...speaker, active: true, updatedAt: now });
}

export function assertSpeakerTenant(
  speaker: Readonly<PublicSpeaker>,
  tenantId: TenantId,
): void {
  if (speaker.tenantId !== tenantId) {
    throw new Error('Cross-tenant speaker access denied');
  }
}

export function filterSpeakersByTenant(
  speakers: readonly Readonly<PublicSpeaker>[],
  tenantId: TenantId,
): readonly Readonly<PublicSpeaker>[] {
  return speakers.filter(s => s.tenantId === tenantId);
}

export function filterActiveSpeakers(
  speakers: readonly Readonly<PublicSpeaker>[],
): readonly Readonly<PublicSpeaker>[] {
  return speakers.filter(s => s.active);
}

export function filterVisitingSpeakers(
  speakers: readonly Readonly<PublicSpeaker>[],
): readonly Readonly<PublicSpeaker>[] {
  return speakers.filter(s => s.isVisiting);
}

export function filterLocalSpeakers(
  speakers: readonly Readonly<PublicSpeaker>[],
): readonly Readonly<PublicSpeaker>[] {
  return speakers.filter(s => !s.isVisiting);
}

import type { EntityRow } from './_db';

export class InvalidStoredDataError extends Error {}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidStoredDataError('Invalid stored entity');
  return value as Readonly<Record<string, unknown>>;
}

function storedString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new InvalidStoredDataError('Invalid stored entity');
  return value;
}

function storedStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.trim().length > 0)) {
    throw new InvalidStoredDataError('Invalid stored entity');
  }
  return Object.freeze([...value]);
}

function entityData(row: EntityRow, tenantId: string): Readonly<Record<string, unknown>> {
  if (row.tenant_id !== tenantId) throw new InvalidStoredDataError('Cross-tenant stored entity');
  const data = record(row.data);
  if (data.tenantId !== tenantId || data.id !== row.entity_id) throw new InvalidStoredDataError('Stored entity identity mismatch');
  return data;
}

export interface PersonDto { id: string; displayName: string; preferredLocale?: string; active: boolean; labels?: readonly string[] }
export function personDto(row: EntityRow, tenantId: string): PersonDto {
  const data = entityData(row, tenantId);
  if (typeof data.active !== 'boolean') throw new InvalidStoredDataError('Invalid stored person');
  if (data.preferredLocale !== undefined && typeof data.preferredLocale !== 'string') throw new InvalidStoredDataError('Invalid stored person');
  if (data.labels !== undefined && (!Array.isArray(data.labels) || !data.labels.every(item => typeof item === 'string' && item.trim().length > 0))) throw new InvalidStoredDataError('Invalid stored person');
  const labels = data.labels === undefined ? undefined : storedStringArray(data.labels);
  return Object.freeze({
    id: storedString(data.id),
    displayName: storedString(data.displayName),
    ...(typeof data.preferredLocale === 'string' ? { preferredLocale: data.preferredLocale } : {}),
    active: data.active,
    ...(labels?.length ? { labels } : {}),
  });
}

export interface HouseholdDto { id: string; name: string; memberIds: readonly string[] }
export function householdDto(row: EntityRow, tenantId: string): HouseholdDto {
  const data = entityData(row, tenantId);
  return Object.freeze({ id: storedString(data.id), name: storedString(data.name), memberIds: storedStringArray(data.memberIds) });
}

export interface ServiceGroupDto { id: string; name: string; memberIds: readonly string[]; overseerId?: string; assistantId?: string }
export function serviceGroupDto(row: EntityRow, tenantId: string): ServiceGroupDto {
  const data = entityData(row, tenantId);
  if (data.overseerId !== undefined && typeof data.overseerId !== 'string') throw new InvalidStoredDataError('Invalid stored service group');
  if (data.assistantId !== undefined && typeof data.assistantId !== 'string') throw new InvalidStoredDataError('Invalid stored service group');
  return Object.freeze({
    id: storedString(data.id),
    name: storedString(data.name),
    memberIds: storedStringArray(data.memberIds),
    ...(typeof data.overseerId === 'string' ? { overseerId: data.overseerId } : {}),
    ...(typeof data.assistantId === 'string' ? { assistantId: data.assistantId } : {}),
  });
}

export interface ResponsibilityDto { id: string; personId: string; responsibilityKey: string; startsAt: string; endsAt?: string }
export function responsibilityDto(row: EntityRow, tenantId: string): ResponsibilityDto {
  const data = entityData(row, tenantId);
  if (data.endsAt !== undefined && typeof data.endsAt !== 'string') throw new InvalidStoredDataError('Invalid stored responsibility');
  return Object.freeze({
    id: storedString(data.id),
    personId: storedString(data.personId),
    responsibilityKey: storedString(data.responsibilityKey),
    startsAt: storedString(data.startsAt),
    ...(typeof data.endsAt === 'string' ? { endsAt: data.endsAt } : {}),
  });
}

import type { PersonId, TenantId } from './people';

export interface PeopleMapLocation {
  readonly tenantId: TenantId;
  readonly personId: PersonId;
  readonly latitude: number;
  readonly longitude: number;
  readonly precision: 'approximate';
  readonly source: 'manual';
  readonly updatedAt: string;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function coordinate(value: number, field: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${field} is invalid`);
  const normalized = Math.round((value + Math.sign(value || 1) * Number.EPSILON) * 100) / 100;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function instant(value: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error('updatedAt is invalid');
  return value;
}

export function createPeopleMapLocation(input: Readonly<{
  tenantId: TenantId;
  personId: PersonId;
  latitude: number;
  longitude: number;
  updatedAt: string;
}>): Readonly<PeopleMapLocation> {
  return Object.freeze({
    tenantId: required(input.tenantId, 'tenantId'),
    personId: required(input.personId, 'personId'),
    latitude: coordinate(input.latitude, 'latitude', -90, 90),
    longitude: coordinate(input.longitude, 'longitude', -180, 180),
    precision: 'approximate',
    source: 'manual',
    updatedAt: instant(input.updatedAt),
  });
}

export function validateStoredPeopleMapLocation(value: Readonly<PeopleMapLocation>): Readonly<PeopleMapLocation> {
  const normalized = createPeopleMapLocation(value);
  if (
    value.latitude !== normalized.latitude ||
    value.longitude !== normalized.longitude ||
    value.precision !== 'approximate' ||
    value.source !== 'manual'
  ) {
    throw new Error('Stored People map location is invalid');
  }
  return normalized;
}

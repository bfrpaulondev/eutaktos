import type { PersonId, TenantId } from './people';

export type PeopleMapLocationId = string;
export type PeopleMapPrecision = 'area-1km';

export interface PeopleMapLocation {
  readonly id: PeopleMapLocationId;
  readonly tenantId: TenantId;
  readonly personId: PersonId;
  readonly latitude: number;
  readonly longitude: number;
  readonly precision: PeopleMapPrecision;
  readonly updatedAt: string;
}

function finiteCoordinate(value: number, field: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${field} is invalid`);
  return value;
}

function approximate(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function peopleMapLocationId(personId: PersonId): PeopleMapLocationId {
  const normalized = personId.trim();
  if (!normalized || normalized.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) throw new Error('personId is invalid');
  return `people-map-location-${normalized}`;
}

export function createPeopleMapLocation(input: Readonly<{
  tenantId: TenantId;
  personId: PersonId;
  latitude: number;
  longitude: number;
  updatedAt: string;
}>): Readonly<PeopleMapLocation> {
  const tenantId = input.tenantId.trim();
  const personId = input.personId.trim();
  if (!tenantId) throw new Error('tenantId is required');
  const id = peopleMapLocationId(personId);
  const timestamp = Date.parse(input.updatedAt);
  if (!Number.isFinite(timestamp)) throw new Error('updatedAt is invalid');
  const latitude = approximate(finiteCoordinate(input.latitude, 'latitude', -90, 90));
  const longitude = approximate(finiteCoordinate(input.longitude, 'longitude', -180, 180));
  return Object.freeze({ id, tenantId, personId, latitude, longitude, precision: 'area-1km', updatedAt: input.updatedAt });
}

export function validateStoredPeopleMapLocation(value: Readonly<PeopleMapLocation>): Readonly<PeopleMapLocation> {
  const normalized = createPeopleMapLocation(value);
  if (value.id !== normalized.id || value.precision !== 'area-1km' || value.latitude !== normalized.latitude || value.longitude !== normalized.longitude) {
    throw new Error('Stored People map location is invalid');
  }
  return normalized;
}

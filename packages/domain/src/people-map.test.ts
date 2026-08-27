import { describe, expect, it } from 'vitest';
import { createPeopleMapLocation, peopleMapLocationId, validateStoredPeopleMapLocation } from './people-map';

describe('People map location', () => {
  it('stores only approximate area coordinates', () => {
    expect(createPeopleMapLocation({ tenantId: 'tenant-a', personId: 'person-1', latitude: 38.7222524, longitude: -9.1393366, updatedAt: '2026-08-27T13:00:00.000Z' })).toEqual({
      id: 'people-map-location-person-1',
      tenantId: 'tenant-a',
      personId: 'person-1',
      latitude: 38.72,
      longitude: -9.14,
      precision: 'area-1km',
      updatedAt: '2026-08-27T13:00:00.000Z',
    });
  });

  it('rejects invalid identities and coordinates', () => {
    expect(() => peopleMapLocationId('bad/person')).toThrow('personId is invalid');
    expect(() => createPeopleMapLocation({ tenantId: 'tenant-a', personId: 'person-1', latitude: 91, longitude: 0, updatedAt: '2026-08-27T13:00:00.000Z' })).toThrow('latitude is invalid');
    expect(() => createPeopleMapLocation({ tenantId: 'tenant-a', personId: 'person-1', latitude: 0, longitude: -181, updatedAt: '2026-08-27T13:00:00.000Z' })).toThrow('longitude is invalid');
  });

  it('fails closed when stored coordinates contain greater precision', () => {
    expect(() => validateStoredPeopleMapLocation({ id: 'people-map-location-person-1', tenantId: 'tenant-a', personId: 'person-1', latitude: 38.721, longitude: -9.139, precision: 'area-1km', updatedAt: '2026-08-27T13:00:00.000Z' })).toThrow('Stored People map location is invalid');
  });
});
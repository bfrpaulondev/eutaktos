import { describe, expect, it } from 'vitest';
import { createPeopleMapLocation, validateStoredPeopleMapLocation } from './people-map';

describe('People map location', () => {
  it('normalizes coordinates to the approved approximate manual shape', () => {
    expect(createPeopleMapLocation({
      tenantId: 'tenant-a',
      personId: 'person-1',
      latitude: 38.7222524,
      longitude: -9.1393366,
      updatedAt: '2026-08-27T13:00:00.000Z',
    })).toEqual({
      tenantId: 'tenant-a',
      personId: 'person-1',
      latitude: 38.72,
      longitude: -9.14,
      precision: 'approximate',
      source: 'manual',
      updatedAt: '2026-08-27T13:00:00.000Z',
    });
  });

  it('rejects invalid identities, coordinates and timestamps', () => {
    expect(() => createPeopleMapLocation({ tenantId: '', personId: 'person-1', latitude: 0, longitude: 0, updatedAt: '2026-08-27T13:00:00.000Z' })).toThrow('tenantId is required');
    expect(() => createPeopleMapLocation({ tenantId: 'tenant-a', personId: '', latitude: 0, longitude: 0, updatedAt: '2026-08-27T13:00:00.000Z' })).toThrow('personId is required');
    expect(() => createPeopleMapLocation({ tenantId: 'tenant-a', personId: 'person-1', latitude: 91, longitude: 0, updatedAt: '2026-08-27T13:00:00.000Z' })).toThrow('latitude is invalid');
    expect(() => createPeopleMapLocation({ tenantId: 'tenant-a', personId: 'person-1', latitude: 0, longitude: -181, updatedAt: '2026-08-27T13:00:00.000Z' })).toThrow('longitude is invalid');
    expect(() => createPeopleMapLocation({ tenantId: 'tenant-a', personId: 'person-1', latitude: 0, longitude: 0, updatedAt: 'not-a-date' })).toThrow('updatedAt is invalid');
  });

  it('fails closed when stored data exceeds approved precision or changes provenance', () => {
    expect(() => validateStoredPeopleMapLocation({
      tenantId: 'tenant-a', personId: 'person-1', latitude: 38.721, longitude: -9.139,
      precision: 'approximate', source: 'manual', updatedAt: '2026-08-27T13:00:00.000Z',
    })).toThrow('Stored People map location is invalid');

    expect(() => validateStoredPeopleMapLocation({
      tenantId: 'tenant-a', personId: 'person-1', latitude: 38.72, longitude: -9.14,
      precision: 'approximate', source: 'automatic' as never, updatedAt: '2026-08-27T13:00:00.000Z',
    })).toThrow('Stored People map location is invalid');
  });

  it('normalizes negative zero for stable idempotent persistence', () => {
    const value = createPeopleMapLocation({ tenantId: 'tenant-a', personId: 'person-1', latitude: -0.0001, longitude: -0.0001, updatedAt: '2026-08-27T13:00:00.000Z' });
    expect(Object.is(value.latitude, -0)).toBe(false);
    expect(Object.is(value.longitude, -0)).toBe(false);
    expect(value.latitude).toBe(0);
    expect(value.longitude).toBe(0);
  });
});

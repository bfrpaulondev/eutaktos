import { describe, expect, it } from 'vitest';
import { projectPeopleMap } from './map';

describe('People Map read projection', () => {
  it('returns only opaque identity, display name and approximate coordinates in deterministic order', () => {
    const result = projectPeopleMap([
      { personId: 'person-b', displayName: 'Bruno', latitude: 40.21, longitude: -8.41 },
      { personId: 'person-a', displayName: 'Ana', latitude: 38.72, longitude: -9.14 },
    ]);
    expect(result).toEqual({ contractVersion: 'people-map-v1', points: [
      { personId: 'person-a', displayName: 'Ana', latitude: 38.72, longitude: -9.14 },
      { personId: 'person-b', displayName: 'Bruno', latitude: 40.21, longitude: -8.41 },
    ] });
    const publicJson = JSON.stringify(result);
    for (const forbidden of ['tenantId','actorId','phone','email','address','ordinaryContact','emergencyContacts','eligibility','availability','labels','responsibilities','externalIds','updatedAt','source','precision']) {
      expect(publicJson).not.toContain(forbidden);
    }
  });
});

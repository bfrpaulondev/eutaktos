import { describe, expect, it } from 'vitest';
import { type VerifiedPrincipal } from '../_auth';
import { projectPeopleMap, requirePeopleMapRead } from './map';

const principal = (capabilities: readonly string[]): VerifiedPrincipal => ({
  tenantId: 'tenant-a', actorId: 'actor-a', sessionId: 'session-a', capabilities: capabilities as VerifiedPrincipal['capabilities'],
});

describe('People Map read projection', () => {
  it('requires both people.read and explicit map.read before any projection', () => {
    expect(() => requirePeopleMapRead(principal(['people.read']))).toThrow('Forbidden');
    expect(() => requirePeopleMapRead(principal(['map.read']))).toThrow('Forbidden');
    expect(() => requirePeopleMapRead(principal(['people.read', 'tenant.manage']))).toThrow('Forbidden');
    expect(() => requirePeopleMapRead(principal(['people.read', 'map.read']))).not.toThrow();
  });

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

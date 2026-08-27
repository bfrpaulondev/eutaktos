import { describe, expect, it } from 'vitest';
import { type VerifiedPrincipal } from '../_auth';
import { parsePeopleMapLocationBody, requirePeopleMapWrite } from './[personId]/map-location';

const principal = (capabilities: readonly string[]): VerifiedPrincipal => ({
  tenantId: 'tenant-a', actorId: 'actor-a', sessionId: 'session-a', capabilities: capabilities as VerifiedPrincipal['capabilities'],
});

describe('People Map location mutation contract', () => {
  it('requires explicit map.write and does not infer it from general capabilities', () => {
    expect(() => requirePeopleMapWrite(principal(['people.write']))).toThrow('Forbidden');
    expect(() => requirePeopleMapWrite(principal(['tenant.manage', 'people.write']))).toThrow('Forbidden');
    expect(() => requirePeopleMapWrite(principal(['map.write']))).not.toThrow();
  });

  it('accepts only finite coordinate values inside the approved global bounds', () => {
    expect(parsePeopleMapLocationBody({ latitude: 38.520123, longitude: -8.890456 })).toEqual({
      latitude: 38.520123,
      longitude: -8.890456,
    });
    expect(parsePeopleMapLocationBody(JSON.stringify({ latitude: -90, longitude: 180 }))).toEqual({ latitude: -90, longitude: 180 });
  });

  it('rejects missing, invalid, out-of-bounds and additional authority fields', () => {
    for (const body of [
      {},
      { latitude: '38.52', longitude: -8.89 },
      { latitude: Number.NaN, longitude: -8.89 },
      { latitude: 90.01, longitude: -8.89 },
      { latitude: 38.52, longitude: -180.01 },
      { latitude: 38.52, longitude: -8.89, tenantId: 'browser-tenant' },
      { latitude: 38.52, longitude: -8.89, actorId: 'browser-actor' },
      { latitude: 38.52, longitude: -8.89, capabilities: ['map.write'] },
      { latitude: 38.52, longitude: -8.89, source: 'automatic' },
      { latitude: 38.52, longitude: -8.89, precision: 'exact' },
    ]) {
      expect(() => parsePeopleMapLocationBody(body)).toThrow();
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { VerifiedPrincipal } from '../_auth';
import { projectPhotonResponse, requirePeopleMapSearch, searchPeopleMapPlaces } from './map-search';

const principal = (capabilities: readonly string[]): VerifiedPrincipal => ({
  tenantId: 'tenant-a', actorId: 'actor-a', sessionId: 'session-a', capabilities: capabilities as VerifiedPrincipal['capabilities'],
});

describe('People Map place search', () => {
  it('requires both explicit People write and Map write authority', () => {
    expect(() => requirePeopleMapSearch(principal(['people.write']))).toThrow('Forbidden');
    expect(() => requirePeopleMapSearch(principal(['map.write']))).toThrow('Forbidden');
    expect(() => requirePeopleMapSearch(principal(['people.write', 'tenant.manage']))).toThrow('Forbidden');
    expect(() => requirePeopleMapSearch(principal(['people.write', 'map.write']))).not.toThrow();
  });

  it('projects only an ephemeral label and coordinates from provider output', () => {
    const result = projectPhotonResponse({ features: [
      { geometry: { type: 'Point', coordinates: [-8.892, 38.521] }, properties: { name: 'Avenida Example', postcode: '2900-000', city: 'Setúbal', country: 'Portugal', osm_id: 12345, extent: [-9, 38, -8, 39] } },
      { geometry: { type: 'LineString', coordinates: [] }, properties: { name: 'ignored' } },
    ] });
    expect(result).toEqual({
      contractVersion: 'people-map-search-v1',
      provider: 'photon-osm',
      results: [{ id: 'place-1', label: 'Avenida Example, 2900-000, Setúbal, Portugal', latitude: 38.521, longitude: -8.892 }],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('osm_id');
    expect(serialized).not.toContain('extent');
    expect(serialized).not.toContain('tenant');
    expect(serialized).not.toContain('actor');
    expect(serialized).not.toContain('person');
  });

  it('sends the user-entered place text only to the server-side geocoder and caches the exact retry', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [{ geometry: { type: 'Point', coordinates: [-8.89, 38.52] }, properties: { name: 'Setúbal', country: 'Portugal' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const first = await searchPeopleMapPlaces('Setúbal privacy-test-unique', fetcher);
    const second = await searchPeopleMapPlaces('  Setúbal   privacy-test-unique ', fetcher);
    expect(first).toEqual(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [input, init] = fetcher.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(url.protocol).toBe('https:');
    expect(url.searchParams.get('q')).toBe('Setúbal privacy-test-unique');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toEqual(expect.objectContaining({ 'User-Agent': expect.stringContaining('Eutaktos') }));
    expect(JSON.stringify(first)).not.toContain('privacy-test-unique');
  });
});

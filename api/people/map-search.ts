declare const process: { env: Record<string, string | undefined> };

import { requireCapability, resolvePrincipal, type VerifiedPrincipal } from '../_auth';
import { DatabaseRequestError } from '../_db';
import { assertTrustedMutation, BadRequestError, exactKeys, requestBody, requiredString, runEndpoint } from '../_endpoint';
import { json, methodNotAllowed, type ApiHandler } from '../_types';

const DEFAULT_GEOCODER_URL = 'https://photon.komoot.io/api/';
const GEOCODER_USER_AGENT = 'Eutaktos/1.0 (+https://eutakes.netlify.app/)';
const MAX_RESULTS = 5;
const REQUEST_SPACING_MS = 1100;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

interface CachedSearch {
  readonly expiresAt: number;
  readonly value: PeopleMapSearchDto;
}

export interface PeopleMapSearchResult {
  readonly id: string;
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface PeopleMapSearchDto {
  readonly contractVersion: 'people-map-search-v1';
  readonly provider: 'photon-osm';
  readonly results: readonly PeopleMapSearchResult[];
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

const cache = new Map<string, CachedSearch>();
let queue: Promise<void> = Promise.resolve();
let lastProviderRequestAt = 0;

function normalizeQuery(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (/[\u0000-\u001f\u007f]/.test(normalized)) throw new BadRequestError('query contains unsupported characters');
  return normalized;
}

function geocoderUrl(): URL {
  const configured = process.env.EUTAKTOS_GEOCODER_URL?.trim() || DEFAULT_GEOCODER_URL;
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new DatabaseRequestError(503); }
  if (url.protocol !== 'https:') throw new DatabaseRequestError(503);
  return url;
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : undefined;
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function finiteCoordinate(value: unknown, minimum: number, maximum: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? value : undefined;
}

function resultLabel(properties: Readonly<Record<string, unknown>>): string | undefined {
  const name = optionalText(properties.name);
  const street = optionalText(properties.street);
  const houseNumber = optionalText(properties.housenumber);
  const postcode = optionalText(properties.postcode);
  const city = optionalText(properties.city) ?? optionalText(properties.town) ?? optionalText(properties.village) ?? optionalText(properties.locality);
  const district = optionalText(properties.district) ?? optionalText(properties.county);
  const state = optionalText(properties.state);
  const country = optionalText(properties.country);
  const streetLine = street ? `${street}${houseNumber ? ` ${houseNumber}` : ''}` : undefined;
  const parts = [name, streetLine, postcode, city, district, state, country]
    .filter((part): part is string => Boolean(part));
  const unique = parts.filter((part, index) => parts.findIndex(candidate => candidate.toLocaleLowerCase() === part.toLocaleLowerCase()) === index);
  return unique.length ? unique.join(', ') : undefined;
}

export function projectPhotonResponse(value: unknown): PeopleMapSearchDto {
  const root = record(value);
  const features = root && Array.isArray(root.features) ? root.features : [];
  const results: PeopleMapSearchResult[] = [];
  for (const featureValue of features.slice(0, MAX_RESULTS)) {
    const feature = record(featureValue);
    const geometry = feature ? record(feature.geometry) : undefined;
    const properties = feature ? record(feature.properties) : undefined;
    const coordinates = geometry && geometry.type === 'Point' && Array.isArray(geometry.coordinates) ? geometry.coordinates : undefined;
    if (!properties || !coordinates || coordinates.length < 2) continue;
    const longitude = finiteCoordinate(coordinates[0], -180, 180);
    const latitude = finiteCoordinate(coordinates[1], -90, 90);
    const label = resultLabel(properties);
    if (latitude === undefined || longitude === undefined || !label) continue;
    results.push(Object.freeze({
      id: `place-${results.length + 1}`,
      label,
      latitude,
      longitude,
    }));
  }
  return Object.freeze({ contractVersion: 'people-map-search-v1', provider: 'photon-osm', results: Object.freeze(results) });
}

async function waitForProviderSlot(): Promise<void> {
  let release!: () => void;
  const predecessor = queue;
  queue = new Promise<void>(resolve => { release = resolve; });
  await predecessor;
  try {
    const delay = Math.max(0, REQUEST_SPACING_MS - (Date.now() - lastProviderRequestAt));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastProviderRequestAt = Date.now();
  } finally {
    release();
  }
}

function cacheKey(query: string): string {
  return query.toLocaleLowerCase();
}

function pruneCache(now: number): void {
  for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

export async function searchPeopleMapPlaces(queryInput: string, fetcher: FetchLike = fetch): Promise<PeopleMapSearchDto> {
  const query = normalizeQuery(queryInput);
  const now = Date.now();
  pruneCache(now);
  const key = cacheKey(query);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  await waitForProviderSlot();
  const url = geocoderUrl();
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(MAX_RESULTS));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetcher(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': GEOCODER_USER_AGENT,
        Referer: 'https://eutakes.netlify.app/',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new DatabaseRequestError(response.status);
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new DatabaseRequestError(502); }
    const projected = projectPhotonResponse(body);
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: projected });
    pruneCache(Date.now());
    return projected;
  } catch (error) {
    if (error instanceof DatabaseRequestError) throw error;
    throw new DatabaseRequestError(503);
  } finally {
    clearTimeout(timeout);
  }
}

export function requirePeopleMapSearch(principal: VerifiedPrincipal): void {
  requireCapability(principal, 'people.write');
  requireCapability(principal, 'map.write');
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    if (Object.keys(request.query).length) throw new BadRequestError('People map place search does not accept query parameters');
    assertTrustedMutation(request);
    const principal = await resolvePrincipal(request, database);
    requirePeopleMapSearch(principal);
    const body = requestBody(request.body);
    exactKeys(body, ['query']);
    const query = requiredString(body, 'query', 200);
    const result = await searchPeopleMapPlaces(query);
    json(response, 200, result);
  }, { maxBodyBytes: 2048 });
};

export default handler;

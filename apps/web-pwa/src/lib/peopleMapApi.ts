export interface PeopleMapPointDto {
  readonly personId: string;
  readonly displayName: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface PeopleMapDto {
  readonly contractVersion: 'people-map-v1';
  readonly points: readonly PeopleMapPointDto[];
}

export interface PeopleMapLocationMutationDto {
  readonly contractVersion: 'people-map-location-v1';
  readonly changed: boolean;
  readonly location: Readonly<{ latitude: number; longitude: number }> | null;
}

export class PeopleMapApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`People Map request failed (${status})`);
    this.name = 'PeopleMapApiError';
    this.status = status;
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid People Map API response');
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid People Map API response');
  return value;
}

function coordinate(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error('Invalid People Map API response');
  }
  const normalized = Math.round((value + Math.sign(value || 1) * Number.EPSILON) * 100) / 100;
  if (value !== normalized) throw new Error('Invalid People Map API response');
  return Object.is(normalized, -0) ? 0 : normalized;
}

function parsePoint(value: unknown): PeopleMapPointDto {
  const point = record(value);
  if (Object.keys(point).some(key => !['personId', 'displayName', 'latitude', 'longitude'].includes(key))) {
    throw new Error('Invalid People Map API response');
  }
  return Object.freeze({
    personId: text(point.personId),
    displayName: text(point.displayName),
    latitude: coordinate(point.latitude, -90, 90),
    longitude: coordinate(point.longitude, -180, 180),
  });
}

export function parsePeopleMap(value: unknown): PeopleMapDto {
  const root = record(value);
  if (Object.keys(root).some(key => !['contractVersion', 'points'].includes(key)) || root.contractVersion !== 'people-map-v1' || !Array.isArray(root.points)) {
    throw new Error('Invalid People Map API response');
  }
  return Object.freeze({
    contractVersion: 'people-map-v1',
    points: Object.freeze(root.points.map(parsePoint)),
  });
}

export function parsePeopleMapLocationMutation(value: unknown): PeopleMapLocationMutationDto {
  const root = record(value);
  if (Object.keys(root).some(key => !['contractVersion', 'changed', 'location'].includes(key)) || root.contractVersion !== 'people-map-location-v1' || typeof root.changed !== 'boolean') {
    throw new Error('Invalid People Map API response');
  }
  if (root.location === null) return Object.freeze({ contractVersion: 'people-map-location-v1', changed: root.changed, location: null });
  const location = record(root.location);
  if (Object.keys(location).some(key => !['latitude', 'longitude'].includes(key))) throw new Error('Invalid People Map API response');
  return Object.freeze({
    contractVersion: 'people-map-location-v1',
    changed: root.changed,
    location: Object.freeze({
      latitude: coordinate(location.latitude, -90, 90),
      longitude: coordinate(location.longitude, -180, 180),
    }),
  });
}

async function responseBody(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid People Map API response'); }
}

function personLocationPath(personId: string): string {
  const normalized = personId.trim();
  if (!normalized) throw new Error('personId is required');
  return `/api/people/${encodeURIComponent(normalized)}/map-location`;
}

export function createPeopleMapApi(fetcher: typeof fetch = fetch) {
  return Object.freeze({
    async list(signal?: AbortSignal): Promise<PeopleMapDto> {
      const response = await fetcher('/api/people/map', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await responseBody(response);
      if (!response.ok) throw new PeopleMapApiError(response.status);
      return parsePeopleMap(body);
    },

    async setLocation(personId: string, latitude: number, longitude: number): Promise<PeopleMapLocationMutationDto> {
      const response = await fetcher(personLocationPath(personId), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
      });
      const body = await responseBody(response);
      if (!response.ok) throw new PeopleMapApiError(response.status);
      return parsePeopleMapLocationMutation(body);
    },

    async removeLocation(personId: string): Promise<PeopleMapLocationMutationDto> {
      const response = await fetcher(personLocationPath(personId), {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const body = await responseBody(response);
      if (!response.ok) throw new PeopleMapApiError(response.status);
      return parsePeopleMapLocationMutation(body);
    },
  });
}

export const peopleMapApi = createPeopleMapApi();

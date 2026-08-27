import { DatabaseNotConfiguredError, DatabaseRequestError, databaseConfigFromEnv, type DatabaseConfig } from './_db';

export interface PeopleMapPoint {
  readonly personId: string;
  readonly displayName: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface PeopleMapLocationMutation {
  readonly changed: boolean;
  readonly latitude: number;
  readonly longitude: number;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseRequestError(502);
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new DatabaseRequestError(502);
  return value;
}

function normalizedCoordinate(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new DatabaseRequestError(502);
  }
  const normalized = Math.round((value + Math.sign(value || 1) * Number.EPSILON) * 100) / 100;
  if (value !== normalized) throw new DatabaseRequestError(502);
  return Object.is(normalized, -0) ? 0 : normalized;
}

function instant(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new DatabaseRequestError(502);
  return result;
}

export class PeopleMapDatabase {
  readonly #config?: DatabaseConfig;
  readonly #fetch: typeof fetch;

  constructor(config: DatabaseConfig | undefined = databaseConfigFromEnv(), fetcher: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetcher;
  }

  async list(tenantId: string): Promise<readonly PeopleMapPoint[]> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_list_people_map_points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_tenant_id: tenantId }),
    });
    if (!Array.isArray(value)) throw new DatabaseRequestError(502);
    return Object.freeze(value.map(item => {
      const row = record(item);
      return Object.freeze({
        personId: text(row.person_id),
        displayName: text(row.display_name),
        latitude: normalizedCoordinate(row.latitude, -90, 90),
        longitude: normalizedCoordinate(row.longitude, -180, 180),
      });
    }));
  }

  async set(input: Readonly<{
    tenantId: string;
    personId: string;
    actorId: string;
    latitude: number;
    longitude: number;
    updatedAt: string;
  }>): Promise<PeopleMapLocationMutation> {
    const latitude = normalizedCoordinate(input.latitude, -90, 90);
    const longitude = normalizedCoordinate(input.longitude, -180, 180);
    const value = await this.#request('/rest/v1/rpc/eutaktos_set_people_map_location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_tenant_id: input.tenantId,
        p_person_id: input.personId,
        p_actor_id: input.actorId,
        p_latitude: latitude,
        p_longitude: longitude,
        p_updated_at: input.updatedAt,
      }),
    });
    if (!Array.isArray(value) || value.length !== 1) throw new DatabaseRequestError(502);
    const row = record(value[0]);
    if (typeof row.changed !== 'boolean' || row.precision !== 'approximate' || row.source !== 'manual') {
      throw new DatabaseRequestError(502);
    }
    // Validate server-returned timestamp without allowing it into the browser DTO.
    instant(row.updated_at);
    return Object.freeze({
      changed: row.changed,
      latitude: normalizedCoordinate(row.latitude, -90, 90),
      longitude: normalizedCoordinate(row.longitude, -180, 180),
    });
  }

  async remove(input: Readonly<{ tenantId: string; personId: string; actorId: string; removedAt: string }>): Promise<boolean> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_remove_people_map_location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_tenant_id: input.tenantId,
        p_person_id: input.personId,
        p_actor_id: input.actorId,
        p_removed_at: input.removedAt,
      }),
    });
    if (typeof value !== 'boolean') throw new DatabaseRequestError(502);
    return value;
  }

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    const config = this.#config;
    if (!config) throw new DatabaseNotConfiguredError();
    const authHeaders: Record<string, string> = { Accept: 'application/json', apikey: config.serviceRoleKey };
    if (!config.serviceRoleKey.startsWith('sb_secret_')) authHeaders.Authorization = `Bearer ${config.serviceRoleKey}`;
    const response = await this.#fetch(`${config.url}${path}`, { ...init, headers: { ...authHeaders, ...init.headers } });
    if (!response.ok) throw new DatabaseRequestError(response.status);
    if (response.status === 204 || response.headers.get('content-length') === '0') return undefined;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) throw new DatabaseRequestError(502);
    try { return await response.json(); } catch { throw new DatabaseRequestError(502); }
  }
}

import {
  DatabaseNotConfiguredError,
  DatabaseRequestError,
  databaseConfigFromEnv,
  type DatabaseConfig,
} from './_db';

export interface DomainEventProjectionRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly event_type: string;
  readonly aggregate_id: string;
  readonly occurred_at: string;
  readonly schema_version: number;
}

export interface DomainEventProjectionQuery {
  readonly tenantId: string;
  readonly eventType: string;
  readonly from?: string;
  readonly limit: number;
  readonly offset?: number;
}

function exactString(value: unknown): string {
  if (typeof value !== 'string') throw new DatabaseRequestError(502);
  const normalized = value.trim();
  if (!normalized) throw new DatabaseRequestError(502);
  return normalized;
}

function safeInteger(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new DatabaseRequestError(502);
  return value;
}

function row(value: unknown): DomainEventProjectionRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseRequestError(502);
  const candidate = value as Readonly<Record<string, unknown>>;
  return Object.freeze({
    tenant_id: exactString(candidate.tenant_id),
    id: exactString(candidate.id),
    event_type: exactString(candidate.event_type),
    aggregate_id: exactString(candidate.aggregate_id),
    occurred_at: exactString(candidate.occurred_at),
    schema_version: safeInteger(candidate.schema_version, 1),
  });
}

/**
 * Purpose-built, read-only outbox projection for factual domain-history queries.
 * It deliberately selects no actor, payload, correlation or delivery metadata and
 * never calls the claim/delivery RPCs, so reading attention evidence cannot mutate
 * delivery state or expose unnecessary event data.
 */
export class DomainEventReader {
  readonly #config?: DatabaseConfig;
  readonly #fetch: typeof fetch;

  constructor(config: DatabaseConfig | undefined = databaseConfigFromEnv(), fetcher: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetcher;
  }

  async list(query: DomainEventProjectionQuery): Promise<readonly DomainEventProjectionRow[]> {
    const config = this.#config;
    if (!config) throw new DatabaseNotConfiguredError();
    if (!query.tenantId.trim() || !query.eventType.trim()) throw new DatabaseRequestError(400);
    if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 500) throw new DatabaseRequestError(400);
    const offset = query.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0) throw new DatabaseRequestError(400);

    const params = new URLSearchParams({
      select: 'tenant_id,id,event_type,aggregate_id,occurred_at,schema_version',
      tenant_id: `eq.${query.tenantId}`,
      event_type: `eq.${query.eventType}`,
      order: 'occurred_at.desc,id.desc',
      limit: String(query.limit),
      offset: String(offset),
    });
    if (query.from) params.set('occurred_at', `gte.${query.from}`);

    const headers: Record<string, string> = { Accept: 'application/json', apikey: config.serviceRoleKey };
    if (!config.serviceRoleKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${config.serviceRoleKey}`;
    const response = await this.#fetch(`${config.url}/rest/v1/eutaktos_outbox?${params}`, { headers });
    if (!response.ok) throw new DatabaseRequestError(response.status);

    let body: unknown;
    try { body = await response.json(); }
    catch { throw new DatabaseRequestError(502); }
    if (!Array.isArray(body)) throw new DatabaseRequestError(502);
    return Object.freeze(body.map(row));
  }
}

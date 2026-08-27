import { DatabaseNotConfiguredError, DatabaseRequestError, databaseConfigFromEnv, type DatabaseConfig } from './_db';

export interface StoredPeopleTransfer {
  readonly id: string;
  readonly sourceTenantId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly claimedAt?: string;
  readonly cancelledAt?: string;
  readonly people: readonly Readonly<{ displayName: string }>[];
}

export interface PeopleTransferPreview {
  readonly transferId: string;
  readonly expiresAt: string;
  readonly people: readonly Readonly<{ displayName: string }>[];
}

export interface PeopleTransferClaim {
  readonly outcome: 'claimed' | 'already-claimed';
  readonly transferId: string;
  readonly people: readonly Readonly<{ personId: string; displayName: string }>[];
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseRequestError(502);
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new DatabaseRequestError(502);
  return value;
}
function instant(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new DatabaseRequestError(502);
  return result;
}
function peopleNames(value: unknown): readonly Readonly<{ displayName: string }>[] {
  if (!Array.isArray(value)) throw new DatabaseRequestError(502);
  return Object.freeze(value.map(item => {
    const row = objectRecord(item);
    return Object.freeze({ displayName: text(row.displayName) });
  }));
}
function claimedPeople(value: unknown): readonly Readonly<{ personId: string; displayName: string }>[] {
  if (!Array.isArray(value)) throw new DatabaseRequestError(502);
  return Object.freeze(value.map(item => {
    const row = objectRecord(item);
    return Object.freeze({ personId: text(row.personId), displayName: text(row.displayName) });
  }));
}

export class PeopleTransfersDatabase {
  readonly #config?: DatabaseConfig;
  readonly #fetch: typeof fetch;

  constructor(config: DatabaseConfig | undefined = databaseConfigFromEnv(), fetcher: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetcher;
  }

  async create(input: Readonly<Record<string, unknown>>): Promise<void> {
    await this.#request('/rest/v1/rpc/eutaktos_create_people_transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(input),
    });
  }

  async list(sourceTenantId: string): Promise<readonly StoredPeopleTransfer[]> {
    const params = new URLSearchParams({
      select: 'id,source_tenant_id,payload,created_at,expires_at,claimed_at,cancelled_at',
      source_tenant_id: `eq.${sourceTenantId}`,
      order: 'created_at.desc,id.desc',
      limit: '100',
    });
    const value = await this.#request(`/rest/v1/eutaktos_people_transfers?${params}`);
    if (!Array.isArray(value)) throw new DatabaseRequestError(502);
    return Object.freeze(value.map(item => {
      const row = objectRecord(item);
      return Object.freeze({
        id: text(row.id),
        sourceTenantId: text(row.source_tenant_id),
        createdAt: instant(row.created_at),
        expiresAt: instant(row.expires_at),
        ...(typeof row.claimed_at === 'string' ? { claimedAt: instant(row.claimed_at) } : {}),
        ...(typeof row.cancelled_at === 'string' ? { cancelledAt: instant(row.cancelled_at) } : {}),
        people: peopleNames(row.payload),
      });
    }));
  }

  async preview(tokenHash: string, now: string): Promise<PeopleTransferPreview | undefined> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_preview_people_transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token_hash: tokenHash, p_now: now }),
    });
    if (!Array.isArray(value) || value.length > 1) throw new DatabaseRequestError(502);
    if (!value[0]) return undefined;
    const row = objectRecord(value[0]);
    return Object.freeze({ transferId: text(row.transfer_id), expiresAt: instant(row.expires_at), people: peopleNames(row.people) });
  }

  async claim(tokenHash: string, destinationTenantId: string, destinationActorId: string, claimedAt: string): Promise<PeopleTransferClaim | undefined> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_claim_people_transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        p_token_hash: tokenHash,
        p_destination_tenant_id: destinationTenantId,
        p_destination_actor_id: destinationActorId,
        p_claimed_at: claimedAt,
      }),
    });
    if (!Array.isArray(value) || value.length > 1) throw new DatabaseRequestError(502);
    if (!value[0]) return undefined;
    const row = objectRecord(value[0]);
    if (row.outcome !== 'claimed' && row.outcome !== 'already-claimed') throw new DatabaseRequestError(502);
    return Object.freeze({ outcome: row.outcome, transferId: text(row.transfer_id), people: claimedPeople(row.people) });
  }

  async cancel(transferId: string, sourceTenantId: string, sourceActorId: string, cancelledAt: string): Promise<boolean> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_cancel_people_transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        p_transfer_id: transferId,
        p_source_tenant_id: sourceTenantId,
        p_source_actor_id: sourceActorId,
        p_cancelled_at: cancelledAt,
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
    if (!contentType.toLowerCase().includes('application/json')) return undefined;
    try { return await response.json(); } catch { throw new DatabaseRequestError(502); }
  }
}
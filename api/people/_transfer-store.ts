import { DatabaseNotConfiguredError, DatabaseRequestError, databaseConfigFromEnv, type DatabaseConfig } from '../_db';

export interface StoredPeopleTransfer {
  readonly id: string;
  readonly sourceTenantId: string;
  readonly clientMutationId: string;
  readonly tokenHash: string;
  readonly payload: Readonly<{
    contractVersion: 'people-transfer-package-v1';
    people: readonly Readonly<{
      displayName: string;
      preferredLocale?: string;
      ordinaryContact?: Readonly<{ phone?: string; email?: string; address?: string }>;
    }>[];
  }>;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly cancelledAt?: string;
  readonly receivedAt?: string;
  readonly receivedByTenantId?: string;
  readonly history: readonly Readonly<{ action: 'created' | 'token-rotated' | 'cancelled' | 'received'; occurredAt: string }>[];
  readonly createdPersonIds: readonly string[];
}

export class PeopleTransferStoreError extends Error {
  readonly code: 'not-found' | 'unavailable' | 'already-received' | 'same-tenant' | 'not-pending' | 'database';
  constructor(code: PeopleTransferStoreError['code']) {
    super(`People transfer persistence failed (${code})`);
    this.name = 'PeopleTransferStoreError';
    this.code = code;
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseRequestError(502);
  return value as Readonly<Record<string, unknown>>;
}
function exactString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new DatabaseRequestError(502);
  return value;
}
function optionalInstant(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = exactString(value);
  if (!Number.isFinite(Date.parse(parsed))) throw new DatabaseRequestError(502);
  return parsed;
}
function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string' && item.trim())) throw new DatabaseRequestError(502);
  return Object.freeze([...value]);
}
function ordinaryContact(value: unknown): Readonly<{ phone?: string; email?: string; address?: string }> | undefined {
  if (value === undefined) return undefined;
  const item = record(value);
  const allowed = new Set(['phone', 'email', 'address']);
  if (Object.keys(item).some(key => !allowed.has(key))) throw new DatabaseRequestError(502);
  for (const key of allowed) if (item[key] !== undefined && typeof item[key] !== 'string') throw new DatabaseRequestError(502);
  return Object.freeze({
    ...(typeof item.phone === 'string' && item.phone ? { phone: item.phone } : {}),
    ...(typeof item.email === 'string' && item.email ? { email: item.email } : {}),
    ...(typeof item.address === 'string' && item.address ? { address: item.address } : {}),
  });
}
function payload(value: unknown): StoredPeopleTransfer['payload'] {
  const item = record(value);
  if (item.contractVersion !== 'people-transfer-package-v1' || !Array.isArray(item.people) || item.people.length < 1 || item.people.length > 20) throw new DatabaseRequestError(502);
  return Object.freeze({
    contractVersion: 'people-transfer-package-v1',
    people: Object.freeze(item.people.map(value => {
      const person = record(value);
      const allowed = new Set(['displayName', 'preferredLocale', 'ordinaryContact']);
      if (Object.keys(person).some(key => !allowed.has(key))) throw new DatabaseRequestError(502);
      const displayName = exactString(person.displayName);
      if (person.preferredLocale !== undefined && typeof person.preferredLocale !== 'string') throw new DatabaseRequestError(502);
      const contact = ordinaryContact(person.ordinaryContact);
      return Object.freeze({
        displayName,
        ...(typeof person.preferredLocale === 'string' && person.preferredLocale ? { preferredLocale: person.preferredLocale } : {}),
        ...(contact && Object.keys(contact).length ? { ordinaryContact: contact } : {}),
      });
    })),
  });
}
function history(value: unknown): StoredPeopleTransfer['history'] {
  if (!Array.isArray(value)) throw new DatabaseRequestError(502);
  return Object.freeze(value.map(entry => {
    const item = record(entry);
    if (!['created', 'token-rotated', 'cancelled', 'received'].includes(String(item.action))) throw new DatabaseRequestError(502);
    const occurredAt = exactString(item.occurredAt);
    if (!Number.isFinite(Date.parse(occurredAt))) throw new DatabaseRequestError(502);
    return Object.freeze({ action: item.action as 'created' | 'token-rotated' | 'cancelled' | 'received', occurredAt });
  }));
}

function parseRow(value: unknown): StoredPeopleTransfer {
  const row = record(value);
  const id = exactString(row.id);
  const sourceTenantId = exactString(row.source_tenant_id);
  const tokenHash = exactString(row.token_hash);
  if (!/^[0-9a-f]{64}$/.test(tokenHash)) throw new DatabaseRequestError(502);
  const createdAt = exactString(row.created_at);
  const expiresAt = exactString(row.expires_at);
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(Date.parse(expiresAt))) throw new DatabaseRequestError(502);
  return Object.freeze({
    id,
    sourceTenantId,
    clientMutationId: exactString(row.client_mutation_id),
    tokenHash,
    payload: payload(row.payload),
    createdBy: exactString(row.created_by),
    createdAt,
    expiresAt,
    ...(optionalInstant(row.cancelled_at) ? { cancelledAt: optionalInstant(row.cancelled_at) } : {}),
    ...(optionalInstant(row.received_at) ? { receivedAt: optionalInstant(row.received_at) } : {}),
    ...(typeof row.received_by_tenant_id === 'string' && row.received_by_tenant_id.trim() ? { receivedByTenantId: row.received_by_tenant_id } : {}),
    history: history(row.history),
    createdPersonIds: stringArray(row.created_person_ids ?? []),
  });
}

function parseRpcOutcome(value: unknown): Readonly<Record<string, unknown>> {
  return record(value);
}

export class PeopleTransferStore {
  readonly #config?: DatabaseConfig;
  readonly #fetch: typeof fetch;

  constructor(config: DatabaseConfig | undefined = databaseConfigFromEnv(), fetcher: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetcher;
  }

  async listForSourceTenant(sourceTenantId: string): Promise<readonly StoredPeopleTransfer[]> {
    const params = new URLSearchParams({
      select: 'id,source_tenant_id,client_mutation_id,token_hash,payload,created_by,created_at,expires_at,cancelled_at,received_at,received_by_tenant_id,history,created_person_ids',
      source_tenant_id: `eq.${sourceTenantId}`,
      order: 'created_at.desc,id.desc',
    });
    return Object.freeze((await this.#array(`/rest/v1/eutaktos_people_transfers?${params}`)).map(parseRow));
  }

  async bySourceMutation(sourceTenantId: string, clientMutationId: string): Promise<StoredPeopleTransfer | undefined> {
    const params = new URLSearchParams({
      select: 'id,source_tenant_id,client_mutation_id,token_hash,payload,created_by,created_at,expires_at,cancelled_at,received_at,received_by_tenant_id,history,created_person_ids',
      source_tenant_id: `eq.${sourceTenantId}`,
      client_mutation_id: `eq.${clientMutationId}`,
      limit: '1',
    });
    const rows = await this.#array(`/rest/v1/eutaktos_people_transfers?${params}`);
    return rows[0] ? parseRow(rows[0]) : undefined;
  }

  async bySourceId(sourceTenantId: string, transferId: string): Promise<StoredPeopleTransfer | undefined> {
    const params = new URLSearchParams({
      select: 'id,source_tenant_id,client_mutation_id,token_hash,payload,created_by,created_at,expires_at,cancelled_at,received_at,received_by_tenant_id,history,created_person_ids',
      source_tenant_id: `eq.${sourceTenantId}`,
      id: `eq.${transferId}`,
      limit: '1',
    });
    const rows = await this.#array(`/rest/v1/eutaktos_people_transfers?${params}`);
    return rows[0] ? parseRow(rows[0]) : undefined;
  }

  async byTokenHash(tokenHash: string): Promise<StoredPeopleTransfer | undefined> {
    const params = new URLSearchParams({
      select: 'id,source_tenant_id,client_mutation_id,token_hash,payload,created_by,created_at,expires_at,cancelled_at,received_at,received_by_tenant_id,history,created_person_ids',
      token_hash: `eq.${tokenHash}`,
      limit: '1',
    });
    const rows = await this.#array(`/rest/v1/eutaktos_people_transfers?${params}`);
    return rows[0] ? parseRow(rows[0]) : undefined;
  }

  async create(transfer: Readonly<Record<string, unknown>>, audit: Readonly<Record<string, unknown>>, event: Readonly<Record<string, unknown>>): Promise<void> {
    await this.#request('/rest/v1/rpc/eutaktos_create_people_transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_transfer: transfer, p_audit: audit, p_event: event }),
    });
  }

  async rotate(sourceTenantId: string, transferId: string, tokenHash: string, occurredAt: string, audit: Readonly<Record<string, unknown>>, event: Readonly<Record<string, unknown>>): Promise<void> {
    await this.#request('/rest/v1/rpc/eutaktos_rotate_people_transfer_token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_source_tenant_id: sourceTenantId, p_transfer_id: transferId, p_token_hash: tokenHash, p_occurred_at: occurredAt, p_audit: audit, p_event: event }),
    });
  }

  async cancel(sourceTenantId: string, transferId: string, occurredAt: string, audit: Readonly<Record<string, unknown>>, event: Readonly<Record<string, unknown>>): Promise<'cancelled' | 'already-cancelled'> {
    const result = parseRpcOutcome(await this.#request('/rest/v1/rpc/eutaktos_cancel_people_transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_source_tenant_id: sourceTenantId, p_transfer_id: transferId, p_occurred_at: occurredAt, p_audit: audit, p_event: event }),
    }));
    if (result.outcome !== 'cancelled' && result.outcome !== 'already-cancelled') throw new DatabaseRequestError(502);
    return result.outcome;
  }

  async receive(tokenHash: string, destinationTenantId: string, actorId: string, occurredAt: string, audit: Readonly<Record<string, unknown>>, event: Readonly<Record<string, unknown>>): Promise<Readonly<{ outcome: 'received' | 'already-received'; createdPersonIds: readonly string[] }>> {
    const result = parseRpcOutcome(await this.#request('/rest/v1/rpc/eutaktos_receive_people_transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token_hash: tokenHash, p_destination_tenant_id: destinationTenantId, p_actor_id: actorId, p_occurred_at: occurredAt, p_audit: audit, p_event: event }),
    }));
    if (result.outcome !== 'received' && result.outcome !== 'already-received') throw new DatabaseRequestError(502);
    return Object.freeze({ outcome: result.outcome, createdPersonIds: stringArray(result.createdPersonIds) });
  }

  async #array(path: string): Promise<readonly unknown[]> {
    const value = await this.#request(path);
    if (!Array.isArray(value)) throw new DatabaseRequestError(502);
    return value;
  }

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    const config = this.#config;
    if (!config) throw new DatabaseNotConfiguredError();
    const headers: Record<string, string> = { Accept: 'application/json', apikey: config.serviceRoleKey };
    if (!config.serviceRoleKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${config.serviceRoleKey}`;
    const response = await this.#fetch(`${config.url}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
    if (!response.ok) {
      let code: string | undefined;
      try {
        const body = await response.json() as Readonly<Record<string, unknown>>;
        if (typeof body.code === 'string') code = body.code;
      } catch { /* fail closed below */ }
      if (code === 'PT404') throw new PeopleTransferStoreError('not-found');
      if (code === 'PT410') throw new PeopleTransferStoreError('unavailable');
      if (code === 'PT409') throw new PeopleTransferStoreError('already-received');
      if (code === 'PT422') throw new PeopleTransferStoreError('same-tenant');
      if (code === 'PT423') throw new PeopleTransferStoreError('not-pending');
      if (response.status === 409) throw new PeopleTransferStoreError('database');
      throw new DatabaseRequestError(response.status);
    }
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!text) return undefined;
    try { return JSON.parse(text) as unknown; } catch { throw new DatabaseRequestError(502); }
  }
}

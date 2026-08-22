declare const process: { env: Record<string, string | undefined> };

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('Production database is not configured');
  }
}

export class DatabaseRequestError extends Error {
  readonly status: number;
  constructor(status: number) {
    super('Production database request failed');
    this.status = status;
  }
}

export interface DatabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface EntityRow {
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  data: unknown;
}

export interface SessionRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  issued_at: string;
  idle_expires_at: string;
  absolute_expires_at: string;
  revoked_at?: string | null;
}

export interface AccessGrantRow {
  tenant_id: string;
  id: string;
  subject_id: string;
  capability: string;
  granted_by: string;
  granted_at: string;
  revoked_at?: string | null;
}

export interface AuditRow {
  tenant_id: string;
  id: string;
  resource_type: string;
  resource_id: string;
  action: string;
  actor_id: string;
  occurred_at: string;
  changed_fields: readonly string[];
}

function normalizeBaseUrl(value: string): string {
  const candidate = value.trim().replace(/\/+$/, '');
  const url = new URL(candidate);
  if (url.protocol !== 'https:') throw new Error('EUTAKTOS_SUPABASE_URL must use HTTPS');
  return url.toString().replace(/\/$/, '');
}

export function databaseConfigFromEnv(): DatabaseConfig | undefined {
  const rawUrl = process.env.EUTAKTOS_SUPABASE_URL?.trim();
  const key = process.env.EUTAKTOS_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl && !key) return undefined;
  if (!rawUrl || !key) throw new DatabaseNotConfiguredError();
  return Object.freeze({ url: normalizeBaseUrl(rawUrl), serviceRoleKey: key });
}

function exactString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new DatabaseRequestError(502);
  const normalized = value.trim();
  if (!normalized) throw new DatabaseRequestError(502);
  return normalized;
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseRequestError(502);
  return value as Readonly<Record<string, unknown>>;
}

function parseEntityRow(value: unknown): EntityRow {
  const row = objectRecord(value);
  return {
    tenant_id: exactString(row.tenant_id, 'tenant_id'),
    entity_type: exactString(row.entity_type, 'entity_type'),
    entity_id: exactString(row.entity_id, 'entity_id'),
    data: row.data,
  };
}

function parseSessionRow(value: unknown): SessionRow {
  const row = objectRecord(value);
  return {
    id: exactString(row.id, 'id'),
    tenant_id: exactString(row.tenant_id, 'tenant_id'),
    actor_id: exactString(row.actor_id, 'actor_id'),
    issued_at: exactString(row.issued_at, 'issued_at'),
    idle_expires_at: exactString(row.idle_expires_at, 'idle_expires_at'),
    absolute_expires_at: exactString(row.absolute_expires_at, 'absolute_expires_at'),
    ...(typeof row.revoked_at === 'string' ? { revoked_at: row.revoked_at } : {}),
  };
}

function parseGrantRow(value: unknown): AccessGrantRow {
  const row = objectRecord(value);
  return {
    tenant_id: exactString(row.tenant_id, 'tenant_id'),
    id: exactString(row.id, 'id'),
    subject_id: exactString(row.subject_id, 'subject_id'),
    capability: exactString(row.capability, 'capability'),
    granted_by: exactString(row.granted_by, 'granted_by'),
    granted_at: exactString(row.granted_at, 'granted_at'),
    ...(typeof row.revoked_at === 'string' ? { revoked_at: row.revoked_at } : {}),
  };
}

function parseAuditRow(value: unknown): AuditRow {
  const row = objectRecord(value);
  if (!Array.isArray(row.changed_fields) || !row.changed_fields.every(item => typeof item === 'string')) {
    throw new DatabaseRequestError(502);
  }
  return {
    tenant_id: exactString(row.tenant_id, 'tenant_id'),
    id: exactString(row.id, 'id'),
    resource_type: exactString(row.resource_type, 'resource_type'),
    resource_id: exactString(row.resource_id, 'resource_id'),
    action: exactString(row.action, 'action'),
    actor_id: exactString(row.actor_id, 'actor_id'),
    occurred_at: exactString(row.occurred_at, 'occurred_at'),
    changed_fields: Object.freeze([...row.changed_fields]),
  };
}

export interface AuditQuery {
  tenantId: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit: number;
}

export class SupabaseRestDatabase {
  readonly #config?: DatabaseConfig;
  readonly #fetch: typeof fetch;

  constructor(config: DatabaseConfig | undefined = databaseConfigFromEnv(), fetcher: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetcher;
  }

  get configured(): boolean { return Boolean(this.#config); }

  async ready(): Promise<boolean> {
    if (!this.#config) return false;
    try {
      await this.#request('/rest/v1/eutaktos_entities?select=entity_id&limit=1');
      return true;
    } catch {
      return false;
    }
  }

  async session(sessionId: string): Promise<SessionRow | undefined> {
    const params = new URLSearchParams({
      select: 'id,tenant_id,actor_id,issued_at,idle_expires_at,absolute_expires_at,revoked_at',
      id: `eq.${sessionId}`,
      revoked_at: 'is.null',
      limit: '1',
    });
    const rows = await this.#array(`/rest/v1/eutaktos_sessions?${params}`);
    return rows[0] ? parseSessionRow(rows[0]) : undefined;
  }

  async activeGrants(tenantId: string, subjectId: string): Promise<readonly AccessGrantRow[]> {
    const params = new URLSearchParams({
      select: 'tenant_id,id,subject_id,capability,granted_by,granted_at,revoked_at',
      tenant_id: `eq.${tenantId}`,
      subject_id: `eq.${subjectId}`,
      revoked_at: 'is.null',
      order: 'capability.asc,id.asc',
    });
    return Object.freeze((await this.#array(`/rest/v1/eutaktos_access_grants?${params}`)).map(parseGrantRow));
  }

  async grantsForSubject(tenantId: string, subjectId: string): Promise<readonly AccessGrantRow[]> {
    const params = new URLSearchParams({
      select: 'tenant_id,id,subject_id,capability,granted_by,granted_at,revoked_at',
      tenant_id: `eq.${tenantId}`,
      subject_id: `eq.${subjectId}`,
      order: 'granted_at.desc,id.asc',
    });
    return Object.freeze((await this.#array(`/rest/v1/eutaktos_access_grants?${params}`)).map(parseGrantRow));
  }

  async entities(tenantId: string, entityType: string): Promise<readonly EntityRow[]> {
    const params = new URLSearchParams({
      select: 'tenant_id,entity_type,entity_id,data',
      tenant_id: `eq.${tenantId}`,
      entity_type: `eq.${entityType}`,
      order: 'entity_id.asc',
    });
    return Object.freeze((await this.#array(`/rest/v1/eutaktos_entities?${params}`)).map(parseEntityRow));
  }

  async entity(tenantId: string, entityType: string, entityId: string): Promise<EntityRow | undefined> {
    const params = new URLSearchParams({
      select: 'tenant_id,entity_type,entity_id,data',
      tenant_id: `eq.${tenantId}`,
      entity_type: `eq.${entityType}`,
      entity_id: `eq.${entityId}`,
      limit: '1',
    });
    const rows = await this.#array(`/rest/v1/eutaktos_entities?${params}`);
    return rows[0] ? parseEntityRow(rows[0]) : undefined;
  }

  async audit(query: AuditQuery): Promise<readonly AuditRow[]> {
    const params = new URLSearchParams({
      select: 'tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields',
      tenant_id: `eq.${query.tenantId}`,
      order: 'occurred_at.desc,id.desc',
      limit: String(query.limit),
    });
    if (query.resourceType) params.set('resource_type', `eq.${query.resourceType}`);
    if (query.resourceId) params.set('resource_id', `eq.${query.resourceId}`);
    if (query.action) params.set('action', `eq.${query.action}`);
    if (query.actorId) params.set('actor_id', `eq.${query.actorId}`);
    if (query.from) params.set('occurred_at', `gte.${query.from}`);
    if (query.to) params.append('occurred_at', `lte.${query.to}`);
    return Object.freeze((await this.#array(`/rest/v1/eutaktos_audit?${params}`)).map(parseAuditRow));
  }

  async applyEntityChange(input: Readonly<Record<string, unknown>>): Promise<void> {
    await this.#request('/rest/v1/rpc/eutaktos_apply_entity_change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(input),
    });
  }

  async deleteEntityChange(input: Readonly<Record<string, unknown>>): Promise<void> {
    await this.#request('/rest/v1/rpc/eutaktos_delete_entity_change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(input),
    });
  }

  async createGrantChange(input: Readonly<Record<string, unknown>>): Promise<void> {
    await this.#request('/rest/v1/rpc/eutaktos_apply_grant_change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(input),
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    const params = new URLSearchParams({ id: `eq.${sessionId}`, revoked_at: 'is.null' });
    await this.#request(`/rest/v1/eutaktos_sessions?${params}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    });
  }

  async revokeAllSessions(tenantId: string, actorId: string): Promise<void> {
    const params = new URLSearchParams({ tenant_id: `eq.${tenantId}`, actor_id: `eq.${actorId}`, revoked_at: 'is.null' });
    await this.#request(`/rest/v1/eutaktos_sessions?${params}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    });
  }

  async #array(path: string): Promise<readonly unknown[]> {
    const value = await this.#request(path);
    if (!Array.isArray(value)) throw new DatabaseRequestError(502);
    return value;
  }

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    const config = this.#config;
    if (!config) throw new DatabaseNotConfiguredError();
    const response = await this.#fetch(`${config.url}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        ...init.headers,
      },
    });
    if (!response.ok) throw new DatabaseRequestError(response.status);
    if (response.status === 204 || response.headers.get('content-length') === '0') return undefined;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) return undefined;
    try { return await response.json(); }
    catch { throw new DatabaseRequestError(502); }
  }
}

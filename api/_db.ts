declare const process: { env: Record<string, string | undefined> };

export class DatabaseNotConfiguredError extends Error {
  constructor() { super('Production database is not configured'); }
}
export class DatabaseRequestError extends Error {
  readonly status: number;
  constructor(status: number) { super('Production database request failed'); this.status = status; }
}
export interface DatabaseConfig { url: string; serviceRoleKey: string }
export interface EntityRow { tenant_id: string; entity_type: string; entity_id: string; data: unknown; version: number }
export interface SessionRow { id: string; tenant_id: string; actor_id: string; issued_at: string; idle_expires_at: string; absolute_expires_at: string; idle_timeout_ms: number; revoked_at?: string | null }
export interface AccessGrantRow { tenant_id: string; id: string; subject_id: string; capability: string; granted_by: string; granted_at: string; revoked_at?: string | null }
export interface AuditRow { tenant_id: string; id: string; resource_type: string; resource_id: string; action: string; actor_id: string; occurred_at: string; changed_fields: readonly string[] }
export interface OutboxRow { tenant_id: string; id: string; event_type: string; aggregate_id: string; actor_id: string; occurred_at: string; schema_version: number; correlation_id?: string | null; payload: Readonly<Record<string, unknown>>; delivery_attempts: number }
export interface AssignmentHistoryRow { tenant_id: string; id: string; assignment_id: string; person_id: string; part_type: string; meeting_id: string; meeting_date: string; state: 'assigned' | 'completed' | 'cancelled'; recorded_at: string }

function parseAssignmentHistoryRow(row: unknown, tenantId: string): AssignmentHistoryRow {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid assignment history row');
  const r = row as Readonly<Record<string, unknown>>;
  if (r.tenant_id !== tenantId) throw new Error('Cross-tenant assignment history access denied');
  const state = r.state;
  if (state !== 'assigned' && state !== 'completed' && state !== 'cancelled') {
    throw new Error(`Invalid assignment history state: ${String(state)}`);
  }
  if (typeof r.id !== 'string' || typeof r.assignment_id !== 'string' || typeof r.person_id !== 'string' || typeof r.part_type !== 'string' || typeof r.meeting_id !== 'string' || typeof r.meeting_date !== 'string' || typeof r.recorded_at !== 'string') {
    throw new Error('Invalid assignment history row shape');
  }
  return {
    tenant_id: r.tenant_id,
    id: r.id,
    assignment_id: r.assignment_id,
    person_id: r.person_id,
    part_type: r.part_type,
    meeting_id: r.meeting_id,
    meeting_date: r.meeting_date,
    state,
    recorded_at: r.recorded_at,
  };
}

function normalizeBaseUrl(value: string): string {
  const candidate = value.trim().replace(/\/+$/, '');
  const url = new URL(candidate);
  if (url.protocol !== 'https:') throw new Error('EUTAKTOS_SUPABASE_URL must use HTTPS');
  return url.toString().replace(/\/$/, '');
}
function firstNonBlank(...values: readonly (string | undefined)[]): string | undefined {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) return normalized;
  }
  return undefined;
}
export function databaseConfigFromEnv(): DatabaseConfig | undefined {
  const rawUrl = firstNonBlank(process.env.EUTAKTOS_SUPABASE_URL, process.env.SUPABASE_URL);
  const key = firstNonBlank(
    process.env.EUTAKTOS_SUPABASE_SECRET_KEY,
    process.env.EUTAKTOS_SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
  );
  if (!rawUrl && !key) return undefined;
  if (!rawUrl || !key) throw new DatabaseNotConfiguredError();
  return Object.freeze({ url: normalizeBaseUrl(rawUrl), serviceRoleKey: key });
}
function exactString(value: unknown): string {
  if (typeof value !== 'string') throw new DatabaseRequestError(502);
  const normalized = value.trim();
  if (!normalized) throw new DatabaseRequestError(502);
  return normalized;
}
function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseRequestError(502);
  return value as Readonly<Record<string, unknown>>;
}
function safeInteger(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new DatabaseRequestError(502);
  return value;
}
function parseEntityRow(value: unknown): EntityRow {
  const row = objectRecord(value);
  return { tenant_id: exactString(row.tenant_id), entity_type: exactString(row.entity_type), entity_id: exactString(row.entity_id), data: row.data, version: safeInteger(row.version, 1) };
}
function parseSessionRow(value: unknown): SessionRow {
  const row = objectRecord(value);
  return { id: exactString(row.id), tenant_id: exactString(row.tenant_id), actor_id: exactString(row.actor_id), issued_at: exactString(row.issued_at), idle_expires_at: exactString(row.idle_expires_at), absolute_expires_at: exactString(row.absolute_expires_at), idle_timeout_ms: safeInteger(row.idle_timeout_ms, 60000), ...(typeof row.revoked_at === 'string' ? { revoked_at: row.revoked_at } : {}) };
}
function parseGrantRow(value: unknown): AccessGrantRow {
  const row = objectRecord(value);
  return { tenant_id: exactString(row.tenant_id), id: exactString(row.id), subject_id: exactString(row.subject_id), capability: exactString(row.capability), granted_by: exactString(row.granted_by), granted_at: exactString(row.granted_at), ...(typeof row.revoked_at === 'string' ? { revoked_at: row.revoked_at } : {}) };
}
function parseAuditRow(value: unknown): AuditRow {
  const row = objectRecord(value);
  if (!Array.isArray(row.changed_fields) || !row.changed_fields.every(item => typeof item === 'string')) throw new DatabaseRequestError(502);
  return { tenant_id: exactString(row.tenant_id), id: exactString(row.id), resource_type: exactString(row.resource_type), resource_id: exactString(row.resource_id), action: exactString(row.action), actor_id: exactString(row.actor_id), occurred_at: exactString(row.occurred_at), changed_fields: Object.freeze([...row.changed_fields]) };
}
function parseOutboxRow(value: unknown): OutboxRow {
  const row = objectRecord(value);
  const payload = objectRecord(row.payload);
  return Object.freeze({
    tenant_id: exactString(row.tenant_id),
    id: exactString(row.id),
    event_type: exactString(row.event_type),
    aggregate_id: exactString(row.aggregate_id),
    actor_id: exactString(row.actor_id),
    occurred_at: exactString(row.occurred_at),
    schema_version: safeInteger(row.schema_version, 1),
    ...(typeof row.correlation_id === 'string' ? { correlation_id: row.correlation_id } : {}),
    payload: Object.freeze({ ...payload }),
    delivery_attempts: safeInteger(row.delivery_attempts, 1),
  });
}
export interface AuditQuery { tenantId: string; resourceType?: string; resourceId?: string; action?: string; actorId?: string; from?: string; to?: string; limit: number }

export class SupabaseRestDatabase {
  readonly #config?: DatabaseConfig;
  readonly #fetch: typeof fetch;
  constructor(config: DatabaseConfig | undefined = databaseConfigFromEnv(), fetcher: typeof fetch = fetch) { this.#config = config; this.#fetch = fetcher; }
  get configured(): boolean { return Boolean(this.#config); }
  async ready(): Promise<boolean> { if (!this.#config) return false; try { await this.#request('/rest/v1/eutaktos_entities?select=entity_id&limit=1'); return true; } catch { return false; } }
  async session(sessionId: string): Promise<SessionRow | undefined> {
    const params = new URLSearchParams({ select: 'id,tenant_id,actor_id,issued_at,idle_expires_at,absolute_expires_at,idle_timeout_ms,revoked_at', id: `eq.${sessionId}`, revoked_at: 'is.null', limit: '1' });
    const rows = await this.#array(`/rest/v1/eutaktos_sessions?${params}`); return rows[0] ? parseSessionRow(rows[0]) : undefined;
  }
  async rotateSession(sessionId: string, nextSessionId: string, rotatedAt: string): Promise<SessionRow> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_rotate_session', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({p_session_id:sessionId,p_next_session_id:nextSessionId,p_rotated_at:rotatedAt}) });
    if (!Array.isArray(value) || value.length !== 1) throw new DatabaseRequestError(502);
    return parseSessionRow(value[0]);
  }
  async activeGrants(tenantId: string, subjectId: string): Promise<readonly AccessGrantRow[]> {
    const params = new URLSearchParams({ select: 'tenant_id,id,subject_id,capability,granted_by,granted_at,revoked_at', tenant_id: `eq.${tenantId}`, subject_id: `eq.${subjectId}`, revoked_at: 'is.null', order: 'capability.asc,id.asc' });
    return Object.freeze((await this.#array(`/rest/v1/eutaktos_access_grants?${params}`)).map(parseGrantRow));
  }
  async grantsForSubject(tenantId: string, subjectId: string): Promise<readonly AccessGrantRow[]> {
    const params = new URLSearchParams({ select: 'tenant_id,id,subject_id,capability,granted_by,granted_at,revoked_at', tenant_id: `eq.${tenantId}`, subject_id: `eq.${subjectId}`, order: 'granted_at.desc,id.asc' });
    return Object.freeze((await this.#array(`/rest/v1/eutaktos_access_grants?${params}`)).map(parseGrantRow));
  }
  async grantById(tenantId: string, grantId: string): Promise<AccessGrantRow | undefined> {
    const params = new URLSearchParams({ select:'tenant_id,id,subject_id,capability,granted_by,granted_at,revoked_at', tenant_id:`eq.${tenantId}`, id:`eq.${grantId}`, limit:'1' });
    const rows = await this.#array(`/rest/v1/eutaktos_access_grants?${params}`);
    return rows[0] ? parseGrantRow(rows[0]) : undefined;
  }
  async entities(tenantId: string, entityType: string): Promise<readonly EntityRow[]> {
    const params = new URLSearchParams({ select: 'tenant_id,entity_type,entity_id,data,version', tenant_id: `eq.${tenantId}`, entity_type: `eq.${entityType}`, order: 'entity_id.asc' });
    return Object.freeze((await this.#array(`/rest/v1/eutaktos_entities?${params}`)).map(parseEntityRow));
  }
  async entity(tenantId: string, entityType: string, entityId: string): Promise<EntityRow | undefined> {
    const params = new URLSearchParams({ select: 'tenant_id,entity_type,entity_id,data,version', tenant_id: `eq.${tenantId}`, entity_type: `eq.${entityType}`, entity_id: `eq.${entityId}`, limit: '1' });
    const rows = await this.#array(`/rest/v1/eutaktos_entities?${params}`); return rows[0] ? parseEntityRow(rows[0]) : undefined;
  }
  async audit(query: AuditQuery): Promise<readonly AuditRow[]> {
    const params = new URLSearchParams({ select: 'tenant_id,id,resource_type,resource_id,action,actor_id,occurred_at,changed_fields', tenant_id: `eq.${query.tenantId}`, order: 'occurred_at.desc,id.desc', limit: String(query.limit) });
    if (query.resourceType) params.set('resource_type', `eq.${query.resourceType}`); if (query.resourceId) params.set('resource_id', `eq.${query.resourceId}`); if (query.action) params.set('action', `eq.${query.action}`); if (query.actorId) params.set('actor_id', `eq.${query.actorId}`); if (query.from) params.set('occurred_at', `gte.${query.from}`); if (query.to) params.append('occurred_at', `lte.${query.to}`);
    return Object.freeze((await this.#array(`/rest/v1/eutaktos_audit?${params}`)).map(parseAuditRow));
  }
  async claimOutbox(limit = 25): Promise<readonly OutboxRow[]> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_claim_outbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_limit:limit})});
    if(!Array.isArray(value)) throw new DatabaseRequestError(502);
    return Object.freeze(value.map(parseOutboxRow));
  }
  async claimNotificationOutbox(limit = 25): Promise<readonly OutboxRow[]> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_claim_notification_outbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_limit:limit})});
    if(!Array.isArray(value)) throw new DatabaseRequestError(502);
    return Object.freeze(value.map(parseOutboxRow));
  }
  async markOutboxDelivered(tenantId:string,id:string,deliveredAt:string):Promise<void>{ await this.#request('/rest/v1/rpc/eutaktos_mark_outbox_delivered',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_tenant_id:tenantId,p_id:id,p_delivered_at:deliveredAt})}); }
  async markOutboxFailed(tenantId:string,id:string,errorCode:'provider-unconfigured'|'provider-unavailable'|'provider-rejected'|'invalid-event'):Promise<void>{ await this.#request('/rest/v1/rpc/eutaktos_mark_outbox_failed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_tenant_id:tenantId,p_id:id,p_error_code:errorCode})}); }
  async applyEntityChange(input: Readonly<Record<string, unknown>>): Promise<void> { await this.#request('/rest/v1/rpc/eutaktos_apply_entity_change', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(input) }); }
  async applyAssignmentReminderIntent(input: Readonly<Record<string, unknown>>): Promise<string> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_apply_assignment_reminder_intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (typeof value !== 'string' || !value.trim()) throw new DatabaseRequestError(502);
    return value;
  }
  async applyHourglassMigrationCommit(input: Readonly<Record<string, unknown>>): Promise<{ outcome: 'applied' | 'already-applied' }> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_apply_hourglass_migration_commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const record = objectRecord(value);
    if (record.outcome !== 'applied' && record.outcome !== 'already-applied') throw new DatabaseRequestError(502);
    return { outcome: record.outcome };
  }
  async rollbackHourglassCreateMigration(input: Readonly<Record<string, unknown>>): Promise<{ outcome: 'rolled-back' | 'already-rolled-back' }> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_rollback_hourglass_create_migration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const record = objectRecord(value);
    if (record.outcome !== 'rolled-back' && record.outcome !== 'already-rolled-back') throw new DatabaseRequestError(502);
    return { outcome: record.outcome };
  }
  async deleteEntityChange(input: Readonly<Record<string, unknown>>): Promise<void> { await this.#request('/rest/v1/rpc/eutaktos_delete_entity_change', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(input) }); }
  async createGrantChange(input: Readonly<Record<string, unknown>>): Promise<void> { await this.#request('/rest/v1/rpc/eutaktos_apply_grant_change', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(input) }); }
  async revokeSession(sessionId: string): Promise<void> { const params = new URLSearchParams({ id: `eq.${sessionId}`, revoked_at: 'is.null' }); await this.#request(`/rest/v1/eutaktos_sessions?${params}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ revoked_at: new Date().toISOString() }) }); }
  async revokeAllSessions(tenantId: string, actorId: string): Promise<void> { const params = new URLSearchParams({ tenant_id: `eq.${tenantId}`, actor_id: `eq.${actorId}`, revoked_at: 'is.null' }); await this.#request(`/rest/v1/eutaktos_sessions?${params}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ revoked_at: new Date().toISOString() }) }); }

  async listAssignmentHistory(tenantId: string): Promise<readonly AssignmentHistoryRow[]> {
    const value = await this.#request('/rest/v1/rpc/eutaktos_list_assignment_history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_tenant_id: tenantId }) });
    if (!Array.isArray(value)) throw new DatabaseRequestError(502);
    return Object.freeze(value.map((row: unknown) => parseAssignmentHistoryRow(row, tenantId)));
  }

  async recordAssignmentHistory(input: Readonly<Record<string, unknown>>): Promise<void> {
    await this.#request('/rest/v1/rpc/eutaktos_record_assignment_history', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(input) });
  }

  async #array(path: string): Promise<readonly unknown[]> { const value = await this.#request(path); if (!Array.isArray(value)) throw new DatabaseRequestError(502); return value; }
  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    const config = this.#config; if (!config) throw new DatabaseNotConfiguredError();
    const authHeaders: Record<string, string> = { Accept: 'application/json', apikey: config.serviceRoleKey };
    if (!config.serviceRoleKey.startsWith('sb_secret_')) authHeaders.Authorization = `Bearer ${config.serviceRoleKey}`;
    const response = await this.#fetch(`${config.url}${path}`, { ...init, headers: { ...authHeaders, ...init.headers } });
    if (!response.ok) throw new DatabaseRequestError(response.status);
    if (response.status === 204 || response.headers.get('content-length') === '0') return undefined;
    const contentType = response.headers.get('content-type') ?? ''; if (!contentType.toLowerCase().includes('application/json')) return undefined;
    try { return await response.json(); } catch { throw new DatabaseRequestError(502); }
  }
}

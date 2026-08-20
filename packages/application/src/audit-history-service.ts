import {
  assertAuditTenant,
  assertCapability,
  type AccessContext,
  type AuditEvent,
  type AuditedResourceType,
} from '@eutaktos/domain';

export type AuditAction = AuditEvent['action'];

export interface AuditHistoryQuery {
  resourceType?: AuditedResourceType;
  resourceId?: string;
  action?: AuditAction;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface AuditHistorySource {
  listAudit(context: AccessContext): readonly Readonly<AuditEvent>[];
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function parseInstant(value: string, field: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${field} must be a valid ISO date`);
  return timestamp;
}

function normalizeFilter(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    throw new Error(`limit must be an integer between 1 and ${MAX_LIMIT}`);
  }
  return value;
}

function cloneAuditEvent(event: AuditEvent): Readonly<AuditEvent> {
  return Object.freeze({
    ...structuredClone(event),
    changedFields: Object.freeze([...event.changedFields]),
  });
}

export class AuditHistoryService {
  readonly #source: AuditHistorySource;

  constructor(source: AuditHistorySource) {
    this.#source = source;
  }

  list(context: AccessContext, query: AuditHistoryQuery = {}): readonly Readonly<AuditEvent>[] {
    assertCapability(context, 'audit.read');

    const resourceId = normalizeFilter(query.resourceId, 'resourceId');
    const actorId = normalizeFilter(query.actorId, 'actorId');
    const from = query.from === undefined ? undefined : parseInstant(query.from, 'from');
    const to = query.to === undefined ? undefined : parseInstant(query.to, 'to');
    if (from !== undefined && to !== undefined && from >= to) {
      throw new Error('from must be earlier than to');
    }
    const limit = normalizeLimit(query.limit);

    const events = this.#source.listAudit(context).map(event => {
      assertAuditTenant(event, context.tenantId);
      return cloneAuditEvent(event);
    });

    const filtered = events.filter(event => {
      const occurredAt = Date.parse(event.occurredAt);
      if (!Number.isFinite(occurredAt)) throw new Error('Audit source returned an invalid timestamp');
      if (query.resourceType !== undefined && event.resourceType !== query.resourceType) return false;
      if (resourceId !== undefined && event.resourceId !== resourceId) return false;
      if (query.action !== undefined && event.action !== query.action) return false;
      if (actorId !== undefined && event.actorId !== actorId) return false;
      if (from !== undefined && occurredAt < from) return false;
      if (to !== undefined && occurredAt >= to) return false;
      return true;
    });

    filtered.sort((left, right) => {
      const timeDelta = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
      return timeDelta || right.id.localeCompare(left.id);
    });

    return Object.freeze(filtered.slice(0, limit));
  }
}

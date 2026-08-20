import {
  createAccessContext,
  type AccessContext,
  type AuditEvent,
  type AuditedResourceType,
} from '@eutaktos/domain';
import type {
  AuditAction,
  AuditHistoryQuery,
} from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

const RESOURCE_TYPES: readonly AuditedResourceType[] = [
  'person',
  'household',
  'service-group',
  'responsibility',
  'delegation',
  'congregation',
  'eligibility',
  'availability',
  'emergency-contact',
];
const ACTIONS: readonly AuditAction[] = ['create', 'update', 'delete', 'grant', 'revoke'];

export interface AuditHistoryTransportRequest extends TransportRequest {
  query?: Readonly<Record<string, unknown>>;
}

export interface AuditHistoryDto {
  id: string;
  resourceType: AuditedResourceType;
  resourceId: string;
  action: AuditAction;
  actorId: string;
  occurredAt: string;
  changedFields: readonly string[];
}

export interface AuditHistoryPort {
  list(context: AccessContext, query?: AuditHistoryQuery): readonly Readonly<AuditEvent>[];
}

function toContext(principal: VerifiedPrincipal | undefined): Readonly<AccessContext> | undefined {
  if (!principal) return undefined;
  return createAccessContext({
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    capabilities: principal.capabilities,
  });
}

function queryObject(value: AuditHistoryTransportRequest['query']): Readonly<Record<string, unknown>> {
  return value ?? {};
}

function rejectUnknownQueryKeys(query: Readonly<Record<string, unknown>>): void {
  const allowed = new Set(['resourceType', 'resourceId', 'action', 'actorId', 'from', 'to', 'limit']);
  const unknown = Object.keys(query).filter(key => !allowed.has(key));
  if (unknown.length) throw new Error(`Unknown query fields: ${unknown.sort().join(', ')}`);
}

function optionalString(query: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  field: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`Unsupported ${field}: ${value}`);
  return value as T;
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{1,3}$/.test(value)) throw new Error('limit must be an integer');
  return Number(value);
}

function parseQuery(value: AuditHistoryTransportRequest['query']): AuditHistoryQuery {
  const query = queryObject(value);
  rejectUnknownQueryKeys(query);
  const resourceType = parseEnum(optionalString(query, 'resourceType'), RESOURCE_TYPES, 'resourceType');
  const resourceId = optionalString(query, 'resourceId');
  const action = parseEnum(optionalString(query, 'action'), ACTIONS, 'action');
  const actorId = optionalString(query, 'actorId');
  const from = optionalString(query, 'from');
  const to = optionalString(query, 'to');
  const limit = parseLimit(optionalString(query, 'limit'));

  return {
    ...(resourceType !== undefined ? { resourceType } : {}),
    ...(resourceId !== undefined ? { resourceId } : {}),
    ...(action !== undefined ? { action } : {}),
    ...(actorId !== undefined ? { actorId } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

function assertNoBody(body: unknown): void {
  if (body !== undefined) throw new Error('Request body is not allowed');
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (
    message.startsWith('Unknown query fields:') ||
    message.startsWith('Unsupported resourceType:') ||
    message.startsWith('Unsupported action:') ||
    message.includes('must be a string') ||
    message.includes('must be an integer') ||
    message.includes('must be a valid ISO date') ||
    message.includes('must be earlier than') ||
    message.includes('is required') ||
    message.includes('is too long') ||
    message === 'Request body is not allowed'
  ) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

export function toAuditHistoryDto(event: AuditEvent): AuditHistoryDto {
  return {
    id: event.id,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    action: event.action,
    actorId: event.actorId,
    occurredAt: event.occurredAt,
    changedFields: [...event.changedFields],
  };
}

export class AuditHistoryHttpTransport {
  readonly #history: AuditHistoryPort;

  constructor(history: AuditHistoryPort) {
    this.#history = history;
  }

  list(request: AuditHistoryTransportRequest): TransportResponse<readonly AuditHistoryDto[] | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return { status: 401, body: { error: 'Unauthorized' } };
    try {
      assertNoBody(request.body);
      const events = this.#history.list(context, parseQuery(request.query));
      return { status: 200, body: events.map(toAuditHistoryDto) };
    } catch (error) {
      return safeError(error);
    }
  }
}

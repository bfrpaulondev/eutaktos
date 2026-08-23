export type AuditResourceType =
  | 'person'
  | 'household'
  | 'service-group'
  | 'responsibility'
  | 'delegation'
  | 'congregation'
  | 'eligibility'
  | 'availability'
  | 'emergency-contact'
  | 'access-grant'
  | 'session'
  | 'midweek-meeting'
  | 'student-assignment'
  | 'non-student-assignment'
  | 'weekend-meeting'
  | 'public-talk-assignment';

export type AuditAction = 'create' | 'update' | 'delete' | 'grant' | 'revoke';

export interface AuditHistoryDto {
  id: string;
  resourceType: AuditResourceType;
  resourceId: string;
  action: AuditAction;
  actorId: string;
  occurredAt: string;
  changedFields: readonly string[];
}

export interface AuditHistoryFilters {
  resourceType?: AuditResourceType;
  resourceId?: string;
  action?: AuditAction;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface AuditHistoryApi {
  list(filters?: AuditHistoryFilters, signal?: AbortSignal): Promise<readonly AuditHistoryDto[]>;
}

const RESOURCE_TYPES = new Set<AuditResourceType>([
  'person', 'household', 'service-group', 'responsibility', 'delegation', 'congregation',
  'eligibility', 'availability', 'emergency-contact', 'access-grant', 'session',
  'midweek-meeting', 'student-assignment', 'non-student-assignment', 'weekend-meeting',
  'public-talk-assignment',
]);
const ACTIONS = new Set<AuditAction>(['create', 'update', 'delete', 'grant', 'revoke']);
const RESPONSE_KEYS = new Set(['id', 'resourceType', 'resourceId', 'action', 'actorId', 'occurredAt', 'changedFields']);

function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

export function parseAuditHistoryItem(value: unknown): AuditHistoryDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid audit history API response');
  }
  const candidate = value as Record<string, unknown>;
  const unknown = Object.keys(candidate).filter(key => !RESPONSE_KEYS.has(key));
  if (unknown.length) throw new Error('Invalid audit history API response');
  if (
    !validIdentifier(candidate.id) ||
    typeof candidate.resourceType !== 'string' ||
    !RESOURCE_TYPES.has(candidate.resourceType as AuditResourceType) ||
    !validIdentifier(candidate.resourceId) ||
    typeof candidate.action !== 'string' ||
    !ACTIONS.has(candidate.action as AuditAction) ||
    !validIdentifier(candidate.actorId) ||
    typeof candidate.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(candidate.occurredAt)) ||
    !Array.isArray(candidate.changedFields) ||
    candidate.changedFields.some(field => !validIdentifier(field))
  ) {
    throw new Error('Invalid audit history API response');
  }
  return {
    id: candidate.id,
    resourceType: candidate.resourceType as AuditResourceType,
    resourceId: candidate.resourceId,
    action: candidate.action as AuditAction,
    actorId: candidate.actorId,
    occurredAt: candidate.occurredAt,
    changedFields: [...candidate.changedFields] as string[],
  };
}

export function parseAuditHistoryResponse(value: unknown): readonly AuditHistoryDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid audit history API response');
  return value.map(parseAuditHistoryItem);
}

function buildQuery(filters: AuditHistoryFilters): string {
  const query = new URLSearchParams();
  if (filters.resourceType) query.set('resourceType', filters.resourceType);
  if (filters.resourceId?.trim()) query.set('resourceId', filters.resourceId.trim());
  if (filters.action) query.set('action', filters.action);
  if (filters.actorId?.trim()) query.set('actorId', filters.actorId.trim());
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  if (filters.limit !== undefined) {
    if (!Number.isInteger(filters.limit) || filters.limit < 1 || filters.limit > 200) {
      throw new Error('Invalid audit history limit');
    }
    query.set('limit', String(filters.limit));
  }
  return query.toString();
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid API response');
  }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  return new Error(typeof message === 'string' ? message : `Audit history request failed (${status})`);
}

export function createAuditHistoryApi(fetcher: typeof fetch = fetch): AuditHistoryApi {
  return {
    async list(filters = {}, signal) {
      const query = buildQuery(filters);
      const response = await fetcher(`/api/audit/history${query ? `?${query}` : ''}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseAuditHistoryResponse(body);
    },
  };
}

export const auditHistoryApi = createAuditHistoryApi();
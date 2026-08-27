export const ACCESS_CAPABILITIES = [
  'people.read', 'people.write', 'people-map.read', 'people-map.write',
  'eligibility.read', 'eligibility.write',
  'availability.read', 'availability.write',
  'emergency-contacts.read', 'emergency-contacts.write',
  'responsibilities.read', 'responsibilities.write',
  'delegations.read', 'delegations.write',
  'schedule.read', 'schedule.write',
  'reports.read', 'reports.write',
  'review.read', 'review.write',
  'audit.read', 'access.manage', 'tenant.manage',
] as const;

export type Capability = (typeof ACCESS_CAPABILITIES)[number];

export interface AccessGrantDto {
  id: string;
  subjectId: string;
  capability: Capability;
  grantedAt: string;
  revokedAt?: string;
}

export interface AccessGrantApi {
  list(subjectId: string, signal?: AbortSignal): Promise<readonly AccessGrantDto[]>;
  grant(subjectId: string, capability: Capability): Promise<AccessGrantDto>;
  revoke(grantId: string): Promise<AccessGrantDto>;
}

const capabilitySet = new Set<string>(ACCESS_CAPABILITIES);
const RESPONSE_KEYS = new Set(['id', 'subjectId', 'capability', 'grantedAt', 'revokedAt']);

function identifier(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) throw new Error(`Invalid ${field}`);
  return normalized;
}

export function parseAccessGrant(value: unknown): AccessGrantDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid access grant API response');
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some(key => !RESPONSE_KEYS.has(key))) throw new Error('Invalid access grant API response');
  if (
    typeof candidate.id !== 'string' || !candidate.id.trim() ||
    typeof candidate.subjectId !== 'string' || !candidate.subjectId.trim() ||
    typeof candidate.capability !== 'string' || !capabilitySet.has(candidate.capability) ||
    typeof candidate.grantedAt !== 'string' || !Number.isFinite(Date.parse(candidate.grantedAt)) ||
    (candidate.revokedAt !== undefined && (typeof candidate.revokedAt !== 'string' || !Number.isFinite(Date.parse(candidate.revokedAt))))
  ) {
    throw new Error('Invalid access grant API response');
  }
  return {
    id: candidate.id,
    subjectId: candidate.subjectId,
    capability: candidate.capability as Capability,
    grantedAt: candidate.grantedAt,
    ...(typeof candidate.revokedAt === 'string' ? { revokedAt: candidate.revokedAt } : {}),
  };
}

function parseList(value: unknown): readonly AccessGrantDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid access grant API response');
  return value.map(parseAccessGrant);
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  return new Error(typeof message === 'string' ? message : `Access grant request failed (${status})`);
}

export function createAccessGrantApi(fetcher: typeof fetch = fetch): AccessGrantApi {
  return {
    async list(subjectId, signal) {
      const id = identifier(subjectId, 'subjectId');
      const response = await fetcher(`/api/access/subjects/${encodeURIComponent(id)}/grants`, {
        method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseList(body);
    },
    async grant(subjectId, capability) {
      const id = identifier(subjectId, 'subjectId');
      if (!capabilitySet.has(capability)) throw new Error('Invalid capability');
      const response = await fetcher('/api/access/grants', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: id, capability }),
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseAccessGrant(body);
    },
    async revoke(grantId) {
      const id = identifier(grantId, 'grantId');
      const response = await fetcher(`/api/access/grants/${encodeURIComponent(id)}`, {
        method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json' },
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseAccessGrant(body);
    },
  };
}

export const accessGrantApi = createAccessGrantApi();
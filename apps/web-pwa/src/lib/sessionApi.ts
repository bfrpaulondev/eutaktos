import { ACCESS_CAPABILITIES, type Capability } from './accessGrantApi';

export interface CurrentSessionDto {
  actorId: string;
  capabilities: readonly Capability[];
}

export interface SessionApi {
  current(signal?: AbortSignal): Promise<CurrentSessionDto>;
  rotate(): Promise<void>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
}

const capabilitySet = new Set<string>(ACCESS_CAPABILITIES);
const SESSION_KEYS = new Set(['actorId', 'capabilities']);

function parseActorId(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid session API response');
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) throw new Error('Invalid session API response');
  return normalized;
}

export function parseCurrentSession(value: unknown): CurrentSessionDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid session API response');
  }

  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some(key => !SESSION_KEYS.has(key)) || !Array.isArray(candidate.capabilities)) {
    throw new Error('Invalid session API response');
  }

  const capabilities: Capability[] = [];
  const seen = new Set<string>();
  for (const capability of candidate.capabilities) {
    if (typeof capability !== 'string' || !capabilitySet.has(capability) || seen.has(capability)) {
      throw new Error('Invalid session API response');
    }
    seen.add(capability);
    capabilities.push(capability as Capability);
  }

  return Object.freeze({
    actorId: parseActorId(candidate.actorId),
    capabilities: Object.freeze(capabilities),
  });
}

async function readOptionalJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function requestError(status: number, body: unknown): Error {
  const serverError = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as { error?: unknown }).error
    : undefined;
  if (status >= 400 && status < 500 && typeof serverError === 'string' && serverError.length <= 120) {
    return new Error(serverError);
  }
  return new Error(`Session request failed (${status})`);
}

async function mutation(fetcher: typeof fetch, path: string): Promise<void> {
  const response = await fetcher(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body = await readOptionalJson(response);
  if (!response.ok) throw requestError(response.status, body);
}

export function createSessionApi(fetcher: typeof fetch = fetch): SessionApi {
  return {
    async current(signal) {
      const response = await fetcher('/api/session', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readOptionalJson(response);
      if (!response.ok) throw requestError(response.status, body);
      return parseCurrentSession(body);
    },

    rotate() {
      return mutation(fetcher, '/api/session/rotate');
    },

    logout() {
      return mutation(fetcher, '/api/session/logout');
    },

    logoutAll() {
      return mutation(fetcher, '/api/session/logout-all');
    },
  };
}

export const sessionApi = createSessionApi();

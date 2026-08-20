export interface PersonProfileDto {
  id: string;
  displayName: string;
  preferredLocale?: string;
  active: boolean;
}

export interface CreatePersonPayload {
  displayName: string;
  preferredLocale?: string;
  active?: boolean;
}

export interface PeopleApi {
  list(signal?: AbortSignal): Promise<readonly PersonProfileDto[]>;
  create(input: CreatePersonPayload): Promise<PersonProfileDto>;
}

interface ErrorBody {
  error?: unknown;
}

function isPersonProfile(value: unknown): value is PersonProfileDto {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.displayName === 'string' &&
    typeof candidate.active === 'boolean' &&
    (candidate.preferredLocale === undefined || typeof candidate.preferredLocale === 'string')
  );
}

export function parsePeopleResponse(value: unknown): readonly PersonProfileDto[] {
  if (!Array.isArray(value) || !value.every(isPersonProfile)) {
    throw new Error('Invalid People API response');
  }
  return value;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid API response');
  }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? message : `People API request failed (${status})`);
}

export function createPeopleApi(fetcher: typeof fetch = fetch): PeopleApi {
  return {
    async list(signal) {
      const response = await fetcher('/api/people', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parsePeopleResponse(body);
    },

    async create(input) {
      const response = await fetcher('/api/people', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      if (!isPersonProfile(body)) throw new Error('Invalid People API response');
      return body;
    },
  };
}

export const peopleApi = createPeopleApi();

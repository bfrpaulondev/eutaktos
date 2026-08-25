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

export interface UpdatePersonPayload {
  displayName?: string;
  preferredLocale?: string | null;
  active?: boolean;
}

export interface PeopleApi {
  list(signal?: AbortSignal): Promise<readonly PersonProfileDto[]>;
  create(input: CreatePersonPayload): Promise<PersonProfileDto>;
  update(personId: string, input: UpdatePersonPayload): Promise<PersonProfileDto>;
}

interface ErrorBody {
  error?: unknown;
}

function parsePersonProfile(value: unknown): PersonProfileDto {
  if (!value || typeof value !== 'object') throw new Error('Invalid People API response');
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.displayName !== 'string' ||
    typeof candidate.active !== 'boolean' ||
    (candidate.preferredLocale !== undefined && typeof candidate.preferredLocale !== 'string')
  ) {
    throw new Error('Invalid People API response');
  }

  return {
    id: candidate.id,
    displayName: candidate.displayName,
    ...(typeof candidate.preferredLocale === 'string' ? { preferredLocale: candidate.preferredLocale } : {}),
    active: candidate.active,
  };
}

export function parsePeopleResponse(value: unknown): readonly PersonProfileDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid People API response');
  return value.map(parsePersonProfile);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid API response');
  }
}

function apiError(status: number, body: unknown): Error {
  if (status >= 500) return new Error(`People API request failed (${status})`);
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? `${message} (${status})` : `People API request failed (${status})`);
}

function updatePayload(input: UpdatePersonPayload): UpdatePersonPayload {
  return {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.preferredLocale !== undefined ? { preferredLocale: input.preferredLocale } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };
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
      return parsePersonProfile(body);
    },

    async update(personId, input) {
      const response = await fetcher(`/api/people/${encodeURIComponent(personId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload(input)),
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parsePersonProfile(body);
    },
  };
}

export const peopleApi = createPeopleApi();
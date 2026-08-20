export interface HouseholdDto {
  id: string;
  name: string;
  memberIds: readonly string[];
}

export interface CreateHouseholdPayload {
  name: string;
  memberIds: string[];
}

export interface UpdateHouseholdPayload {
  name?: string;
  memberIds?: string[];
}

export interface HouseholdsApi {
  list(signal?: AbortSignal): Promise<readonly HouseholdDto[]>;
  get(householdId: string, signal?: AbortSignal): Promise<HouseholdDto>;
  create(input: CreateHouseholdPayload, signal?: AbortSignal): Promise<HouseholdDto>;
  update(householdId: string, input: UpdateHouseholdPayload, signal?: AbortSignal): Promise<HouseholdDto>;
  delete(householdId: string, signal?: AbortSignal): Promise<void>;
}

interface ErrorBody { error?: unknown }

function parseHousehold(value: unknown): HouseholdDto {
  if (!value || typeof value !== 'object') throw new Error('Invalid Households API response');
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.memberIds)
  ) throw new Error('Invalid Households API response');

  const memberIds = candidate.memberIds;
  if (!memberIds.every((m): m is string => typeof m === 'string')) {
    throw new Error('Invalid Households API response');
  }

  return {
    id: candidate.id,
    name: candidate.name,
    memberIds: memberIds as string[],
  };
}

export function parseHouseholdList(value: unknown): readonly HouseholdDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid Households API response');
  return value.map(parseHousehold);
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? message : `Households API request failed (${status})`);
}

export function createHouseholdsApi(fetcher: typeof fetch = fetch): HouseholdsApi {
  return {
    async list(signal) {
      const response = await fetcher('/api/households', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseHouseholdList(body);
    },

    async get(householdId, signal) {
      const response = await fetcher(`/api/households/${encodeURIComponent(householdId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseHousehold(body);
    },

    async create(input, signal) {
      const response = await fetcher('/api/households', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseHousehold(body);
    },

    async update(householdId, input, signal) {
      const response = await fetcher(`/api/households/${encodeURIComponent(householdId)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseHousehold(body);
    },

    async delete(householdId, signal) {
      const response = await fetcher(`/api/households/${encodeURIComponent(householdId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        signal,
      });
      if (!response.ok) {
        const body = await readJson(response).catch(() => undefined);
        throw apiError(response.status, body);
      }
    },
  };
}

export const householdsApi = createHouseholdsApi();

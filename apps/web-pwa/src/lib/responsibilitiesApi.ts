export interface ResponsibilityDto {
  id: string;
  personId: string;
  responsibilityKey: string;
  startsAt: string;
  endsAt?: string;
}

export interface AssignResponsibilityPayload {
  personId: string;
  responsibilityKey: string;
  startsAt: string;
  endsAt?: string;
}

export interface EndResponsibilityPayload {
  endsAt: string;
}

export interface ResponsibilitiesApi {
  list(signal?: AbortSignal): Promise<readonly ResponsibilityDto[]>;
  get(responsibilityId: string, signal?: AbortSignal): Promise<ResponsibilityDto>;
  assign(input: AssignResponsibilityPayload, signal?: AbortSignal): Promise<ResponsibilityDto>;
  end(responsibilityId: string, input: EndResponsibilityPayload, signal?: AbortSignal): Promise<ResponsibilityDto>;
}

interface ErrorBody { error?: unknown }

function parseResponsibility(value: unknown): ResponsibilityDto {
  if (!value || typeof value !== 'object') throw new Error('Invalid Responsibilities API response');
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.personId !== 'string' ||
    typeof candidate.responsibilityKey !== 'string' ||
    typeof candidate.startsAt !== 'string'
  ) throw new Error('Invalid Responsibilities API response');

  const result: ResponsibilityDto = {
    id: candidate.id,
    personId: candidate.personId,
    responsibilityKey: candidate.responsibilityKey,
    startsAt: candidate.startsAt,
  };

  if (typeof candidate.endsAt === 'string') result.endsAt = candidate.endsAt;

  return result;
}

export function parseResponsibilityList(value: unknown): readonly ResponsibilityDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid Responsibilities API response');
  return value.map(parseResponsibility);
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? message : `Responsibilities API request failed (${status})`);
}

export function createResponsibilitiesApi(fetcher: typeof fetch = fetch): ResponsibilitiesApi {
  return {
    async list(signal) {
      const response = await fetcher('/api/responsibilities', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseResponsibilityList(body);
    },

    async get(responsibilityId, signal) {
      const response = await fetcher(`/api/responsibilities/${encodeURIComponent(responsibilityId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseResponsibility(body);
    },

    async assign(input, signal) {
      const response = await fetcher('/api/responsibilities', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseResponsibility(body);
    },

    async end(responsibilityId, input, signal) {
      const response = await fetcher(`/api/responsibilities/${encodeURIComponent(responsibilityId)}/end`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseResponsibility(body);
    },
  };
}

export const responsibilitiesApi = createResponsibilitiesApi();

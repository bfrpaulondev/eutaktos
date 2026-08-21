export interface AvailabilityPeriodDto {
  id: string;
  startsAt: string;
  endsAt: string;
  reasonCode?: 'away' | 'unavailable' | 'other';
}

export interface CreateAvailabilityPayload {
  startsAt: string;
  endsAt: string;
  reasonCode?: 'away' | 'unavailable' | 'other';
}

export interface AvailabilityApi {
  list(personId: string, signal?: AbortSignal): Promise<readonly AvailabilityPeriodDto[]>;
  add(personId: string, input: CreateAvailabilityPayload, signal?: AbortSignal): Promise<AvailabilityPeriodDto>;
  remove(personId: string, periodId: string, signal?: AbortSignal): Promise<void>;
}

interface ErrorBody { error?: unknown }

export function parsePeriod(value: unknown): AvailabilityPeriodDto {
  if (!value || typeof value !== 'object') throw new Error('Invalid availability API response');
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.startsAt !== 'string' ||
    typeof candidate.endsAt !== 'string'
  ) throw new Error('Invalid availability API response');

  return {
    id: candidate.id,
    startsAt: candidate.startsAt,
    endsAt: candidate.endsAt,
    ...(candidate.reasonCode === 'away' || candidate.reasonCode === 'unavailable' || candidate.reasonCode === 'other'
      ? { reasonCode: candidate.reasonCode as 'away' | 'unavailable' | 'other' }
      : {}),
  };
}

export function parseList(value: unknown): readonly AvailabilityPeriodDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid availability API response');
  return value.map(parsePeriod);
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? message : `Availability API request failed (${status})`);
}

function basePath(personId: string): string {
  return `/api/people/${encodeURIComponent(personId)}/availability`;
}

export function createAvailabilityApi(fetcher: typeof fetch = fetch): AvailabilityApi {
  return {
    async list(personId, signal) {
      const response = await fetcher(basePath(personId), {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseList(body);
    },

    async add(personId, input, signal) {
      const response = await fetcher(basePath(personId), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parsePeriod(body);
    },

    async remove(personId, periodId, signal) {
      const response = await fetcher(`${basePath(personId)}/${encodeURIComponent(periodId)}`, {
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

export const availabilityApi = createAvailabilityApi();

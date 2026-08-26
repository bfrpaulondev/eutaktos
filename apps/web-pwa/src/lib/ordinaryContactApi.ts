export interface OrdinaryContactDto {
  readonly phone?: string;
  readonly email?: string;
  readonly address?: string;
}

export interface OrdinaryContactApi {
  get(personId: string, signal?: AbortSignal): Promise<OrdinaryContactDto>;
  update(personId: string, input: OrdinaryContactDto, signal?: AbortSignal): Promise<OrdinaryContactDto>;
}

interface ErrorBody { error?: unknown }

function parse(value: unknown): OrdinaryContactDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid ordinary contact API response');
  const candidate = value as Record<string, unknown>;
  const allowed = new Set(['phone', 'email', 'address']);
  if (Object.keys(candidate).some(key => !allowed.has(key))) throw new Error('Invalid ordinary contact API response');
  if ((candidate.phone !== undefined && typeof candidate.phone !== 'string') || (candidate.email !== undefined && typeof candidate.email !== 'string') || (candidate.address !== undefined && typeof candidate.address !== 'string')) throw new Error('Invalid ordinary contact API response');
  return Object.freeze({ ...(typeof candidate.phone === 'string' ? { phone: candidate.phone } : {}), ...(typeof candidate.email === 'string' ? { email: candidate.email } : {}), ...(typeof candidate.address === 'string' ? { address: candidate.address } : {}) });
}

async function json(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new Error('Invalid API response'); }
}

function errorFor(response: Response, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? `${message} (${response.status})` : `Ordinary contact API request failed (${response.status})`);
}

function path(personId: string): string {
  return `/api/people/${encodeURIComponent(personId)}/contact`;
}

export function createOrdinaryContactApi(fetcher: typeof fetch = fetch): OrdinaryContactApi {
  return {
    async get(personId, signal) {
      const response = await fetcher(path(personId), { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
      const body = await json(response);
      if (!response.ok) throw errorFor(response, body);
      return parse(body);
    },
    async update(personId, input, signal) {
      const response = await fetcher(path(personId), { method: 'PUT', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
      const body = await json(response);
      if (!response.ok) throw errorFor(response, body);
      return parse(body);
    },
  };
}

export const ordinaryContactApi = createOrdinaryContactApi();

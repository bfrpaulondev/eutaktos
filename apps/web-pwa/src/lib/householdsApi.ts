type ErrorBody = { error?: unknown };

function objectRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function assertExactKeys(candidate: Record<string, unknown>, allowed: readonly string[], message: string): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(candidate).some(key => !allowedSet.has(key))) throw new Error(message);
}

function stringArray(value: unknown, message: string): readonly string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) throw new Error(message);
  return Object.freeze([...value]);
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function safeApiError(prefix: string, status: number, body: unknown): Error {
  if (status >= 500) return new Error(`${prefix} request failed (${status})`);
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  if (typeof message === 'string' && message.length > 0 && message.length <= 300) return new Error(message);
  return new Error(`${prefix} request failed (${status})`);
}

export interface HouseholdDto { id: string; name: string; memberIds: readonly string[] }
export interface CreateHouseholdPayload { name: string; memberIds: string[] }
export interface UpdateHouseholdPayload { name?: string; memberIds?: string[] }
export interface HouseholdsApi {
  list(signal?: AbortSignal): Promise<readonly HouseholdDto[]>;
  get(householdId: string, signal?: AbortSignal): Promise<HouseholdDto>;
  create(input: CreateHouseholdPayload, signal?: AbortSignal): Promise<HouseholdDto>;
  update(householdId: string, input: UpdateHouseholdPayload, signal?: AbortSignal): Promise<HouseholdDto>;
  delete(householdId: string, signal?: AbortSignal): Promise<void>;
}

function parseHousehold(value: unknown): HouseholdDto {
  const message = 'Invalid Households API response';
  const c = objectRecord(value, message);
  assertExactKeys(c, ['id', 'name', 'memberIds'], message);
  if (typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error(message);
  return Object.freeze({ id: c.id, name: c.name, memberIds: stringArray(c.memberIds, message) });
}
export function parseHouseholdList(value: unknown): readonly HouseholdDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid Households API response');
  return Object.freeze(value.map(parseHousehold));
}
function householdCreateBody(input: CreateHouseholdPayload): CreateHouseholdPayload {
  return { name: input.name, memberIds: [...input.memberIds] };
}
function householdUpdateBody(input: UpdateHouseholdPayload): UpdateHouseholdPayload {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.memberIds !== undefined ? { memberIds: [...input.memberIds] } : {}),
  };
}
export function createHouseholdsApi(fetcher: typeof fetch = fetch): HouseholdsApi {
  return {
    async list(signal) {
      const response = await fetcher('/api/households', { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
      const body = await readJson(response); if (!response.ok) throw safeApiError('Households API', response.status, body); return parseHouseholdList(body);
    },
    async get(id, signal) {
      const response = await fetcher(`/api/households/${encodeURIComponent(id)}`, { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
      const body = await readJson(response); if (!response.ok) throw safeApiError('Households API', response.status, body); return parseHousehold(body);
    },
    async create(input, signal) {
      const response = await fetcher('/api/households', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(householdCreateBody(input)), signal });
      const body = await readJson(response); if (!response.ok) throw safeApiError('Households API', response.status, body); return parseHousehold(body);
    },
    async update(id, input, signal) {
      const response = await fetcher(`/api/households/${encodeURIComponent(id)}`, { method: 'PUT', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(householdUpdateBody(input)), signal });
      const body = await readJson(response); if (!response.ok) throw safeApiError('Households API', response.status, body); return parseHousehold(body);
    },
    async delete(id, signal) {
      const response = await fetcher(`/api/households/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin', signal });
      if (!response.ok) { const body = await readJson(response).catch(() => undefined); throw safeApiError('Households API', response.status, body); }
    },
  };
}
export const householdsApi = createHouseholdsApi();

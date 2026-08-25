export interface PersonPostalAddressDto { line1?: string; line2?: string; postalCode?: string; locality?: string; countryCode?: string; }
export interface PersonContactDetailsDto { phone?: string; email?: string; address?: Readonly<PersonPostalAddressDto>; }
export interface PersonProfileDto { id: string; displayName: string; preferredLocale?: string; active: boolean; contact?: Readonly<PersonContactDetailsDto>; }
export interface CreatePersonPayload { displayName: string; preferredLocale?: string; active?: boolean; contact?: PersonContactDetailsDto; }
export interface UpdatePersonPayload { displayName?: string; preferredLocale?: string | null; active?: boolean; contact?: PersonContactDetailsDto | null; }
export interface PeopleApi { list(signal?: AbortSignal): Promise<readonly PersonProfileDto[]>; get(personId: string, signal?: AbortSignal): Promise<PersonProfileDto>; create(input: CreatePersonPayload): Promise<PersonProfileDto>; update(personId: string, input: UpdatePersonPayload): Promise<PersonProfileDto>; }
interface ErrorBody { error?: unknown; }

function optionalString(candidate: Record<string, unknown>, key: string): string | undefined { const value = candidate[key]; if (value === undefined) return undefined; if (typeof value !== 'string') throw new Error('Invalid People API response'); return value; }
function parseAddress(value: unknown): Readonly<PersonPostalAddressDto> | undefined { if (value === undefined) return undefined; if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid People API response'); const candidate = value as Record<string, unknown>; return Object.freeze({ ...(optionalString(candidate, 'line1') !== undefined ? { line1: optionalString(candidate, 'line1') } : {}), ...(optionalString(candidate, 'line2') !== undefined ? { line2: optionalString(candidate, 'line2') } : {}), ...(optionalString(candidate, 'postalCode') !== undefined ? { postalCode: optionalString(candidate, 'postalCode') } : {}), ...(optionalString(candidate, 'locality') !== undefined ? { locality: optionalString(candidate, 'locality') } : {}), ...(optionalString(candidate, 'countryCode') !== undefined ? { countryCode: optionalString(candidate, 'countryCode') } : {}) }); }
function parseContact(value: unknown): Readonly<PersonContactDetailsDto> | undefined { if (value === undefined) return undefined; if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid People API response'); const candidate = value as Record<string, unknown>; const phone = optionalString(candidate, 'phone'); const email = optionalString(candidate, 'email'); const address = parseAddress(candidate.address); return Object.freeze({ ...(phone !== undefined ? { phone } : {}), ...(email !== undefined ? { email } : {}), ...(address ? { address } : {}) }); }

export function parsePersonProfile(value: unknown): PersonProfileDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid People API response');
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || typeof candidate.displayName !== 'string' || typeof candidate.active !== 'boolean' || (candidate.preferredLocale !== undefined && typeof candidate.preferredLocale !== 'string')) throw new Error('Invalid People API response');
  const contact = parseContact(candidate.contact);
  return Object.freeze({ id: candidate.id, displayName: candidate.displayName, ...(typeof candidate.preferredLocale === 'string' ? { preferredLocale: candidate.preferredLocale } : {}), active: candidate.active, ...(contact ? { contact } : {}) });
}
export function parsePeopleResponse(value: unknown): readonly PersonProfileDto[] { if (!Array.isArray(value)) throw new Error('Invalid People API response'); return value.map(parsePersonProfile); }
async function readJson(response: Response): Promise<unknown> { try { return await response.json(); } catch { throw new Error('Invalid API response'); } }
function apiError(status: number, body: unknown): Error { if (status >= 500) return new Error(`People API request failed (${status})`); const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined; return new Error(typeof message === 'string' ? `${message} (${status})` : `People API request failed (${status})`); }
function updatePayload(input: UpdatePersonPayload): UpdatePersonPayload { return { ...(input.displayName !== undefined ? { displayName: input.displayName } : {}), ...(input.preferredLocale !== undefined ? { preferredLocale: input.preferredLocale } : {}), ...(input.active !== undefined ? { active: input.active } : {}), ...(input.contact !== undefined ? { contact: input.contact } : {}) }; }

export function createPeopleApi(fetcher: typeof fetch = fetch): PeopleApi {
  const personRequest = async (url: string, init: RequestInit): Promise<PersonProfileDto> => { const response = await fetcher(url, init); const body = await readJson(response); if (!response.ok) throw apiError(response.status, body); return parsePersonProfile(body); };
  return {
    async list(signal) { const response = await fetcher('/api/people', { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal }); const body = await readJson(response); if (!response.ok) throw apiError(response.status, body); return parsePeopleResponse(body); },
    async get(personId, signal) { return personRequest(`/api/people/${encodeURIComponent(personId)}`, { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal }); },
    async create(input) { return personRequest('/api/people', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); },
    async update(personId, input) { return personRequest(`/api/people/${encodeURIComponent(personId)}`, { method: 'PATCH', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(updatePayload(input)) }); },
  };
}
export const peopleApi = createPeopleApi();

export interface EmergencyContactDto {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
}

export interface EmergencyContactPayload {
  name: string;
  phone: string;
  relationship?: string | null;
}

export interface EmergencyContactsApi {
  list(personId: string, signal?: AbortSignal): Promise<readonly EmergencyContactDto[]>;
  create(personId: string, input: EmergencyContactPayload): Promise<EmergencyContactDto>;
  update(personId: string, contactId: string, input: EmergencyContactPayload): Promise<EmergencyContactDto>;
  remove(personId: string, contactId: string): Promise<void>;
}

interface ErrorBody { error?: unknown }

function parseContact(value: unknown): EmergencyContactDto {
  if (!value || typeof value !== 'object') throw new Error('Invalid emergency contacts API response');
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.phone !== 'string' ||
    (candidate.relationship !== undefined && typeof candidate.relationship !== 'string')
  ) throw new Error('Invalid emergency contacts API response');

  return {
    id: candidate.id,
    name: candidate.name,
    phone: candidate.phone,
    ...(typeof candidate.relationship === 'string' ? { relationship: candidate.relationship } : {}),
  };
}

function parseList(value: unknown): readonly EmergencyContactDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid emergency contacts API response');
  return value.map(parseContact);
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? message : `Emergency contacts API request failed (${status})`);
}

function path(personId: string, contactId?: string): string {
  const base = `/api/people/${encodeURIComponent(personId)}/emergency-contacts`;
  return contactId ? `${base}/${encodeURIComponent(contactId)}` : base;
}

export function createEmergencyContactsApi(fetcher: typeof fetch = fetch): EmergencyContactsApi {
  return {
    async list(personId, signal) {
      const response = await fetcher(path(personId), {
        method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseList(body);
    },
    async create(personId, input) {
      const response = await fetcher(path(personId), {
        method: 'POST', credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseContact(body);
    },
    async update(personId, contactId, input) {
      const response = await fetcher(path(personId, contactId), {
        method: 'PUT', credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseContact(body);
    },
    async remove(personId, contactId) {
      const response = await fetcher(path(personId, contactId), {
        method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        const body = await readJson(response);
        throw apiError(response.status, body);
      }
    },
  };
}

export const emergencyContactsApi = createEmergencyContactsApi();

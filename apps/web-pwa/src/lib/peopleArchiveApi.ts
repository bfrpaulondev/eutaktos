export type PeopleArchiveHistoryEntryDto = Readonly<{
  action: 'archived' | 'restored';
  occurredAt: string;
  reason?: string;
}>;

export type PeopleArchiveStateDto = Readonly<{
  status: 'active' | 'archived';
  current?: Readonly<{ archivedAt: string; reason: string }>;
  history: readonly PeopleArchiveHistoryEntryDto[];
  capabilities: Readonly<{ write: boolean }>;
}>;

export interface PeopleArchiveApi {
  get(personId: string, signal?: AbortSignal): Promise<PeopleArchiveStateDto>;
  archive(personId: string, reason: string, signal?: AbortSignal): Promise<PeopleArchiveStateDto>;
  restore(personId: string, signal?: AbortSignal): Promise<PeopleArchiveStateDto>;
}

const INVALID = 'Invalid People archive response';

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID);
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string') throw new Error(INVALID);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(INVALID);
  return normalized;
}

function instant(value: unknown): string {
  const result = text(value, 100);
  if (!Number.isFinite(Date.parse(result))) throw new Error(INVALID);
  return result;
}

function historyEntry(value: unknown): PeopleArchiveHistoryEntryDto {
  const candidate = record(value);
  if (candidate.action !== 'archived' && candidate.action !== 'restored') throw new Error(INVALID);
  const reason = candidate.reason === undefined ? undefined : text(candidate.reason, 240);
  return Object.freeze({
    action: candidate.action,
    occurredAt: instant(candidate.occurredAt),
    ...(reason ? { reason } : {}),
  });
}

export function parsePeopleArchiveState(value: unknown): PeopleArchiveStateDto {
  const candidate = record(value);
  if (candidate.status !== 'active' && candidate.status !== 'archived') throw new Error(INVALID);
  if (!Array.isArray(candidate.history)) throw new Error(INVALID);
  const capabilities = record(candidate.capabilities);
  if (typeof capabilities.write !== 'boolean') throw new Error(INVALID);

  let current: Readonly<{ archivedAt: string; reason: string }> | undefined;
  if (candidate.status === 'archived') {
    const rawCurrent = record(candidate.current);
    current = Object.freeze({ archivedAt: instant(rawCurrent.archivedAt), reason: text(rawCurrent.reason, 240) });
  } else if (candidate.current !== undefined) {
    throw new Error(INVALID);
  }

  return Object.freeze({
    status: candidate.status,
    ...(current ? { current } : {}),
    history: Object.freeze(candidate.history.map(historyEntry)),
    capabilities: Object.freeze({ write: capabilities.write }),
  });
}

function personPath(personId: string): string {
  const normalized = personId.trim();
  if (!normalized || normalized.length > 200 || /[\s/?#&=]/.test(normalized)) throw new Error('Invalid personId');
  return `/api/people/${encodeURIComponent(normalized)}/archive`;
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function failure(body: unknown, fallback: string, status: number): Error {
  const message = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  return new Error(`${typeof message === 'string' ? message : fallback} (${status})`);
}

export function createPeopleArchiveApi(fetcher: typeof fetch = fetch): PeopleArchiveApi {
  const request = async (personId: string, init: RequestInit): Promise<PeopleArchiveStateDto> => {
    const response = await fetcher(personPath(personId), {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      ...init,
    });
    const body = await readJson(response);
    if (!response.ok) throw failure(body, 'People archive request failed', response.status);
    return parsePeopleArchiveState(body);
  };

  return {
    get(personId, signal) { return request(personId, { method: 'GET', signal }); },
    archive(personId, reason, signal) { return request(personId, { method: 'POST', body: JSON.stringify({ action: 'archive', reason }), signal }); },
    restore(personId, signal) { return request(personId, { method: 'POST', body: JSON.stringify({ action: 'restore' }), signal }); },
  };
}

export const peopleArchiveApi = createPeopleArchiveApi();

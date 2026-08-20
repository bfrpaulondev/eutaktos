export interface ServiceGroupDto {
  id: string;
  name: string;
  memberIds: readonly string[];
  overseerId?: string;
  assistantId?: string;
}

export interface CreateServiceGroupPayload {
  name: string;
  memberIds: string[];
  overseerId?: string;
  assistantId?: string;
}

export interface UpdateServiceGroupPayload {
  name?: string;
  memberIds?: string[];
  overseerId?: string | null;
  assistantId?: string | null;
}

export interface ServiceGroupsApi {
  list(signal?: AbortSignal): Promise<readonly ServiceGroupDto[]>;
  get(serviceGroupId: string, signal?: AbortSignal): Promise<ServiceGroupDto>;
  create(input: CreateServiceGroupPayload, signal?: AbortSignal): Promise<ServiceGroupDto>;
  update(serviceGroupId: string, input: UpdateServiceGroupPayload, signal?: AbortSignal): Promise<ServiceGroupDto>;
  delete(serviceGroupId: string, signal?: AbortSignal): Promise<void>;
}

interface ErrorBody { error?: unknown }

function parseServiceGroup(value: unknown): ServiceGroupDto {
  if (!value || typeof value !== 'object') throw new Error('Invalid Service Groups API response');
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.memberIds)
  ) throw new Error('Invalid Service Groups API response');

  const memberIds = candidate.memberIds;
  if (!memberIds.every((m): m is string => typeof m === 'string')) {
    throw new Error('Invalid Service Groups API response');
  }

  const result: ServiceGroupDto = {
    id: candidate.id,
    name: candidate.name,
    memberIds: memberIds as string[],
  };

  if (typeof candidate.overseerId === 'string') result.overseerId = candidate.overseerId;
  if (typeof candidate.assistantId === 'string') result.assistantId = candidate.assistantId;

  return result;
}

export function parseServiceGroupList(value: unknown): readonly ServiceGroupDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid Service Groups API response');
  return value.map(parseServiceGroup);
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? message : `Service Groups API request failed (${status})`);
}

export function createServiceGroupsApi(fetcher: typeof fetch = fetch): ServiceGroupsApi {
  return {
    async list(signal) {
      const response = await fetcher('/api/service-groups', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseServiceGroupList(body);
    },

    async get(serviceGroupId, signal) {
      const response = await fetcher(`/api/service-groups/${encodeURIComponent(serviceGroupId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseServiceGroup(body);
    },

    async create(input, signal) {
      const response = await fetcher('/api/service-groups', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseServiceGroup(body);
    },

    async update(serviceGroupId, input, signal) {
      const response = await fetcher(`/api/service-groups/${encodeURIComponent(serviceGroupId)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseServiceGroup(body);
    },

    async delete(serviceGroupId, signal) {
      const response = await fetcher(`/api/service-groups/${encodeURIComponent(serviceGroupId)}`, {
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

export const serviceGroupsApi = createServiceGroupsApi();

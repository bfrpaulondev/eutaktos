export interface EligibilityDecisionDto {
  assignmentTypeId: string;
  enabled: boolean;
  decidedAt: string;
}

export interface SetEligibilityPayload {
  assignmentTypeId: string;
  enabled: boolean;
}

export interface EligibilityApi {
  list(personId: string, signal?: AbortSignal): Promise<readonly EligibilityDecisionDto[]>;
  set(personId: string, input: SetEligibilityPayload): Promise<EligibilityDecisionDto>;
}

interface ErrorBody { error?: unknown }

function parseDecision(value: unknown): EligibilityDecisionDto {
  if (!value || typeof value !== 'object') throw new Error('Invalid eligibility API response');
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.assignmentTypeId !== 'string' ||
    typeof candidate.enabled !== 'boolean' ||
    typeof candidate.decidedAt !== 'string'
  ) throw new Error('Invalid eligibility API response');

  return {
    assignmentTypeId: candidate.assignmentTypeId,
    enabled: candidate.enabled,
    decidedAt: candidate.decidedAt,
  };
}

function parseList(value: unknown): readonly EligibilityDecisionDto[] {
  if (!Array.isArray(value)) throw new Error('Invalid eligibility API response');
  return value.map(parseDecision);
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? message : `Eligibility API request failed (${status})`);
}

function path(personId: string): string {
  return `/api/people/${encodeURIComponent(personId)}/eligibility`;
}

export function createEligibilityApi(fetcher: typeof fetch = fetch): EligibilityApi {
  return {
    async list(personId, signal) {
      const response = await fetcher(path(personId), {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseList(body);
    },

    async set(personId, input) {
      const response = await fetcher(path(personId), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseDecision(body);
    },
  };
}

export const eligibilityApi = createEligibilityApi();

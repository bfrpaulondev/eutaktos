type ErrorBody = { error?: unknown };
const INVALID = 'Invalid People Overview evidence response';

export type ReadyAffectedAssignmentsEvidence = Readonly<{
  status: 'ready';
  affectedPeopleCount: number;
  affectedAssignmentCount: number;
}>;

export type ReadyLongIntervalEvidence = Readonly<{
  status: 'ready';
  candidateCount: number;
  openAssignmentCount: number;
  evaluatedOpenStudentAssignments: number;
}>;

export type UnavailableEvidence = Readonly<{ status: 'unavailable' }>;
export type BlockedEvidence = Readonly<{ status: 'blocked'; requiredBoundary: string }>;

export interface PeopleOverviewEvidenceDto {
  readonly contractVersion: 'people-overview-evidence-v1';
  readonly affectedAssignments: ReadyAffectedAssignmentsEvidence | UnavailableEvidence;
  readonly longInterval: ReadyLongIntervalEvidence | UnavailableEvidence;
  readonly profileCompleteness: BlockedEvidence;
  readonly recentAvailabilityChanges: BlockedEvidence;
}

export interface PeopleOverviewEvidenceApi {
  get(signal?: AbortSignal): Promise<PeopleOverviewEvidenceDto>;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID);
  return value as Readonly<Record<string, unknown>>;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(INVALID);
  return value;
}

function parseUnavailableOrReadyAffected(value: unknown): ReadyAffectedAssignmentsEvidence | UnavailableEvidence {
  const candidate = record(value);
  if (candidate.status === 'unavailable') return Object.freeze({ status: 'unavailable' });
  if (candidate.status !== 'ready') throw new Error(INVALID);
  return Object.freeze({
    status: 'ready',
    affectedPeopleCount: nonNegativeInteger(candidate.affectedPeopleCount),
    affectedAssignmentCount: nonNegativeInteger(candidate.affectedAssignmentCount),
  });
}

function parseUnavailableOrReadyLong(value: unknown): ReadyLongIntervalEvidence | UnavailableEvidence {
  const candidate = record(value);
  if (candidate.status === 'unavailable') return Object.freeze({ status: 'unavailable' });
  if (candidate.status !== 'ready') throw new Error(INVALID);
  return Object.freeze({
    status: 'ready',
    candidateCount: nonNegativeInteger(candidate.candidateCount),
    openAssignmentCount: nonNegativeInteger(candidate.openAssignmentCount),
    evaluatedOpenStudentAssignments: nonNegativeInteger(candidate.evaluatedOpenStudentAssignments),
  });
}

function parseBlocked(value: unknown): BlockedEvidence {
  const candidate = record(value);
  if (candidate.status !== 'blocked' || typeof candidate.requiredBoundary !== 'string' || !candidate.requiredBoundary.trim()) throw new Error(INVALID);
  return Object.freeze({ status: 'blocked', requiredBoundary: candidate.requiredBoundary });
}

export function parsePeopleOverviewEvidence(value: unknown): PeopleOverviewEvidenceDto {
  const candidate = record(value);
  if (candidate.contractVersion !== 'people-overview-evidence-v1') throw new Error(INVALID);
  return Object.freeze({
    contractVersion: 'people-overview-evidence-v1',
    affectedAssignments: parseUnavailableOrReadyAffected(candidate.affectedAssignments),
    longInterval: parseUnavailableOrReadyLong(candidate.longInterval),
    profileCompleteness: parseBlocked(candidate.profileCompleteness),
    recentAvailabilityChanges: parseBlocked(candidate.recentAvailabilityChanges),
  });
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  const safeMessage = typeof message === 'string' && message.length > 0 && message.length <= 300
    ? message
    : 'People Overview evidence request failed';
  return new Error(`${safeMessage} (${status})`);
}

export function createPeopleOverviewEvidenceApi(fetcher: typeof fetch = fetch): PeopleOverviewEvidenceApi {
  return {
    async get(signal) {
      const response = await fetcher('/api/people/overview-evidence', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parsePeopleOverviewEvidence(body);
    },
  };
}

export const peopleOverviewEvidenceApi = createPeopleOverviewEvidenceApi();

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

export type ReadyProfileCompletenessEvidence = Readonly<{
  status: 'ready';
  contractVersion: 'operational-profile-requirements-v1';
  scope: 'active-people';
  requirementCodes: readonly ['PREFERRED_LOCALE'];
  evaluatedPersonCount: number;
  incompletePersonCount: number;
}>;

export type ReadyRecentAvailabilityChangesEvidence = Readonly<{
  status: 'ready';
  contractVersion: 'recent-availability-changes-v1';
  scope: 'active-people';
  windowDays: 14;
  changedPersonCount: number;
  latestChangedAt?: string;
}>;

export type UnavailableEvidence = Readonly<{ status: 'unavailable' }>;

export interface PeopleOverviewEvidenceDto {
  readonly contractVersion: 'people-overview-evidence-v2';
  readonly affectedAssignments: ReadyAffectedAssignmentsEvidence | UnavailableEvidence;
  readonly longInterval: ReadyLongIntervalEvidence | UnavailableEvidence;
  readonly profileCompleteness: ReadyProfileCompletenessEvidence;
  readonly recentAvailabilityChanges: ReadyRecentAvailabilityChangesEvidence | UnavailableEvidence;
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

function parseProfileCompleteness(value: unknown): ReadyProfileCompletenessEvidence {
  const candidate = record(value);
  if (candidate.status !== 'ready' || candidate.contractVersion !== 'operational-profile-requirements-v1' || candidate.scope !== 'active-people') throw new Error(INVALID);
  if (!Array.isArray(candidate.requirementCodes) || candidate.requirementCodes.length !== 1 || candidate.requirementCodes[0] !== 'PREFERRED_LOCALE') throw new Error(INVALID);
  return Object.freeze({
    status: 'ready',
    contractVersion: 'operational-profile-requirements-v1',
    scope: 'active-people',
    requirementCodes: Object.freeze(['PREFERRED_LOCALE'] as const),
    evaluatedPersonCount: nonNegativeInteger(candidate.evaluatedPersonCount),
    incompletePersonCount: nonNegativeInteger(candidate.incompletePersonCount),
  });
}

function parseRecentAvailability(value: unknown): ReadyRecentAvailabilityChangesEvidence | UnavailableEvidence {
  const candidate = record(value);
  if (candidate.status === 'unavailable') return Object.freeze({ status: 'unavailable' });
  if (candidate.status !== 'ready' || candidate.contractVersion !== 'recent-availability-changes-v1' || candidate.scope !== 'active-people' || candidate.windowDays !== 14) throw new Error(INVALID);
  const latestChangedAt = candidate.latestChangedAt;
  if (latestChangedAt !== undefined && (typeof latestChangedAt !== 'string' || !Number.isFinite(Date.parse(latestChangedAt)))) throw new Error(INVALID);
  return Object.freeze({
    status: 'ready',
    contractVersion: 'recent-availability-changes-v1',
    scope: 'active-people',
    windowDays: 14,
    changedPersonCount: nonNegativeInteger(candidate.changedPersonCount),
    ...(latestChangedAt === undefined ? {} : { latestChangedAt }),
  });
}

export function parsePeopleOverviewEvidence(value: unknown): PeopleOverviewEvidenceDto {
  const candidate = record(value);
  if (candidate.contractVersion !== 'people-overview-evidence-v2') throw new Error(INVALID);
  return Object.freeze({
    contractVersion: 'people-overview-evidence-v2',
    affectedAssignments: parseUnavailableOrReadyAffected(candidate.affectedAssignments),
    longInterval: parseUnavailableOrReadyLong(candidate.longInterval),
    profileCompleteness: parseProfileCompleteness(candidate.profileCompleteness),
    recentAvailabilityChanges: parseRecentAvailability(candidate.recentAvailabilityChanges),
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

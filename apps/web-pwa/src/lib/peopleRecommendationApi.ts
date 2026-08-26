import type { RecommendationReasonCode, RecommendationWarningCode } from '@eutaktos/application';

export type RecommendationHistoryDto = Readonly<{
  kind: 'completed-history' | 'no-completed-history';
  lastCompletedMeetingDate?: string;
  daysSinceLastCompletedAssignment?: number;
}>;

export type RecommendationPersonDto = Readonly<{
  personId: string;
  displayName: string;
  status: 'candidate' | 'excluded';
  rank?: number;
  reasons: readonly Readonly<{ code: RecommendationReasonCode }>[];
  warnings: readonly Readonly<{ code: RecommendationWarningCode }>[];
  history: RecommendationHistoryDto;
  sameWeekAssignmentCount: number;
}>;

export interface PeopleRecommendationDto {
  readonly contractVersion: 'people-recommendation-v1';
  readonly evidenceContractVersion: 'px7-evidence-v1';
  readonly inputContractVersion: 'px7-recommendation-input-v1';
  readonly target: Readonly<{
    meetingId: string;
    slotId: string;
    assignmentTypeId: string;
    meetingDate: string;
    startsAt: string;
    endsAt: string;
  }>;
  readonly candidates: readonly RecommendationPersonDto[];
  readonly excluded: readonly RecommendationPersonDto[];
}

const REASON_CODES = new Set<RecommendationReasonCode>([
  'ELIGIBLE',
  'AVAILABLE',
  'NO_MEETING_CONFLICT',
  'NO_WEEKLY_ASSIGNMENT',
  'LONGER_SINCE_LAST_ASSIGNMENT',
  'MEETS_REQUIRED_RESPONSIBILITY',
  'AWAY_DURING_MEETING',
  'NOT_ELIGIBLE',
  'CONFLICTING_ASSIGNMENT',
  'INACTIVE',
  'MISSING_REQUIRED_RESPONSIBILITY',
]);
const WARNING_CODES = new Set<RecommendationWarningCode>([
  'HAS_WEEKLY_ASSIGNMENT',
  'NO_COMPLETED_ASSIGNMENT_HISTORY',
]);

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid recommendation response');
  return value as Readonly<Record<string, unknown>>;
}
function nonEmptyString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid recommendation response');
  return value;
}
function nonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error('Invalid recommendation response');
  return value;
}
function positiveInteger(value: unknown): number {
  const parsed = nonNegativeInteger(value);
  if (parsed < 1) throw new Error('Invalid recommendation response');
  return parsed;
}
function reason(value: unknown): Readonly<{ code: RecommendationReasonCode }> {
  const item = record(value);
  if (typeof item.code !== 'string' || !REASON_CODES.has(item.code as RecommendationReasonCode)) throw new Error('Invalid recommendation response');
  return Object.freeze({ code: item.code as RecommendationReasonCode });
}
function warning(value: unknown): Readonly<{ code: RecommendationWarningCode }> {
  const item = record(value);
  if (typeof item.code !== 'string' || !WARNING_CODES.has(item.code as RecommendationWarningCode)) throw new Error('Invalid recommendation response');
  return Object.freeze({ code: item.code as RecommendationWarningCode });
}
function history(value: unknown): RecommendationHistoryDto {
  const item = record(value);
  if (item.kind === 'no-completed-history') {
    if (item.lastCompletedMeetingDate !== undefined || item.daysSinceLastCompletedAssignment !== undefined) throw new Error('Invalid recommendation response');
    return Object.freeze({ kind: 'no-completed-history' });
  }
  if (item.kind !== 'completed-history') throw new Error('Invalid recommendation response');
  if (typeof item.lastCompletedMeetingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.lastCompletedMeetingDate)) throw new Error('Invalid recommendation response');
  return Object.freeze({
    kind: 'completed-history',
    lastCompletedMeetingDate: item.lastCompletedMeetingDate,
    daysSinceLastCompletedAssignment: nonNegativeInteger(item.daysSinceLastCompletedAssignment),
  });
}
function person(value: unknown, expectedStatus: 'candidate' | 'excluded'): RecommendationPersonDto {
  const item = record(value);
  if (item.status !== expectedStatus || !Array.isArray(item.reasons) || !Array.isArray(item.warnings)) throw new Error('Invalid recommendation response');
  const rank = expectedStatus === 'candidate' ? positiveInteger(item.rank) : undefined;
  if (expectedStatus === 'excluded' && item.rank !== undefined) throw new Error('Invalid recommendation response');
  return Object.freeze({
    personId: nonEmptyString(item.personId),
    displayName: nonEmptyString(item.displayName),
    status: expectedStatus,
    ...(rank !== undefined ? { rank } : {}),
    reasons: Object.freeze(item.reasons.map(reason)),
    warnings: Object.freeze(item.warnings.map(warning)),
    history: history(item.history),
    sameWeekAssignmentCount: nonNegativeInteger(item.sameWeekAssignmentCount),
  });
}

export function parsePeopleRecommendationResponse(value: unknown): PeopleRecommendationDto {
  const root = record(value);
  if (root.contractVersion !== 'people-recommendation-v1' || root.evidenceContractVersion !== 'px7-evidence-v1' || root.inputContractVersion !== 'px7-recommendation-input-v1') throw new Error('Invalid recommendation response');
  if (!Array.isArray(root.candidates) || !Array.isArray(root.excluded)) throw new Error('Invalid recommendation response');
  const target = record(root.target);
  return Object.freeze({
    contractVersion: 'people-recommendation-v1',
    evidenceContractVersion: 'px7-evidence-v1',
    inputContractVersion: 'px7-recommendation-input-v1',
    target: Object.freeze({
      meetingId: nonEmptyString(target.meetingId),
      slotId: nonEmptyString(target.slotId),
      assignmentTypeId: nonEmptyString(target.assignmentTypeId),
      meetingDate: nonEmptyString(target.meetingDate),
      startsAt: nonEmptyString(target.startsAt),
      endsAt: nonEmptyString(target.endsAt),
    }),
    candidates: Object.freeze(root.candidates.map(item => person(item, 'candidate'))),
    excluded: Object.freeze(root.excluded.map(item => person(item, 'excluded'))),
  });
}

export class PeopleRecommendationApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`People recommendation request failed (${status})`);
    this.name = 'PeopleRecommendationApiError';
    this.status = status;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid recommendation response'); }
}

export function createPeopleRecommendationApi(fetcher: typeof fetch = fetch) {
  return Object.freeze({
    async get(meetingId: string, slotId: string, signal?: AbortSignal): Promise<PeopleRecommendationDto> {
      const params = new URLSearchParams({ meetingId, slotId });
      const response = await fetcher(`/api/people/recommendations?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw new PeopleRecommendationApiError(response.status);
      const parsed = parsePeopleRecommendationResponse(body);
      if (parsed.target.meetingId !== meetingId || parsed.target.slotId !== slotId) throw new Error('Recommendation target mismatch');
      return parsed;
    },
  });
}

export const peopleRecommendationApi = createPeopleRecommendationApi();

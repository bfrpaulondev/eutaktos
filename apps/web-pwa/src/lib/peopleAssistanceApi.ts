export type AssistanceUnavailable = Readonly<{ status: 'unavailable' }>;

export type AssistanceCandidate = Readonly<{
  rank: number;
  displayName: string;
}>;

export type AffectedAssignmentAssistanceItem = Readonly<{
  meetingId: string;
  slotId: string;
  meetingDate: string;
  affectedDisplayName: string;
  suggestionStatus: 'ready' | 'unavailable';
  topCandidates: readonly AssistanceCandidate[];
}>;

export type AffectedAssignmentAssistance = Readonly<{
  status: 'ready';
  totalCount: number;
  truncated: boolean;
  items: readonly AffectedAssignmentAssistanceItem[];
}>;

export type IncompleteMeetingAssistanceItem = Readonly<{
  meetingId: string;
  meetingDate: string;
  openPartCount: number;
  partsWithCandidates: number;
}>;

export type IncompleteMeetingAssistance = Readonly<{
  status: 'ready';
  meetingCount: number;
  openPartCount: number;
  truncated: boolean;
  items: readonly IncompleteMeetingAssistanceItem[];
}>;

export type WorkloadImbalanceAssistanceItem = Readonly<{
  meetingId: string;
  slotId: string;
  meetingDate: string;
  displayName: string;
  sameWeekAssignmentCount: number;
  lowerWorkloadAlternativeCount: number;
}>;

export type WorkloadImbalanceAssistance = Readonly<{
  status: 'ready';
  itemCount: number;
  truncated: boolean;
  items: readonly WorkloadImbalanceAssistanceItem[];
}>;

export type LongIntervalAssistanceItem = Readonly<{
  meetingId: string;
  slotId: string;
  meetingDate: string;
  displayName: string;
  daysSinceLastCompletedAssignment: number;
}>;

export type LongIntervalAssistance = Readonly<{
  status: 'ready';
  itemCount: number;
  truncated: boolean;
  items: readonly LongIntervalAssistanceItem[];
}>;

export interface PeopleAssistanceDto {
  readonly contractVersion: 'people-assistance-v1';
  readonly affectedAssignments: AffectedAssignmentAssistance | AssistanceUnavailable;
  readonly incompleteMeetings: IncompleteMeetingAssistance | AssistanceUnavailable;
  readonly workloadImbalance: WorkloadImbalanceAssistance | AssistanceUnavailable;
  readonly longInterval: LongIntervalAssistance | AssistanceUnavailable;
}

export interface PeopleAssistanceApi {
  get(signal?: AbortSignal): Promise<PeopleAssistanceDto>;
}

const INVALID = 'Invalid People assistance response';

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID);
  return value as Readonly<Record<string, unknown>>;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(INVALID);
  return value;
}

function booleanValue(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error(INVALID);
  return value;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 300) throw new Error(INVALID);
  return value;
}

function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(INVALID);
  return result;
}

function opaqueId(value: unknown): string {
  const result = text(value);
  if (/[\s/?#&=\u0000-\u001f\u007f]/.test(result) || result.length > 200) throw new Error(INVALID);
  return result;
}

function parseCandidate(value: unknown): AssistanceCandidate {
  const candidate = record(value);
  const rank = nonNegativeInteger(candidate.rank);
  if (rank < 1) throw new Error(INVALID);
  return Object.freeze({ rank, displayName: text(candidate.displayName) });
}

function unavailableOrReady(value: unknown): Readonly<Record<string, unknown>> | AssistanceUnavailable {
  const candidate = record(value);
  if (candidate.status === 'unavailable') return Object.freeze({ status: 'unavailable' });
  if (candidate.status !== 'ready') throw new Error(INVALID);
  return candidate;
}

function parseAffected(value: unknown): AffectedAssignmentAssistance | AssistanceUnavailable {
  const candidate = unavailableOrReady(value);
  if (candidate.status === 'unavailable') return candidate;
  if (!Array.isArray(candidate.items)) throw new Error(INVALID);
  const items = candidate.items.map(itemValue => {
    const item = record(itemValue);
    if (item.suggestionStatus !== 'ready' && item.suggestionStatus !== 'unavailable') throw new Error(INVALID);
    if (!Array.isArray(item.topCandidates)) throw new Error(INVALID);
    const topCandidates = item.topCandidates.map(parseCandidate);
    if (topCandidates.length > 3 || topCandidates.some((entry, index) => entry.rank !== index + 1)) throw new Error(INVALID);
    return Object.freeze({
      meetingId: opaqueId(item.meetingId),
      slotId: opaqueId(item.slotId),
      meetingDate: date(item.meetingDate),
      affectedDisplayName: text(item.affectedDisplayName),
      suggestionStatus: item.suggestionStatus,
      topCandidates: Object.freeze(topCandidates),
    });
  });
  const totalCount = nonNegativeInteger(candidate.totalCount);
  if (items.length > totalCount || items.length > 20) throw new Error(INVALID);
  return Object.freeze({ status: 'ready', totalCount, truncated: booleanValue(candidate.truncated), items: Object.freeze(items) });
}

function parseIncomplete(value: unknown): IncompleteMeetingAssistance | AssistanceUnavailable {
  const candidate = unavailableOrReady(value);
  if (candidate.status === 'unavailable') return candidate;
  if (!Array.isArray(candidate.items)) throw new Error(INVALID);
  const items = candidate.items.map(itemValue => {
    const item = record(itemValue);
    const openPartCount = nonNegativeInteger(item.openPartCount);
    const partsWithCandidates = nonNegativeInteger(item.partsWithCandidates);
    if (partsWithCandidates > openPartCount) throw new Error(INVALID);
    return Object.freeze({
      meetingId: opaqueId(item.meetingId),
      meetingDate: date(item.meetingDate),
      openPartCount,
      partsWithCandidates,
    });
  });
  const meetingCount = nonNegativeInteger(candidate.meetingCount);
  if (items.length > meetingCount || items.length > 20) throw new Error(INVALID);
  return Object.freeze({
    status: 'ready',
    meetingCount,
    openPartCount: nonNegativeInteger(candidate.openPartCount),
    truncated: booleanValue(candidate.truncated),
    items: Object.freeze(items),
  });
}

function parseWorkload(value: unknown): WorkloadImbalanceAssistance | AssistanceUnavailable {
  const candidate = unavailableOrReady(value);
  if (candidate.status === 'unavailable') return candidate;
  if (!Array.isArray(candidate.items)) throw new Error(INVALID);
  const items = candidate.items.map(itemValue => {
    const item = record(itemValue);
    const sameWeekAssignmentCount = nonNegativeInteger(item.sameWeekAssignmentCount);
    const lowerWorkloadAlternativeCount = nonNegativeInteger(item.lowerWorkloadAlternativeCount);
    if (sameWeekAssignmentCount < 1 || lowerWorkloadAlternativeCount < 1) throw new Error(INVALID);
    return Object.freeze({
      meetingId: opaqueId(item.meetingId),
      slotId: opaqueId(item.slotId),
      meetingDate: date(item.meetingDate),
      displayName: text(item.displayName),
      sameWeekAssignmentCount,
      lowerWorkloadAlternativeCount,
    });
  });
  const itemCount = nonNegativeInteger(candidate.itemCount);
  if (items.length > itemCount || items.length > 20) throw new Error(INVALID);
  return Object.freeze({ status: 'ready', itemCount, truncated: booleanValue(candidate.truncated), items: Object.freeze(items) });
}

function parseLongInterval(value: unknown): LongIntervalAssistance | AssistanceUnavailable {
  const candidate = unavailableOrReady(value);
  if (candidate.status === 'unavailable') return candidate;
  if (!Array.isArray(candidate.items)) throw new Error(INVALID);
  const items = candidate.items.map(itemValue => {
    const item = record(itemValue);
    return Object.freeze({
      meetingId: opaqueId(item.meetingId),
      slotId: opaqueId(item.slotId),
      meetingDate: date(item.meetingDate),
      displayName: text(item.displayName),
      daysSinceLastCompletedAssignment: nonNegativeInteger(item.daysSinceLastCompletedAssignment),
    });
  });
  const itemCount = nonNegativeInteger(candidate.itemCount);
  if (items.length > itemCount || items.length > 20) throw new Error(INVALID);
  return Object.freeze({ status: 'ready', itemCount, truncated: booleanValue(candidate.truncated), items: Object.freeze(items) });
}

export function parsePeopleAssistance(value: unknown): PeopleAssistanceDto {
  const candidate = record(value);
  if (candidate.contractVersion !== 'people-assistance-v1') throw new Error(INVALID);
  return Object.freeze({
    contractVersion: 'people-assistance-v1',
    affectedAssignments: parseAffected(candidate.affectedAssignments),
    incompleteMeetings: parseIncomplete(candidate.incompleteMeetings),
    workloadImbalance: parseWorkload(candidate.workloadImbalance),
    longInterval: parseLongInterval(candidate.longInterval),
  });
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

export function createPeopleAssistanceApi(fetcher: typeof fetch = fetch): PeopleAssistanceApi {
  return {
    async get(signal) {
      const response = await fetcher('/api/people/assistance', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) {
        const message = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
        throw new Error(`${typeof message === 'string' ? message : 'People assistance request failed'} (${response.status})`);
      }
      return parsePeopleAssistance(body);
    },
  };
}

export const peopleAssistanceApi = createPeopleAssistanceApi();

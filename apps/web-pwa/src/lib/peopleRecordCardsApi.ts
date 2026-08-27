export interface RecordCardsPeriodDto { readonly from: string; readonly to: string }
export interface RecordCardRecordDto { readonly meetingDate: string; readonly partType: string }
export interface RecordCardDto { readonly personId: string; readonly displayName: string; readonly records: readonly RecordCardRecordDto[] }
export interface PeopleRecordCardsDto {
  readonly contractVersion: 'people-record-cards-v1';
  readonly generatedAt: string;
  readonly period: RecordCardsPeriodDto;
  readonly cards: readonly RecordCardDto[];
}
export type RecordCardsRequest = Readonly<{ year: string } | { from: string; to: string }>;

export class PeopleRecordCardsApiError extends Error {
  readonly status: number;
  constructor(status: number) { super(`Record cards request failed (${status})`); this.name = 'PeopleRecordCardsApiError'; this.status = status; }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Record Cards API response');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid Record Cards API response');
  return value;
}
function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error('Invalid Record Cards API response');
  return result;
}
function parseRecord(value: unknown): RecordCardRecordDto {
  const item = record(value);
  if (Object.keys(item).some(key => !['meetingDate', 'partType'].includes(key))) throw new Error('Invalid Record Cards API response');
  return Object.freeze({ meetingDate: date(item.meetingDate), partType: text(item.partType) });
}
function parseCard(value: unknown): RecordCardDto {
  const item = record(value);
  if (Object.keys(item).some(key => !['personId', 'displayName', 'records'].includes(key)) || !Array.isArray(item.records)) throw new Error('Invalid Record Cards API response');
  return Object.freeze({ personId: text(item.personId), displayName: text(item.displayName), records: Object.freeze(item.records.map(parseRecord)) });
}

export function parsePeopleRecordCards(value: unknown): PeopleRecordCardsDto {
  const root = record(value);
  if (Object.keys(root).some(key => !['contractVersion', 'generatedAt', 'period', 'cards'].includes(key))) throw new Error('Invalid Record Cards API response');
  if (root.contractVersion !== 'people-record-cards-v1' || typeof root.generatedAt !== 'string' || !Number.isFinite(Date.parse(root.generatedAt)) || !Array.isArray(root.cards)) throw new Error('Invalid Record Cards API response');
  const period = record(root.period);
  if (Object.keys(period).some(key => !['from', 'to'].includes(key))) throw new Error('Invalid Record Cards API response');
  return Object.freeze({
    contractVersion: 'people-record-cards-v1',
    generatedAt: root.generatedAt,
    period: Object.freeze({ from: date(period.from), to: date(period.to) }),
    cards: Object.freeze(root.cards.map(parseCard)),
  });
}

function query(input: RecordCardsRequest): string {
  const params = new URLSearchParams();
  if ('year' in input) params.set('year', input.year);
  else { params.set('from', input.from); params.set('to', input.to); }
  return params.toString();
}

export function createPeopleRecordCardsApi(fetcher: typeof fetch = fetch) {
  return Object.freeze({
    async get(input: RecordCardsRequest, signal?: AbortSignal): Promise<PeopleRecordCardsDto> {
      const response = await fetcher(`/api/people/record-cards?${query(input)}`, { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
      let body: unknown;
      try { body = await response.json(); } catch { throw new Error('Invalid API response'); }
      if (!response.ok) throw new PeopleRecordCardsApiError(response.status);
      return parsePeopleRecordCards(body);
    },
  });
}

export const peopleRecordCardsApi = createPeopleRecordCardsApi();
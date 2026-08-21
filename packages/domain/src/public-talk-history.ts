import type { TenantId } from './people';

export type PublicTalkHistoryId = string;
export type PublicTalkHistoryType = 'local' | 'away';
export type PublicTalkHistoryState = 'completed' | 'cancelled';

export const PUBLIC_TALK_HISTORY_TYPES: readonly PublicTalkHistoryType[] = Object.freeze(['local', 'away'] as const);
export const PUBLIC_TALK_HISTORY_STATES: readonly PublicTalkHistoryState[] = Object.freeze(['completed', 'cancelled'] as const);

export interface PublicTalkHistoryRecord {
  readonly id: PublicTalkHistoryId;
  readonly tenantId: TenantId;
  readonly speakerId: string;
  readonly talkOutlineId: string;
  readonly congregationId: string;
  readonly date: string;
  readonly type: PublicTalkHistoryType;
  readonly state: PublicTalkHistoryState;
  readonly recordedAt: string;
  readonly weekendMeetingId: string;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function instant(value: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('recordedAt must be an ISO instant');
  return value;
}

function dateOnly(value: string, field = 'date'): string {
  const normalized = required(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${field} must use YYYY-MM-DD format`);
  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error(`${field} is not a valid calendar date`);
  return normalized;
}

function typeOf(value: unknown): PublicTalkHistoryType {
  if (value !== 'local' && value !== 'away') throw new Error('type must be local or away');
  return value;
}

function stateOf(value: unknown): PublicTalkHistoryState {
  if (value !== 'completed' && value !== 'cancelled') throw new Error('state must be completed or cancelled');
  return value;
}

function tenantRecords(
  records: readonly Readonly<PublicTalkHistoryRecord>[],
  tenantIdInput: TenantId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  if (!Array.isArray(records)) throw new Error('records must be an array');
  const tenantId = required(tenantIdInput, 'tenantId');
  return records.filter(record => record.tenantId === tenantId);
}

function frozenList(records: readonly Readonly<PublicTalkHistoryRecord>[]): readonly Readonly<PublicTalkHistoryRecord>[] {
  return Object.freeze([...records]);
}

export function recordPublicTalkHistory(input: {
  id: PublicTalkHistoryId;
  tenantId: TenantId;
  speakerId: string;
  talkOutlineId: string;
  congregationId: string;
  date: string;
  type: PublicTalkHistoryType;
  state: PublicTalkHistoryState;
  recordedAt: string;
  weekendMeetingId: string;
}): Readonly<PublicTalkHistoryRecord> {
  return Object.freeze({
    id: required(input.id, 'id'),
    tenantId: required(input.tenantId, 'tenantId'),
    speakerId: required(input.speakerId, 'speakerId'),
    talkOutlineId: required(input.talkOutlineId, 'talkOutlineId'),
    congregationId: required(input.congregationId, 'congregationId'),
    date: dateOnly(input.date),
    type: typeOf(input.type),
    state: stateOf(input.state),
    recordedAt: instant(input.recordedAt),
    weekendMeetingId: required(input.weekendMeetingId, 'weekendMeetingId'),
  });
}

export function normalizePublicTalkHistoryRecord(input: PublicTalkHistoryRecord): Readonly<PublicTalkHistoryRecord> {
  return recordPublicTalkHistory(input);
}

export function assertPublicTalkHistoryTenant(record: Readonly<PublicTalkHistoryRecord>, tenantId: TenantId): void {
  if (record.tenantId !== tenantId) throw new Error('Cross-tenant public talk history access denied');
}

export function filterPublicTalkHistoryByTenant(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return frozenList(tenantRecords(records, tenantId));
}

export function publicTalkHistoryBySpeaker(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId, speakerIdInput: string,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  const speakerId = required(speakerIdInput, 'speakerId');
  return frozenList(tenantRecords(records, tenantId).filter(record => record.speakerId === speakerId));
}

export function publicTalkHistoryByOutline(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId, outlineIdInput: string,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  const outlineId = required(outlineIdInput, 'talkOutlineId');
  return frozenList(tenantRecords(records, tenantId).filter(record => record.talkOutlineId === outlineId));
}

export function publicTalkHistoryByCongregation(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId, congregationIdInput: string,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  const congregationId = required(congregationIdInput, 'congregationId');
  return frozenList(tenantRecords(records, tenantId).filter(record => record.congregationId === congregationId));
}

export function publicTalkHistoryInDateRange(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId, fromInput: string, toInput: string,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  const from = dateOnly(fromInput, 'from'); const to = dateOnly(toInput, 'to');
  if (to < from) throw new Error('Date range must end on or after it starts');
  return frozenList(tenantRecords(records, tenantId).filter(record => record.date >= from && record.date <= to));
}

export function lastPublicTalkUseOfOutline(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId, outlineId: string,
): string | null {
  const values = publicTalkHistoryByOutline(records, tenantId, outlineId);
  return values.reduce<string | null>((latest, record) => latest === null || record.date > latest ? record.date : latest, null);
}

export function lastPublicTalkUseOfSpeaker(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId, speakerId: string,
): string | null {
  const values = publicTalkHistoryBySpeaker(records, tenantId, speakerId);
  return values.reduce<string | null>((latest, record) => latest === null || record.date > latest ? record.date : latest, null);
}

export function previousPublicTalkCombinations(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId, speakerIdInput: string, outlineIdInput: string,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  const speakerId = required(speakerIdInput, 'speakerId'); const outlineId = required(outlineIdInput, 'talkOutlineId');
  return frozenList(tenantRecords(records, tenantId).filter(record => record.speakerId === speakerId && record.talkOutlineId === outlineId));
}

export function orderPublicTalkHistoryByDate(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId,
): readonly Readonly<PublicTalkHistoryRecord>[] {
  return frozenList([...tenantRecords(records, tenantId)].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)));
}

export function countPublicTalksByOutline(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId, outlineId: string, from?: string, to?: string,
): number {
  const values = publicTalkHistoryByOutline(records, tenantId, outlineId);
  const start = from === undefined ? undefined : dateOnly(from, 'from');
  const end = to === undefined ? undefined : dateOnly(to, 'to');
  if (start !== undefined && end !== undefined && end < start) throw new Error('Date range must end on or after it starts');
  return values.filter(record => (start === undefined || record.date >= start) && (end === undefined || record.date <= end)).length;
}

export function countPublicTalksBySpeaker(
  records: readonly Readonly<PublicTalkHistoryRecord>[], tenantId: TenantId, speakerId: string, from?: string, to?: string,
): number {
  const values = publicTalkHistoryBySpeaker(records, tenantId, speakerId);
  const start = from === undefined ? undefined : dateOnly(from, 'from');
  const end = to === undefined ? undefined : dateOnly(to, 'to');
  if (start !== undefined && end !== undefined && end < start) throw new Error('Date range must end on or after it starts');
  return values.filter(record => (start === undefined || record.date >= start) && (end === undefined || record.date <= end)).length;
}

export type PeopleTransferStatus = 'pending' | 'claimed' | 'expired' | 'cancelled';

export interface TransferPersonNameDto { readonly displayName: string }
export interface PeopleTransferHistoryDto {
  readonly transferId: string;
  readonly status: PeopleTransferStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly claimedAt?: string;
  readonly cancelledAt?: string;
  readonly people: readonly TransferPersonNameDto[];
}
export interface PeopleTransfersDto { readonly contractVersion: 'people-transfers-v1'; readonly transfers: readonly PeopleTransferHistoryDto[] }
export interface PeopleTransferSendDto { readonly contractVersion: 'people-transfer-send-v1'; readonly transferId: string; readonly code: string; readonly expiresAt: string; readonly people: readonly Readonly<{ personId: string; displayName: string }>[] }
export interface PeopleTransferPreviewDto { readonly contractVersion: 'people-transfer-preview-v1'; readonly transferId: string; readonly expiresAt: string; readonly people: readonly TransferPersonNameDto[] }
export interface PeopleTransferClaimDto { readonly contractVersion: 'people-transfer-claim-v1'; readonly transferId: string; readonly outcome: 'claimed' | 'already-claimed'; readonly people: readonly Readonly<{ personId: string; displayName: string }>[] }
export interface PeopleTransferCancelDto { readonly contractVersion: 'people-transfer-cancel-v1'; readonly transferId: string; readonly cancelled: true; readonly changed: boolean }

export class PeopleTransfersApiError extends Error {
  readonly status: number;
  constructor(status: number) { super(`People transfer request failed (${status})`); this.name = 'PeopleTransfersApiError'; this.status = status; }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid People Transfers API response');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid People Transfers API response');
  return value;
}
function instant(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid People Transfers API response');
  return result;
}
function exact(item: Readonly<Record<string, unknown>>, keys: readonly string[]): void {
  const allowed = new Set(keys);
  if (Object.keys(item).some(key => !allowed.has(key))) throw new Error('Invalid People Transfers API response');
}
function personName(value: unknown): TransferPersonNameDto {
  const item = record(value); exact(item, ['displayName']);
  return Object.freeze({ displayName: text(item.displayName) });
}
function createdPerson(value: unknown): Readonly<{ personId: string; displayName: string }> {
  const item = record(value); exact(item, ['personId', 'displayName']);
  return Object.freeze({ personId: text(item.personId), displayName: text(item.displayName) });
}
function array<T>(value: unknown, parser: (item: unknown) => T): readonly T[] {
  if (!Array.isArray(value)) throw new Error('Invalid People Transfers API response');
  return Object.freeze(value.map(parser));
}

export function parsePeopleTransfers(value: unknown): PeopleTransfersDto {
  const root = record(value); exact(root, ['contractVersion', 'transfers']);
  if (root.contractVersion !== 'people-transfers-v1' || !Array.isArray(root.transfers)) throw new Error('Invalid People Transfers API response');
  const transfers = root.transfers.map(value => {
    const item = record(value); exact(item, ['transferId', 'status', 'createdAt', 'expiresAt', 'claimedAt', 'cancelledAt', 'people']);
    if (!['pending', 'claimed', 'expired', 'cancelled'].includes(String(item.status)) || !Array.isArray(item.people)) throw new Error('Invalid People Transfers API response');
    return Object.freeze({
      transferId: text(item.transferId), status: item.status as PeopleTransferStatus, createdAt: instant(item.createdAt), expiresAt: instant(item.expiresAt),
      ...(typeof item.claimedAt === 'string' ? { claimedAt: instant(item.claimedAt) } : {}),
      ...(typeof item.cancelledAt === 'string' ? { cancelledAt: instant(item.cancelledAt) } : {}),
      people: Object.freeze(item.people.map(personName)),
    });
  });
  return Object.freeze({ contractVersion: 'people-transfers-v1', transfers: Object.freeze(transfers) });
}

export function parsePeopleTransferSend(value: unknown): PeopleTransferSendDto {
  const root = record(value); exact(root, ['contractVersion', 'transferId', 'code', 'expiresAt', 'people']);
  if (root.contractVersion !== 'people-transfer-send-v1' || !/^[A-Za-z0-9_-]{43}$/.test(String(root.code ?? ''))) throw new Error('Invalid People Transfers API response');
  return Object.freeze({ contractVersion: 'people-transfer-send-v1', transferId: text(root.transferId), code: text(root.code), expiresAt: instant(root.expiresAt), people: array(root.people, createdPerson) });
}

export function parsePeopleTransferPreview(value: unknown): PeopleTransferPreviewDto {
  const root = record(value); exact(root, ['contractVersion', 'transferId', 'expiresAt', 'people']);
  if (root.contractVersion !== 'people-transfer-preview-v1') throw new Error('Invalid People Transfers API response');
  return Object.freeze({ contractVersion: 'people-transfer-preview-v1', transferId: text(root.transferId), expiresAt: instant(root.expiresAt), people: array(root.people, personName) });
}

export function parsePeopleTransferClaim(value: unknown): PeopleTransferClaimDto {
  const root = record(value); exact(root, ['contractVersion', 'transferId', 'outcome', 'people']);
  if (root.contractVersion !== 'people-transfer-claim-v1' || (root.outcome !== 'claimed' && root.outcome !== 'already-claimed')) throw new Error('Invalid People Transfers API response');
  return Object.freeze({ contractVersion: 'people-transfer-claim-v1', transferId: text(root.transferId), outcome: root.outcome, people: array(root.people, createdPerson) });
}

export function parsePeopleTransferCancel(value: unknown): PeopleTransferCancelDto {
  const root = record(value); exact(root, ['contractVersion', 'transferId', 'cancelled', 'changed']);
  if (root.contractVersion !== 'people-transfer-cancel-v1' || root.cancelled !== true || typeof root.changed !== 'boolean') throw new Error('Invalid People Transfers API response');
  return Object.freeze({ contractVersion: 'people-transfer-cancel-v1', transferId: text(root.transferId), cancelled: true, changed: root.changed });
}

async function responseJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new Error('Invalid API response'); }
}
async function request<T>(fetcher: typeof fetch, url: string, init: RequestInit, parser: (value: unknown) => T): Promise<T> {
  const response = await fetcher(url, { credentials: 'same-origin', ...init });
  const body = await responseJson(response);
  if (!response.ok) throw new PeopleTransfersApiError(response.status);
  return parser(body);
}

export function createPeopleTransfersApi(fetcher: typeof fetch = fetch) {
  return Object.freeze({
    list(signal?: AbortSignal): Promise<PeopleTransfersDto> {
      return request(fetcher, '/api/people/transfers', { method: 'GET', headers: { Accept: 'application/json' }, signal }, parsePeopleTransfers);
    },
    send(personIds: readonly string[], signal?: AbortSignal): Promise<PeopleTransferSendDto> {
      return request(fetcher, '/api/people/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ personIds }), signal }, parsePeopleTransferSend);
    },
    preview(code: string, signal?: AbortSignal): Promise<PeopleTransferPreviewDto> {
      return request(fetcher, '/api/people/transfers/preview', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ code }), signal }, parsePeopleTransferPreview);
    },
    claim(code: string, signal?: AbortSignal): Promise<PeopleTransferClaimDto> {
      return request(fetcher, '/api/people/transfers/claim', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ code }), signal }, parsePeopleTransferClaim);
    },
    cancel(transferId: string, signal?: AbortSignal): Promise<PeopleTransferCancelDto> {
      return request(fetcher, `/api/people/transfers/${encodeURIComponent(transferId)}/cancel`, { method: 'POST', headers: { Accept: 'application/json' }, signal }, parsePeopleTransferCancel);
    },
  });
}

export const peopleTransfersApi = createPeopleTransfersApi();
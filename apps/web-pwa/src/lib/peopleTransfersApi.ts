export type PeopleTransferStatus = 'pending' | 'received' | 'cancelled' | 'expired';
export type PeopleTransferHistoryAction = 'created' | 'token-rotated' | 'cancelled' | 'received';

export interface PeopleTransferSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly status: PeopleTransferStatus;
  readonly people: readonly Readonly<{ displayName: string }>[];
  readonly history: readonly Readonly<{ action: PeopleTransferHistoryAction; occurredAt: string }>[];
}

export interface PeopleTransferPreview {
  readonly contractVersion: 'people-transfer-preview-v1';
  readonly status: 'available' | 'already-received';
  readonly expiresAt: string;
  readonly people: readonly Readonly<{
    displayName: string;
    preferredLocale?: string;
    ordinaryContact?: Readonly<{ phone?: string; email?: string; address?: string }>;
  }>[];
}

export class PeopleTransfersApiError extends Error {
  readonly status: number;
  constructor(status: number, message = `People transfer request failed (${status})`) {
    super(message);
    this.name = 'PeopleTransfersApiError';
    this.status = status;
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid People transfer response');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid People transfer response');
  return value;
}
function instant(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid People transfer response');
  return result;
}
function personName(value: unknown): Readonly<{ displayName: string }> {
  const item = record(value);
  return Object.freeze({ displayName: text(item.displayName) });
}
function contact(value: unknown): Readonly<{ phone?: string; email?: string; address?: string }> | undefined {
  if (value === undefined) return undefined;
  const item = record(value);
  const allowed = new Set(['phone', 'email', 'address']);
  if (Object.keys(item).some(key => !allowed.has(key))) throw new Error('Invalid People transfer response');
  for (const key of allowed) if (item[key] !== undefined && typeof item[key] !== 'string') throw new Error('Invalid People transfer response');
  return Object.freeze({
    ...(typeof item.phone === 'string' && item.phone ? { phone: item.phone } : {}),
    ...(typeof item.email === 'string' && item.email ? { email: item.email } : {}),
    ...(typeof item.address === 'string' && item.address ? { address: item.address } : {}),
  });
}
function previewPerson(value: unknown): PeopleTransferPreview['people'][number] {
  const item = record(value);
  const resultContact = contact(item.ordinaryContact);
  if (item.preferredLocale !== undefined && typeof item.preferredLocale !== 'string') throw new Error('Invalid People transfer response');
  return Object.freeze({
    displayName: text(item.displayName),
    ...(typeof item.preferredLocale === 'string' && item.preferredLocale ? { preferredLocale: item.preferredLocale } : {}),
    ...(resultContact && Object.keys(resultContact).length ? { ordinaryContact: resultContact } : {}),
  });
}
function history(value: unknown): PeopleTransferSummary['history'][number] {
  const item = record(value);
  if (!['created', 'token-rotated', 'cancelled', 'received'].includes(String(item.action))) throw new Error('Invalid People transfer response');
  return Object.freeze({ action: item.action as PeopleTransferHistoryAction, occurredAt: instant(item.occurredAt) });
}
function summary(value: unknown): PeopleTransferSummary {
  const item = record(value);
  if (!['pending', 'received', 'cancelled', 'expired'].includes(String(item.status)) || !Array.isArray(item.people) || !Array.isArray(item.history)) throw new Error('Invalid People transfer response');
  return Object.freeze({
    id: text(item.id),
    createdAt: instant(item.createdAt),
    expiresAt: instant(item.expiresAt),
    status: item.status as PeopleTransferStatus,
    people: Object.freeze(item.people.map(personName)),
    history: Object.freeze(item.history.map(history)),
  });
}

export function parsePeopleTransfers(value: unknown): readonly PeopleTransferSummary[] {
  const root = record(value);
  if (root.contractVersion !== 'people-transfers-v1' || !Array.isArray(root.transfers)) throw new Error('Invalid People transfer response');
  return Object.freeze(root.transfers.map(summary));
}

function parseTokenResponse(value: unknown): Readonly<{ transfer: PeopleTransferSummary; receiveToken?: string; tokenState: 'available' | 'rotate-required' }> {
  const root = record(value);
  if (root.contractVersion !== 'people-transfer-created-v1') throw new Error('Invalid People transfer response');
  if (root.tokenState !== 'available' && root.tokenState !== 'rotate-required') throw new Error('Invalid People transfer response');
  const receiveToken = root.receiveToken;
  if (root.tokenState === 'available') {
    if (typeof receiveToken !== 'string' || !/^etk_[0-9a-f]{64}$/.test(receiveToken)) throw new Error('Invalid People transfer response');
  } else if (receiveToken !== null && receiveToken !== undefined) throw new Error('Invalid People transfer response');
  return Object.freeze({ transfer: summary(root.transfer), ...(typeof receiveToken === 'string' ? { receiveToken } : {}), tokenState: root.tokenState });
}

export function parsePeopleTransferPreview(value: unknown): PeopleTransferPreview {
  const root = record(value);
  if (root.contractVersion !== 'people-transfer-preview-v1' || (root.status !== 'available' && root.status !== 'already-received') || !Array.isArray(root.people)) throw new Error('Invalid People transfer response');
  return Object.freeze({ contractVersion: 'people-transfer-preview-v1', status: root.status, expiresAt: instant(root.expiresAt), people: Object.freeze(root.people.map(previewPerson)) });
}

function parseReceived(value: unknown): Readonly<{ outcome: 'received' | 'already-received'; createdCount: number; people: readonly Readonly<{ displayName: string }>[] }> {
  const root = record(value);
  if (root.contractVersion !== 'people-transfer-received-v1' || (root.outcome !== 'received' && root.outcome !== 'already-received') || typeof root.createdCount !== 'number' || !Number.isSafeInteger(root.createdCount) || root.createdCount < 0 || !Array.isArray(root.people)) throw new Error('Invalid People transfer response');
  return Object.freeze({ outcome: root.outcome, createdCount: root.createdCount, people: Object.freeze(root.people.map(personName)) });
}

async function jsonBody(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new Error('Invalid People transfer response'); }
}
async function checked(response: Response): Promise<unknown> {
  const body = await jsonBody(response);
  if (!response.ok) {
    const item = body && typeof body === 'object' && !Array.isArray(body) ? body as Readonly<Record<string, unknown>> : undefined;
    const message = typeof item?.error === 'string' && response.status < 500 ? `${item.error} (${response.status})` : undefined;
    throw new PeopleTransfersApiError(response.status, message);
  }
  return body;
}

export function createPeopleTransfersApi(fetcher: typeof fetch = fetch) {
  const post = async (url: string, body: Readonly<Record<string, unknown>>, signal?: AbortSignal) => checked(await fetcher(url, {
    method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  }));
  return Object.freeze({
    async list(signal?: AbortSignal): Promise<readonly PeopleTransferSummary[]> {
      const response = await fetcher('/api/people/transfers', { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
      return parsePeopleTransfers(await checked(response));
    },
    async create(personIds: readonly string[], mutationId: string, signal?: AbortSignal) {
      return parseTokenResponse(await post('/api/people/transfers', { action: 'create', personIds, mutationId }, signal));
    },
    async rotateToken(transferId: string, signal?: AbortSignal) {
      return parseTokenResponse(await post('/api/people/transfers', { action: 'rotate-token', transferId }, signal));
    },
    async cancel(transferId: string, signal?: AbortSignal): Promise<PeopleTransferSummary> {
      const root = record(await post('/api/people/transfers', { action: 'cancel', transferId }, signal));
      if (root.contractVersion !== 'people-transfer-cancelled-v1') throw new Error('Invalid People transfer response');
      return summary(root.transfer);
    },
    async preview(token: string, signal?: AbortSignal): Promise<PeopleTransferPreview> {
      return parsePeopleTransferPreview(await post('/api/people/transfers/receive', { action: 'preview', token }, signal));
    },
    async receive(token: string, signal?: AbortSignal) {
      return parseReceived(await post('/api/people/transfers/receive', { action: 'receive', token }, signal));
    },
  });
}

export const peopleTransfersApi = createPeopleTransfersApi();

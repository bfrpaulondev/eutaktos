export type PeopleReminderItemDto = Readonly<{
  responseId: string;
  assignmentId: string;
  recipientId: string;
  displayName: string;
  reason: 'awaiting-response';
  pendingSince: string;
  lastReminderAt: string | null;
}>;

export interface PeopleRemindersDto {
  readonly contractVersion: 'people-reminders-v1';
  readonly items: readonly PeopleReminderItemDto[];
}

export type PeopleReminderSendInput = Readonly<{
  responseId: string;
  mutationId: string;
  locale: 'pt-PT' | 'en' | 'es';
}>;

export type PeopleReminderSendDto = Readonly<{
  contractVersion: 'people-reminder-send-v1';
  state: 'queued';
  deliveryId: string;
  channel: 'in-app' | 'push' | 'email' | 'whatsapp';
}>;

export interface PeopleRemindersApi {
  get(signal?: AbortSignal): Promise<PeopleRemindersDto>;
  send(input: PeopleReminderSendInput, signal?: AbortSignal): Promise<PeopleReminderSendDto>;
}

const INVALID = 'Invalid People reminders response';

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(INVALID);
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, maximum = 300): string {
  if (typeof value !== 'string') throw new Error(INVALID);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(INVALID);
  return normalized;
}

function opaqueId(value: unknown): string {
  const result = text(value, 200);
  if (/[\s/?#&=]/.test(result)) throw new Error(INVALID);
  return result;
}

function instant(value: unknown): string {
  const result = text(value, 100);
  if (!Number.isFinite(Date.parse(result))) throw new Error(INVALID);
  return result;
}

function parseItem(value: unknown): PeopleReminderItemDto {
  const item = record(value);
  if (item.reason !== 'awaiting-response') throw new Error(INVALID);
  const lastReminderAt = item.lastReminderAt === null ? null : instant(item.lastReminderAt);
  return Object.freeze({
    responseId: opaqueId(item.responseId),
    assignmentId: opaqueId(item.assignmentId),
    recipientId: opaqueId(item.recipientId),
    displayName: text(item.displayName),
    reason: 'awaiting-response',
    pendingSince: instant(item.pendingSince),
    lastReminderAt,
  });
}

export function parsePeopleReminders(value: unknown): PeopleRemindersDto {
  const candidate = record(value);
  if (candidate.contractVersion !== 'people-reminders-v1' || !Array.isArray(candidate.items)) throw new Error(INVALID);
  return Object.freeze({
    contractVersion: 'people-reminders-v1',
    items: Object.freeze(candidate.items.map(parseItem)),
  });
}

export function parsePeopleReminderSend(value: unknown): PeopleReminderSendDto {
  const candidate = record(value);
  if (candidate.contractVersion !== 'people-reminder-send-v1' || candidate.state !== 'queued') throw new Error(INVALID);
  const channel = candidate.channel;
  if (channel !== 'in-app' && channel !== 'push' && channel !== 'email' && channel !== 'whatsapp') throw new Error(INVALID);
  return Object.freeze({
    contractVersion: 'people-reminder-send-v1',
    state: 'queued',
    deliveryId: opaqueId(candidate.deliveryId),
    channel,
  });
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function failureMessage(body: unknown, fallback: string, status: number): Error {
  const message = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  return new Error(`${typeof message === 'string' ? message : fallback} (${status})`);
}

export function createPeopleRemindersApi(fetcher: typeof fetch = fetch): PeopleRemindersApi {
  return {
    async get(signal) {
      const response = await fetcher('/api/people/reminders', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw failureMessage(body, 'People reminders request failed', response.status);
      return parsePeopleReminders(body);
    },
    async send(input, signal) {
      const response = await fetcher('/api/people/reminders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(input),
        signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw failureMessage(body, 'People reminder send failed', response.status);
      return parsePeopleReminderSend(body);
    },
  };
}

export const peopleRemindersApi = createPeopleRemindersApi();

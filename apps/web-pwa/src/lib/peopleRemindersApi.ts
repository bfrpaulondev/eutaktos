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

export interface PeopleRemindersApi {
  get(signal?: AbortSignal): Promise<PeopleRemindersDto>;
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

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
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
      if (!response.ok) {
        const message = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
        throw new Error(`${typeof message === 'string' ? message : 'People reminders request failed'} (${response.status})`);
      }
      return parsePeopleReminders(body);
    },
  };
}

export const peopleRemindersApi = createPeopleRemindersApi();

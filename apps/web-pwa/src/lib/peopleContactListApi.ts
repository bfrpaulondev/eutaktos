export type ContactListField = 'phone' | 'email' | 'address' | 'preferredLocale' | 'groups' | 'state';
export type ContactListStatus = 'all' | 'active' | 'inactive';

export interface ContactListGroupDto {
  readonly id: string;
  readonly name: string;
}

export interface ContactListPersonDto {
  readonly personId: string;
  readonly displayName: string;
  readonly phone?: string;
  readonly email?: string;
  readonly address?: string;
  readonly preferredLocale?: string;
  readonly groups?: readonly ContactListGroupDto[];
  readonly active?: boolean;
}

export interface PeopleContactListDto {
  readonly contractVersion: 'people-contact-list-v1';
  readonly generatedAt: string;
  readonly fields: readonly ContactListField[];
  readonly groups: readonly ContactListGroupDto[];
  readonly people: readonly ContactListPersonDto[];
}

export interface ContactListRequest {
  readonly fields: readonly ContactListField[];
  readonly status?: ContactListStatus;
  readonly groupId?: string;
}

const FIELD_SET = new Set<ContactListField>(['phone', 'email', 'address', 'preferredLocale', 'groups', 'state']);

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Contact List API response');
  return value as Readonly<Record<string, unknown>>;
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid Contact List API response');
  return value;
}

function parseGroup(value: unknown): ContactListGroupDto {
  const item = record(value);
  return Object.freeze({ id: requiredText(item.id), name: requiredText(item.name) });
}

function parseFields(value: unknown): readonly ContactListField[] {
  if (!Array.isArray(value) || !value.every(field => typeof field === 'string' && FIELD_SET.has(field as ContactListField))) throw new Error('Invalid Contact List API response');
  if (new Set(value).size !== value.length) throw new Error('Invalid Contact List API response');
  return Object.freeze([...value] as ContactListField[]);
}

function parsePerson(value: unknown, fields: readonly ContactListField[]): ContactListPersonDto {
  const item = record(value);
  const allowed = new Set(['personId', 'displayName', ...fields]);
  if (Object.keys(item).some(key => !allowed.has(key))) throw new Error('Invalid Contact List API response');
  const result: Record<string, unknown> = { personId: requiredText(item.personId), displayName: requiredText(item.displayName) };
  for (const field of fields) {
    const raw = item[field];
    if (field === 'groups') {
      if (!Array.isArray(raw)) throw new Error('Invalid Contact List API response');
      result.groups = Object.freeze(raw.map(parseGroup));
      continue;
    }
    if (field === 'state') {
      if (typeof raw !== 'boolean') throw new Error('Invalid Contact List API response');
      result.active = raw;
      continue;
    }
    if (raw !== undefined && typeof raw !== 'string') throw new Error('Invalid Contact List API response');
    if (typeof raw === 'string') result[field] = raw;
  }
  return Object.freeze(result) as unknown as ContactListPersonDto;
}

export function parsePeopleContactList(value: unknown): PeopleContactListDto {
  const root = record(value);
  if (root.contractVersion !== 'people-contact-list-v1' || typeof root.generatedAt !== 'string' || !Number.isFinite(Date.parse(root.generatedAt))) throw new Error('Invalid Contact List API response');
  const fields = parseFields(root.fields);
  if (!Array.isArray(root.groups) || !Array.isArray(root.people)) throw new Error('Invalid Contact List API response');
  return Object.freeze({
    contractVersion: 'people-contact-list-v1',
    generatedAt: root.generatedAt,
    fields,
    groups: Object.freeze(root.groups.map(parseGroup)),
    people: Object.freeze(root.people.map(person => parsePerson(person, fields))),
  });
}

function query(input: ContactListRequest): string {
  const params = new URLSearchParams();
  if (input.fields.length) params.set('fields', input.fields.join(','));
  if (input.status && input.status !== 'all') params.set('status', input.status);
  if (input.groupId) params.set('groupId', input.groupId);
  const value = params.toString();
  return value ? `?${value}` : '';
}

async function json(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new Error('Invalid API response'); }
}

function apiError(response: Response, body: unknown): Error {
  const message = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
    ? String((body as { error: string }).error)
    : 'Contact List request failed';
  return new Error(`${message} (${response.status})`);
}

export function createPeopleContactListApi(fetcher: typeof fetch = fetch) {
  return Object.freeze({
    async get(input: ContactListRequest, signal?: AbortSignal): Promise<PeopleContactListDto> {
      const response = await fetcher(`/api/people/contact-list${query(input)}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      const body = await json(response);
      if (!response.ok) throw apiError(response, body);
      return parsePeopleContactList(body);
    },
  });
}

export const peopleContactListApi = createPeopleContactListApi();

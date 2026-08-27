import { createAccessContext, ordinaryContactOf, type CongregationPerson } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import { BadRequestError, runEndpoint } from '../_endpoint';
import { serviceGroupDto } from '../_entity-read';
import { PeopleSnapshotUnitOfWork } from '../_uow';
import { json, methodNotAllowed, type ApiHandler, type ApiRequest } from '../_types';

export const CONTACT_LIST_FIELDS = Object.freeze(['phone', 'email', 'address', 'preferredLocale', 'groups', 'state'] as const);
export type ContactListField = (typeof CONTACT_LIST_FIELDS)[number];
export type ContactListStatus = 'all' | 'active' | 'inactive';

export interface ContactListQuery {
  readonly fields: readonly ContactListField[];
  readonly status: ContactListStatus;
  readonly groupId?: string;
}

function singleQueryValue(request: ApiRequest, name: string): string | undefined {
  const raw = request.query[name];
  if (Array.isArray(raw)) throw new BadRequestError(`${name} must not be repeated`);
  return raw;
}

function opaqueId(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[\r\n]/.test(normalized)) throw new BadRequestError(`${field} is invalid`);
  return normalized;
}

export function parseContactListQuery(request: ApiRequest): ContactListQuery {
  const allowedQueryKeys = new Set(['fields', 'status', 'groupId']);
  if (Object.keys(request.query).some(key => !allowedQueryKeys.has(key))) throw new BadRequestError('Unknown query parameter');

  const fieldsValue = singleQueryValue(request, 'fields');
  const rawFields = fieldsValue === undefined || !fieldsValue.trim() ? ['phone', 'email'] : fieldsValue.split(',').map(value => value.trim());
  if (!rawFields.length || rawFields.some(value => !value)) throw new BadRequestError('fields is invalid');
  const allowedFields = new Set<string>(CONTACT_LIST_FIELDS);
  if (rawFields.some(value => !allowedFields.has(value))) throw new BadRequestError('Unknown contact list field');
  if (new Set(rawFields).size !== rawFields.length) throw new BadRequestError('fields contains duplicates');

  const statusValue = singleQueryValue(request, 'status')?.trim() || 'all';
  if (statusValue !== 'all' && statusValue !== 'active' && statusValue !== 'inactive') throw new BadRequestError('status is invalid');

  const groupValue = singleQueryValue(request, 'groupId');
  return Object.freeze({
    fields: Object.freeze(rawFields as ContactListField[]),
    status: statusValue,
    ...(groupValue !== undefined ? { groupId: opaqueId(groupValue, 'groupId') } : {}),
  });
}

type ContactListGroup = Readonly<{ id: string; name: string }>;

type ContactListPerson = Readonly<{
  personId: string;
  displayName: string;
  phone?: string;
  email?: string;
  address?: string;
  preferredLocale?: string;
  groups?: readonly ContactListGroup[];
  active?: boolean;
}>;

export function projectContactListPerson(
  person: Readonly<CongregationPerson>,
  fields: readonly ContactListField[],
  groups: readonly Readonly<{ id: string; name: string; memberIds: readonly string[] }>[],
): ContactListPerson {
  const selected = new Set(fields);
  const contact = ordinaryContactOf(person);
  const memberships = selected.has('groups')
    ? groups
      .filter(group => group.memberIds.includes(person.id))
      .map(group => Object.freeze({ id: group.id, name: group.name }))
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
    : undefined;
  return Object.freeze({
    personId: person.id,
    displayName: person.displayName,
    ...(selected.has('phone') && contact.phone ? { phone: contact.phone } : {}),
    ...(selected.has('email') && contact.email ? { email: contact.email } : {}),
    ...(selected.has('address') && contact.address ? { address: contact.address } : {}),
    ...(selected.has('preferredLocale') && person.preferredLocale ? { preferredLocale: person.preferredLocale } : {}),
    ...(selected.has('groups') ? { groups: Object.freeze(memberships ?? []) } : {}),
    ...(selected.has('state') ? { active: person.active } : {}),
  });
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'reports.read');
    const query = parseContactListQuery(request);
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
    const [peopleRows, groupRows] = await Promise.all([
      database.entities(principal.tenantId, 'person'),
      database.entities(principal.tenantId, 'service-group'),
    ]);
    const people = new PeopleSnapshotUnitOfWork(principal.tenantId, peopleRows).list(context);
    const groups = groupRows.map(row => serviceGroupDto(row, principal.tenantId));
    if (query.groupId && !groups.some(group => group.id === query.groupId)) throw new BadRequestError('groupId is unknown');

    const filtered = people.filter(person => {
      if (query.status === 'active' && !person.active) return false;
      if (query.status === 'inactive' && person.active) return false;
      if (query.groupId && !groups.some(group => group.id === query.groupId && group.memberIds.includes(person.id))) return false;
      return true;
    });
    const projected = filtered
      .map(person => projectContactListPerson(person, query.fields, groups))
      .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.personId.localeCompare(right.personId));

    json(response, 200, Object.freeze({
      contractVersion: 'people-contact-list-v1',
      generatedAt: new Date().toISOString(),
      fields: query.fields,
      groups: Object.freeze(groups.map(group => Object.freeze({ id: group.id, name: group.name })).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))),
      people: Object.freeze(projected),
    }));
  });
};

export default handler;

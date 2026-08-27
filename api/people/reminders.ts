import { AssignmentReminderReviewService } from '@eutaktos/application';
import {
  createAccessContext,
  createAssignmentReminderRecord,
  normalizeAssignmentResponse,
  type AssignmentReminderRecord,
  type AssignmentResponse,
  type CongregationPerson,
} from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import type { EntityRow } from '../_db';
import { BadRequestError, runEndpoint } from '../_endpoint';
import { json, methodNotAllowed, type ApiHandler, type ApiRequest } from '../_types';

type TenantEntity = { readonly id: string; readonly tenantId: string };

function storedEntity<T extends TenantEntity>(row: EntityRow, tenantId: string, label: string): Readonly<T> {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error(`Invalid stored ${label} entity`);
  }
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) {
    throw new Error(`Invalid stored ${label} entity identity`);
  }
  return Object.freeze(structuredClone(data)) as Readonly<T>;
}

export function assertReminderListRequest(request: Pick<ApiRequest, 'query' | 'body'>): void {
  if (request.body !== undefined && request.body !== null) {
    throw new BadRequestError('Reminder GET does not accept a request body');
  }
  if (Object.keys(request.query).length > 0) {
    throw new BadRequestError('Reminder GET does not accept query fields');
  }
}

export function buildReminderListPayload(input: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly capabilities: readonly string[];
  readonly people: readonly Readonly<CongregationPerson>[];
  readonly responses: readonly Readonly<AssignmentResponse>[];
  readonly reminders: readonly Readonly<AssignmentReminderRecord>[];
}): Readonly<{
  contractVersion: 'people-reminders-v1';
  items: readonly Readonly<{
    responseId: string;
    assignmentId: string;
    recipientId: string;
    displayName: string;
    reason: 'awaiting-response';
    pendingSince: string;
    lastReminderAt: string | null;
  }>[];
}> {
  const context = createAccessContext({
    tenantId: input.tenantId,
    actorId: input.actorId,
    capabilities: input.capabilities,
  });
  const service = new AssignmentReminderReviewService({
    listAssignmentResponses: () => input.responses,
    listAssignmentReminderRecords: () => input.reminders,
  });
  const peopleById = new Map(
    input.people.map(person => {
      if (person.tenantId !== input.tenantId) throw new Error('Cross-tenant reminder person access denied');
      return [person.id, person] as const;
    }),
  );
  const items = service.list(context).map(item => {
    const person = peopleById.get(item.recipientId);
    if (!person) throw new Error('Reminder response references unknown person');
    return Object.freeze({
      ...item,
      displayName: person.displayName,
    });
  });
  return Object.freeze({
    contractVersion: 'people-reminders-v1' as const,
    items: Object.freeze(items),
  });
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    assertReminderListRequest(request);
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'schedule.read');
    requireCapability(principal, 'people.read');

    const [peopleRows, responseRows, reminderRows] = await Promise.all([
      database.entities(principal.tenantId, 'person'),
      database.entities(principal.tenantId, 'assignment-response'),
      database.entities(principal.tenantId, 'assignment-reminder'),
    ]);

    const people = Object.freeze(
      peopleRows.map(row => storedEntity<CongregationPerson>(row, principal.tenantId, 'person')),
    );
    const responses = Object.freeze(
      responseRows.map(row => normalizeAssignmentResponse(
        storedEntity<AssignmentResponse>(row, principal.tenantId, 'assignment response') as AssignmentResponse,
      )),
    );
    const reminders = Object.freeze(
      reminderRows.map(row => createAssignmentReminderRecord(
        storedEntity<AssignmentReminderRecord>(row, principal.tenantId, 'assignment reminder') as AssignmentReminderRecord,
      )),
    );

    json(response, 200, buildReminderListPayload({
      tenantId: principal.tenantId,
      actorId: principal.actorId,
      capabilities: principal.capabilities,
      people,
      responses,
      reminders,
    }));
  });
};

export default handler;

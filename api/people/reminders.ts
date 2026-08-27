import { AssignmentReminderReviewService, NotificationIntentService } from '@eutaktos/application';
import {
  createAccessContext,
  createAssignmentReminderRecord,
  normalizeAssignmentResponse,
  type AssignmentReminderRecord,
  type AssignmentResponse,
  type Capability,
  type CongregationPerson,
} from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import type { EntityRow } from '../_db';
import { BadRequestError, assertTrustedMutation, exactKeys, requestBody, requiredString, runEndpoint } from '../_endpoint';
import { ReminderNotificationIntentSnapshotUnitOfWork } from '../_notification-intent-uow';
import { PeopleSnapshotUnitOfWork } from '../_uow';
import { json, methodNotAllowed, type ApiHandler, type ApiRequest } from '../_types';

type TenantEntity = { readonly id: string; readonly tenantId: string };

type ReminderSendInput = Readonly<{
  responseId: string;
  mutationId: string;
  locale: 'pt-PT' | 'en' | 'es';
}>;

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

function opaqueId(value: string, field: string): string {
  if (/[\s/?#&=]/.test(value)) throw new BadRequestError(`${field} is invalid`);
  return value;
}

export function assertReminderListRequest(request: Pick<ApiRequest, 'query' | 'body'>): void {
  if (request.body !== undefined && request.body !== null) {
    throw new BadRequestError('Reminder GET does not accept a request body');
  }
  if (Object.keys(request.query).length > 0) {
    throw new BadRequestError('Reminder GET does not accept query fields');
  }
}

export function parseReminderSendRequest(request: Pick<ApiRequest, 'query' | 'body'>): ReminderSendInput {
  if (Object.keys(request.query).length > 0) throw new BadRequestError('Reminder POST does not accept query fields');
  const body = requestBody(request.body);
  exactKeys(body, ['responseId', 'mutationId', 'locale']);
  const responseId = opaqueId(requiredString(body, 'responseId', 200), 'responseId');
  const mutationId = opaqueId(requiredString(body, 'mutationId', 200), 'mutationId');
  const locale = requiredString(body, 'locale', 10);
  if (locale !== 'pt-PT' && locale !== 'en' && locale !== 'es') throw new BadRequestError('locale is invalid');
  return Object.freeze({ responseId, mutationId, locale });
}

export function buildReminderListPayload(input: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly capabilities: readonly Capability[];
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
  if (request.method !== 'GET' && request.method !== 'POST') { methodNotAllowed(response, ['GET', 'POST']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);

    if (request.method === 'GET') {
      assertReminderListRequest(request);
      requireCapability(principal, 'schedule.read');
      requireCapability(principal, 'people.read');
      const [peopleRows, responseRows, reminderRows] = await Promise.all([
        database.entities(principal.tenantId, 'person'),
        database.entities(principal.tenantId, 'assignment-response'),
        database.entities(principal.tenantId, 'assignment-reminder'),
      ]);
      const context = createAccessContext({
        tenantId: principal.tenantId,
        actorId: principal.actorId,
        capabilities: principal.capabilities,
      });
      const people = new PeopleSnapshotUnitOfWork(principal.tenantId, peopleRows).list(context);
      const responses = Object.freeze(responseRows.map(row => normalizeAssignmentResponse(
        storedEntity<AssignmentResponse>(row, principal.tenantId, 'assignment response') as AssignmentResponse,
      )));
      const reminders = Object.freeze(reminderRows.map(row => createAssignmentReminderRecord(
        storedEntity<AssignmentReminderRecord>(row, principal.tenantId, 'assignment reminder') as AssignmentReminderRecord,
      )));
      json(response, 200, buildReminderListPayload({
        tenantId: principal.tenantId,
        actorId: principal.actorId,
        capabilities: principal.capabilities,
        people,
        responses,
        reminders,
      }));
      return;
    }

    assertTrustedMutation(request);
    requireCapability(principal, 'schedule.write');
    requireCapability(principal, 'schedule.read');
    requireCapability(principal, 'people.read');
    const input = parseReminderSendRequest(request);
    const [peopleRows, responseRows, reminderRows, preferenceRows, deliveryRows] = await Promise.all([
      database.entities(principal.tenantId, 'person'),
      database.entities(principal.tenantId, 'assignment-response'),
      database.entities(principal.tenantId, 'assignment-reminder'),
      database.entities(principal.tenantId, 'notification-preferences'),
      database.entities(principal.tenantId, 'notification-delivery'),
    ]);
    const context = createAccessContext({
      tenantId: principal.tenantId,
      actorId: principal.actorId,
      capabilities: principal.capabilities,
    });
    const people = new PeopleSnapshotUnitOfWork(principal.tenantId, peopleRows).list(context);
    const responses = Object.freeze(responseRows.map(row => normalizeAssignmentResponse(
      storedEntity<AssignmentResponse>(row, principal.tenantId, 'assignment response') as AssignmentResponse,
    )));
    const reminders = Object.freeze(reminderRows.map(row => createAssignmentReminderRecord(
      storedEntity<AssignmentReminderRecord>(row, principal.tenantId, 'assignment reminder') as AssignmentReminderRecord,
    )));
    const target = buildReminderListPayload({
      tenantId: principal.tenantId,
      actorId: principal.actorId,
      capabilities: principal.capabilities,
      people,
      responses,
      reminders,
    }).items.find(item => item.responseId === input.responseId);
    if (!target) throw new BadRequestError('Reminder target is no longer pending');

    const unitOfWork = new ReminderNotificationIntentSnapshotUnitOfWork(principal.tenantId, {
      preferences: preferenceRows,
      deliveries: deliveryRows,
    });
    const service = new NotificationIntentService(unitOfWork, {
      now: () => new Date().toISOString(),
      nextId: scope => `${scope}-${crypto.randomUUID()}`,
    });
    const delivery = service.queueAssignmentIntent(context, {
      sourceEventId: `people-reminder-${input.mutationId}`,
      kind: 'reminder',
      assignmentId: target.assignmentId,
      recipientId: target.recipientId,
      locale: input.locale,
    });
    if (!delivery) throw new BadRequestError('No enabled reminder channel');
    await unitOfWork.flush(database);
    json(response, 202, Object.freeze({
      contractVersion: 'people-reminder-send-v1' as const,
      state: 'queued' as const,
      deliveryId: delivery.id,
      channel: delivery.channel,
    }));
  });
};

export default handler;

import {
  createAccessContext,
  createAuditEvent,
  createDomainEvent,
  ordinaryContactOf,
  type CongregationPerson,
  type DomainEventType,
} from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import { assertTrustedMutation, BadRequestError, exactKeys, requestBody, requiredString, runEndpoint, stringArray } from '../_endpoint';
import { correlationId } from '../_transport';
import { PeopleSnapshotUnitOfWork } from '../_uow';
import { json, methodNotAllowed, type ApiHandler } from '../_types';
import { PeopleTransferStore, PeopleTransferStoreError, type StoredPeopleTransfer } from './_transfer-store';

const TRANSFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function newReceiveToken(): string {
  return `etk_${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
}

function mutationId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._~-]{8,120}$/.test(normalized)) throw new BadRequestError('mutationId is invalid');
  return normalized;
}

function transferId(value: string): string {
  const normalized = value.trim();
  if (!/^people-transfer-[0-9a-f-]{36}$/.test(normalized)) throw new BadRequestError('transferId is invalid');
  return normalized;
}

function statusOf(transfer: StoredPeopleTransfer, now = Date.now()): 'pending' | 'received' | 'cancelled' | 'expired' {
  if (transfer.receivedAt) return 'received';
  if (transfer.cancelledAt) return 'cancelled';
  if (Date.parse(transfer.expiresAt) <= now) return 'expired';
  return 'pending';
}

function sourceProjection(transfer: StoredPeopleTransfer) {
  return Object.freeze({
    id: transfer.id,
    createdAt: transfer.createdAt,
    expiresAt: transfer.expiresAt,
    status: statusOf(transfer),
    people: Object.freeze(transfer.payload.people.map(person => Object.freeze({ displayName: person.displayName }))),
    history: Object.freeze(transfer.history.map(entry => Object.freeze({ action: entry.action, occurredAt: entry.occurredAt }))),
  });
}

function packagePerson(person: CongregationPerson) {
  const contact = ordinaryContactOf(person);
  return Object.freeze({
    displayName: person.displayName,
    ...(person.preferredLocale ? { preferredLocale: person.preferredLocale } : {}),
    ...(Object.keys(contact).length ? { ordinaryContact: contact } : {}),
  });
}

function evidence(
  tenantId: string,
  actorId: string,
  id: string,
  occurredAt: string,
  action: 'create' | 'update',
  eventType: DomainEventType,
  changedFields: readonly string[],
  requestCorrelationId?: string,
) {
  const audit = createAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    tenantId,
    resourceType: 'people-transfer',
    resourceId: id,
    action,
    actorId,
    occurredAt,
    changedFields,
  });
  const event = createDomainEvent({
    id: `event-${crypto.randomUUID()}`,
    tenantId,
    type: eventType,
    aggregateId: id,
    actorId,
    occurredAt,
    schemaVersion: 1,
    ...(requestCorrelationId ? { correlationId: requestCorrelationId } : {}),
  });
  return Object.freeze({ audit, event });
}

function transferStoreFailure(response: Parameters<typeof json>[0], error: PeopleTransferStoreError): boolean {
  if (error.code === 'not-found') { json(response, 404, { error: 'Transfer not found' }); return true; }
  if (error.code === 'not-pending' || error.code === 'unavailable') { json(response, 409, { error: 'Transfer is no longer pending' }); return true; }
  return false;
}

const handler: ApiHandler = async (request, response) => {
  if (!['GET', 'POST'].includes(request.method ?? '')) { methodNotAllowed(response, ['GET', 'POST']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    const store = new PeopleTransferStore();

    if (request.method === 'GET') {
      const transfers = await store.listForSourceTenant(principal.tenantId);
      json(response, 200, Object.freeze({ contractVersion: 'people-transfers-v1', transfers: Object.freeze(transfers.map(sourceProjection)) }));
      return;
    }

    assertTrustedMutation(request);
    requireCapability(principal, 'people.write');
    const body = requestBody(request.body);
    const action = requiredString(body, 'action', 20);
    const requestCorrelationId = correlationId(request);

    if (action === 'create') {
      exactKeys(body, ['action', 'personIds', 'mutationId']);
      const selectedPersonIds = stringArray(body, 'personIds', 20);
      if (selectedPersonIds.length < 1) throw new BadRequestError('Select at least one person');
      const idempotencyId = mutationId(requiredString(body, 'mutationId', 120));
      const existing = await store.bySourceMutation(principal.tenantId, idempotencyId);
      if (existing) {
        json(response, 200, Object.freeze({
          contractVersion: 'people-transfer-created-v1',
          transfer: sourceProjection(existing),
          receiveToken: null,
          tokenState: 'rotate-required' as const,
        }));
        return;
      }

      const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
      const unitOfWork = new PeopleSnapshotUnitOfWork(principal.tenantId, await database.entities(principal.tenantId, 'person'));
      const people = selectedPersonIds.map(personId => {
        const person = unitOfWork.findById(context, personId);
        if (!person) throw new BadRequestError('Selected person not found');
        if (!person.active) throw new BadRequestError('Only active people can be transferred');
        return person;
      });

      const id = `people-transfer-${crypto.randomUUID()}`;
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.parse(createdAt) + TRANSFER_TTL_MS).toISOString();
      const receiveToken = newReceiveToken();
      const tokenHash = await sha256(receiveToken);
      const changeEvidence = evidence(principal.tenantId, principal.actorId, id, createdAt, 'create', 'PeopleTransferCreated', ['people', 'status'], requestCorrelationId);
      const transfer = Object.freeze({
        id,
        sourceTenantId: principal.tenantId,
        clientMutationId: idempotencyId,
        tokenHash,
        payload: Object.freeze({ contractVersion: 'people-transfer-package-v1' as const, people: Object.freeze(people.map(packagePerson)) }),
        createdBy: principal.actorId,
        createdAt,
        expiresAt,
      });
      await store.create(transfer, changeEvidence.audit, changeEvidence.event);
      const stored = await store.bySourceId(principal.tenantId, id);
      if (!stored) throw new Error('People transfer create did not persist');
      json(response, 201, Object.freeze({
        contractVersion: 'people-transfer-created-v1',
        transfer: sourceProjection(stored),
        receiveToken,
        tokenState: 'available' as const,
      }));
      return;
    }

    if (action === 'rotate-token') {
      exactKeys(body, ['action', 'transferId']);
      const id = transferId(requiredString(body, 'transferId', 200));
      const existing = await store.bySourceId(principal.tenantId, id);
      if (!existing) { json(response, 404, { error: 'Transfer not found' }); return; }
      if (statusOf(existing) !== 'pending') { json(response, 409, { error: 'Transfer is no longer pending' }); return; }
      const receiveToken = newReceiveToken();
      const tokenHash = await sha256(receiveToken);
      const occurredAt = new Date().toISOString();
      const changeEvidence = evidence(principal.tenantId, principal.actorId, id, occurredAt, 'update', 'PeopleTransferTokenRotated', ['token'], requestCorrelationId);
      try { await store.rotate(principal.tenantId, id, tokenHash, occurredAt, changeEvidence.audit, changeEvidence.event); }
      catch (error) { if (error instanceof PeopleTransferStoreError && transferStoreFailure(response, error)) return; throw error; }
      const stored = await store.bySourceId(principal.tenantId, id);
      if (!stored) throw new Error('People transfer rotate did not persist');
      json(response, 200, Object.freeze({ contractVersion: 'people-transfer-created-v1', transfer: sourceProjection(stored), receiveToken, tokenState: 'available' as const }));
      return;
    }

    if (action === 'cancel') {
      exactKeys(body, ['action', 'transferId']);
      const id = transferId(requiredString(body, 'transferId', 200));
      const existing = await store.bySourceId(principal.tenantId, id);
      if (!existing) { json(response, 404, { error: 'Transfer not found' }); return; }
      if (statusOf(existing) === 'received') { json(response, 409, { error: 'Received transfer cannot be cancelled' }); return; }
      if (statusOf(existing) === 'cancelled') { json(response, 200, Object.freeze({ contractVersion: 'people-transfer-cancelled-v1', transfer: sourceProjection(existing) })); return; }
      const occurredAt = new Date().toISOString();
      const changeEvidence = evidence(principal.tenantId, principal.actorId, id, occurredAt, 'update', 'PeopleTransferCancelled', ['status'], requestCorrelationId);
      try { await store.cancel(principal.tenantId, id, occurredAt, changeEvidence.audit, changeEvidence.event); }
      catch (error) { if (error instanceof PeopleTransferStoreError && transferStoreFailure(response, error)) return; throw error; }
      const stored = await store.bySourceId(principal.tenantId, id);
      if (!stored) throw new Error('People transfer cancellation did not persist');
      json(response, 200, Object.freeze({ contractVersion: 'people-transfer-cancelled-v1', transfer: sourceProjection(stored) }));
      return;
    }

    throw new BadRequestError('Unknown transfer action');
  });
};

export default handler;

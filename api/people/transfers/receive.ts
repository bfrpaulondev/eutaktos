import { createAuditEvent, createDomainEvent } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../../_auth';
import { assertTrustedMutation, BadRequestError, exactKeys, requestBody, requiredString, runEndpoint } from '../../_endpoint';
import { correlationId } from '../../_transport';
import { json, methodNotAllowed, type ApiHandler } from '../../_types';
import { PeopleTransferStore, PeopleTransferStoreError, type StoredPeopleTransfer } from '../_transfer-store';

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function receiveToken(body: Readonly<Record<string, unknown>>): string {
  const token = requiredString(body, 'token', 100);
  if (!/^etk_[0-9a-f]{64}$/.test(token)) throw new BadRequestError('Transfer code is invalid');
  return token;
}

function availability(transfer: StoredPeopleTransfer, destinationTenantId: string, now = Date.now()): 'available' | 'unavailable' | 'same-tenant' | 'already-received-here' {
  if (transfer.sourceTenantId === destinationTenantId) return 'same-tenant';
  if (transfer.receivedAt) return transfer.receivedByTenantId === destinationTenantId ? 'already-received-here' : 'unavailable';
  if (transfer.cancelledAt || Date.parse(transfer.expiresAt) <= now) return 'unavailable';
  return 'available';
}

function personProjection(person: StoredPeopleTransfer['payload']['people'][number]) {
  return Object.freeze({
    displayName: person.displayName,
    ...(person.preferredLocale ? { preferredLocale: person.preferredLocale } : {}),
    ...(person.ordinaryContact ? { ordinaryContact: person.ordinaryContact } : {}),
  });
}

function previewProjection(transfer: StoredPeopleTransfer, destinationTenantId: string) {
  const state = availability(transfer, destinationTenantId);
  if (state === 'same-tenant') throw new PeopleTransferStoreError('same-tenant');
  if (state === 'unavailable') throw new PeopleTransferStoreError('unavailable');
  return Object.freeze({
    contractVersion: 'people-transfer-preview-v1' as const,
    status: state === 'already-received-here' ? 'already-received' as const : 'available' as const,
    expiresAt: transfer.expiresAt,
    people: Object.freeze(transfer.payload.people.map(personProjection)),
  });
}

function expectedFailure(response: Parameters<typeof json>[0], error: PeopleTransferStoreError): boolean {
  if (error.code === 'not-found' || error.code === 'unavailable') { json(response, 404, { error: 'Transfer is not available' }); return true; }
  if (error.code === 'already-received') { json(response, 409, { error: 'Transfer has already been received' }); return true; }
  if (error.code === 'same-tenant') { json(response, 409, { error: 'A transfer cannot be received by its source congregation' }); return true; }
  return false;
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'people.write');
    const body = requestBody(request.body);
    exactKeys(body, ['action', 'token']);
    const action = requiredString(body, 'action', 20);
    if (action !== 'preview' && action !== 'receive') throw new BadRequestError('action must be preview or receive');
    const token = receiveToken(body);
    const tokenHash = await sha256(token);
    const store = new PeopleTransferStore();
    const transfer = await store.byTokenHash(tokenHash);
    if (!transfer) { json(response, 404, { error: 'Transfer is not available' }); return; }

    try {
      const preview = previewProjection(transfer, principal.tenantId);
      if (action === 'preview') { json(response, 200, preview); return; }

      const occurredAt = new Date().toISOString();
      const audit = createAuditEvent({
        id: `audit-${crypto.randomUUID()}`,
        tenantId: principal.tenantId,
        resourceType: 'people-transfer',
        resourceId: transfer.id,
        action: 'create',
        actorId: principal.actorId,
        occurredAt,
        changedFields: ['people', 'status'],
      });
      const requestCorrelationId = correlationId(request);
      const event = createDomainEvent({
        id: `event-${crypto.randomUUID()}`,
        tenantId: principal.tenantId,
        type: 'PeopleTransferReceived',
        aggregateId: transfer.id,
        actorId: principal.actorId,
        occurredAt,
        schemaVersion: 1,
        ...(requestCorrelationId ? { correlationId: requestCorrelationId } : {}),
      });
      const result = await store.receive(tokenHash, principal.tenantId, principal.actorId, occurredAt, audit, event);
      json(response, 200, Object.freeze({
        contractVersion: 'people-transfer-received-v1',
        outcome: result.outcome,
        createdCount: result.createdPersonIds.length,
        people: preview.people.map(person => Object.freeze({ displayName: person.displayName })),
      }));
    } catch (error) {
      if (error instanceof PeopleTransferStoreError && expectedFailure(response, error)) return;
      throw error;
    }
  });
};

export default handler;

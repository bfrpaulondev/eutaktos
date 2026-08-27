import { createAccessContext } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import { assertTrustedMutation, BadRequestError, runEndpoint } from '../_endpoint';
import { PeopleTransfersDatabase } from '../_people-transfers-db';
import { PeopleSnapshotUnitOfWork } from '../_uow';
import { json, methodNotAllowed, type ApiHandler } from '../_types';
import {
  createPeopleTransferSecret,
  parseSendPeopleTransferBody,
  PEOPLE_TRANSFER_TTL_MS,
  transferPayloadFromPeople,
  transferStatus,
} from './transfer-contract';

const handler: ApiHandler = async (request, response) => {
  if (!['GET', 'POST'].includes(request.method ?? '')) { methodNotAllowed(response, ['GET', 'POST']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    const transferDatabase = new PeopleTransfersDatabase();

    if (request.method === 'GET') {
      const transfers = await transferDatabase.list(principal.tenantId);
      json(response, 200, Object.freeze({
        contractVersion: 'people-transfers-v1',
        transfers: Object.freeze(transfers.map(transfer => Object.freeze({
          transferId: transfer.id,
          status: transferStatus(transfer),
          createdAt: transfer.createdAt,
          expiresAt: transfer.expiresAt,
          ...(transfer.claimedAt ? { claimedAt: transfer.claimedAt } : {}),
          ...(transfer.cancelledAt ? { cancelledAt: transfer.cancelledAt } : {}),
          people: transfer.people,
        }))),
      }));
      return;
    }

    assertTrustedMutation(request);
    requireCapability(principal, 'people.write');
    const personIds = parseSendPeopleTransferBody(request.body);
    const rows = await database.entities(principal.tenantId, 'person');
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
    const peopleUnit = new PeopleSnapshotUnitOfWork(principal.tenantId, rows);
    const selected = personIds.map(personId => {
      const person = peopleUnit.findById(context, personId);
      if (!person) throw new BadRequestError('One or more selected people were not found');
      return person;
    });
    const payload = transferPayloadFromPeople(selected);
    const secret = createPeopleTransferSecret();
    const tokenHash = await secret.tokenHash;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.parse(createdAt) + PEOPLE_TRANSFER_TTL_MS).toISOString();
    const transferId = `people-transfer-${crypto.randomUUID()}`;
    await transferDatabase.create({
      p_transfer_id: transferId,
      p_source_tenant_id: principal.tenantId,
      p_source_actor_id: principal.actorId,
      p_token_hash: tokenHash,
      p_payload: payload,
      p_created_at: createdAt,
      p_expires_at: expiresAt,
    });
    json(response, 201, Object.freeze({
      contractVersion: 'people-transfer-send-v1',
      transferId,
      code: secret.code,
      expiresAt,
      people: Object.freeze(selected.map(person => Object.freeze({ personId: person.id, displayName: person.displayName }))),
    }));
  });
};

export default handler;
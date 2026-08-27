import { requireCapability, resolvePrincipal } from '../../_auth';
import { assertTrustedMutation, BadRequestError, runEndpoint } from '../../_endpoint';
import { PeopleTransfersDatabase } from '../../_people-transfers-db';
import { json, methodNotAllowed, type ApiHandler } from '../../_types';
import { hashPeopleTransferCode, parseTransferCodeBody } from '../transfer-contract';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'people.write');
    const code = parseTransferCodeBody(request.body);
    const tokenHash = await hashPeopleTransferCode(code);
    const result = await new PeopleTransfersDatabase().claim(tokenHash, principal.tenantId, principal.actorId, new Date().toISOString());
    if (!result) throw new BadRequestError('Transfer code is invalid, expired or already used');
    json(response, 200, Object.freeze({
      contractVersion: 'people-transfer-claim-v1',
      transferId: result.transferId,
      outcome: result.outcome,
      people: result.people,
    }));
  });
};

export default handler;
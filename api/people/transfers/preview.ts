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
    const preview = await new PeopleTransfersDatabase().preview(tokenHash, new Date().toISOString());
    if (!preview) throw new BadRequestError('Transfer code is invalid, expired or no longer available');
    json(response, 200, Object.freeze({
      contractVersion: 'people-transfer-preview-v1',
      transferId: preview.transferId,
      expiresAt: preview.expiresAt,
      people: preview.people,
    }));
  });
};

export default handler;
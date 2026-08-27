import { requireCapability, resolvePrincipal } from '../../../_auth';
import { assertTrustedMutation, BadRequestError, runEndpoint } from '../../../_endpoint';
import { PeopleTransfersDatabase } from '../../../_people-transfers-db';
import { json, methodNotAllowed, type ApiHandler } from '../../../_types';

function transferId(value: string | string[] | undefined): string {
  if (Array.isArray(value) || typeof value !== 'string' || !/^people-transfer-[A-Za-z0-9-]{1,100}$/.test(value)) throw new BadRequestError('transferId is invalid');
  return value;
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'people.write');
    const id = transferId(request.query.transferId);
    const changed = await new PeopleTransfersDatabase().cancel(id, principal.tenantId, principal.actorId, new Date().toISOString());
    json(response, 200, Object.freeze({ contractVersion: 'people-transfer-cancel-v1', transferId: id, cancelled: true, changed }));
  });
};

export default handler;
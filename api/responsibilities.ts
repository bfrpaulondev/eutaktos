import { requireCapability, resolvePrincipal } from './_auth';
import { responsibilityDto } from './_entity-read';
import { runEndpoint } from './_endpoint';
import { json, methodNotAllowed, type ApiHandler } from './_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'responsibilities.read');
    const items = (await database.entities(principal.tenantId, 'responsibility')).map(row => responsibilityDto(row, principal.tenantId));
    json(response, 200, items);
  });
};
export default handler;

import { requireCapability, resolvePrincipal } from './_auth';
import { serviceGroupDto } from './_entity-read';
import { runEndpoint } from './_endpoint';
import { json, methodNotAllowed, type ApiHandler } from './_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    const groups = (await database.entities(principal.tenantId, 'service-group')).map(row => serviceGroupDto(row, principal.tenantId));
    json(response, 200, groups);
  });
};
export default handler;

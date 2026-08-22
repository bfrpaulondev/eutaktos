import { requireCapability, resolvePrincipal } from './_auth';
import { householdDto } from './_entity-read';
import { runEndpoint } from './_endpoint';
import { json, methodNotAllowed, type ApiHandler } from './_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    const households = (await database.entities(principal.tenantId, 'household')).map(row => householdDto(row, principal.tenantId));
    json(response, 200, households);
  });
};
export default handler;

import { resolvePrincipal } from './_auth';
import { runEndpoint } from './_endpoint';
import { json, methodNotAllowed, type ApiHandler } from './_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    json(response, 200, { actorId: principal.actorId, capabilities: principal.capabilities });
  });
};
export default handler;

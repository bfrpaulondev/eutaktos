import { HouseholdHttpTransport } from '@eutaktos/transport';
import { requireCapability, resolvePrincipal } from './_auth';
import { householdDto } from './_entity-read';
import { assertTrustedMutation, runEndpoint } from './_endpoint';
import { organizationRuntime } from './_organization';
import { sendTransport, transportRequest } from './_transport';
import { json, methodNotAllowed, type ApiHandler } from './_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'POST') { methodNotAllowed(response, ['GET','POST']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    if (request.method === 'GET') {
      requireCapability(principal, 'people.read');
      const rows = await database.entities(principal.tenantId, 'household');
      json(response, 200, rows.map(row => householdDto(row, principal.tenantId)));
      return;
    }
    assertTrustedMutation(request);
    const runtime = await organizationRuntime(database, principal.tenantId);
    const result = new HouseholdHttpTransport(runtime.service).create(transportRequest(request, principal));
    if (result.status >= 200 && result.status < 300) await runtime.unitOfWork.flush(database);
    sendTransport(response, result);
  });
};
export default handler;

import { PeopleDirectoryService } from '@eutaktos/application';
import { PeopleHttpTransport } from '@eutaktos/transport';
import { requireCapability, resolvePrincipal } from './_auth';
import { personDto } from './_entity-read';
import { assertTrustedMutation, runEndpoint } from './_endpoint';
import { sendTransport, transportRequest } from './_transport';
import { RuntimeIds, PeopleSnapshotUnitOfWork } from './_uow';
import { json, methodNotAllowed, type ApiHandler } from './_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'POST') { methodNotAllowed(response, ['GET','POST']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    const rows = await database.entities(principal.tenantId, 'person');
    if (request.method === 'GET') {
      requireCapability(principal, 'people.read');
      json(response, 200, rows.map(row => personDto(row, principal.tenantId)));
      return;
    }
    assertTrustedMutation(request);
    const unitOfWork = new PeopleSnapshotUnitOfWork(principal.tenantId, rows);
    const service = new PeopleDirectoryService(unitOfWork, new RuntimeIds());
    const result = new PeopleHttpTransport(service).create(transportRequest(request, principal));
    if (result.status >= 200 && result.status < 300) await unitOfWork.flush(database);
    sendTransport(response, result);
  });
};
export default handler;

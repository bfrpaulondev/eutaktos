import { PeopleDirectoryService } from '@eutaktos/application';
import { OrdinaryContactHttpTransport } from '@eutaktos/transport';
import { resolvePrincipal } from '../../_auth';
import { assertTrustedMutation, BadRequestError, runEndpoint } from '../../_endpoint';
import { sendTransport, transportRequest } from '../../_transport';
import { PeopleSnapshotUnitOfWork, RuntimeIds } from '../../_uow';
import { methodNotAllowed, queryValue, type ApiHandler } from '../../_types';

const handler: ApiHandler = async (request, response) => {
  if (!['GET', 'PUT'].includes(request.method ?? '')) {
    methodNotAllowed(response, ['GET', 'PUT']);
    return;
  }

  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    const personId = queryValue(request, 'personId')?.trim();
    if (!personId || personId.length > 200) throw new BadRequestError('Invalid personId');

    const rows = await database.entities(principal.tenantId, 'person');
    const unitOfWork = new PeopleSnapshotUnitOfWork(principal.tenantId, rows);
    const transport = new OrdinaryContactHttpTransport(new PeopleDirectoryService(unitOfWork, new RuntimeIds()));
    const transportReq = transportRequest(request, principal, { personId });
    const result = request.method === 'GET'
      ? transport.get(transportReq)
      : (() => {
          assertTrustedMutation(request);
          return transport.update(transportReq);
        })();

    if (request.method === 'PUT' && result.status >= 200 && result.status < 300) {
      await unitOfWork.flush(database);
    }
    sendTransport(response, result);
  });
};

export default handler;

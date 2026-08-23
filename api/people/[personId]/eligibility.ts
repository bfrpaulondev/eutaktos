import { EligibilityService } from '@eutaktos/application';
import { EligibilityHttpTransport } from '@eutaktos/transport';
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
    const service = new EligibilityService(unitOfWork, new RuntimeIds());
    const transport = new EligibilityHttpTransport(service);
    const transportReq = transportRequest(request, principal, { personId });

    const result = request.method === 'GET'
      ? transport.list(transportReq)
      : (() => {
          assertTrustedMutation(request);
          return transport.set(transportReq);
        })();

    if (request.method !== 'GET' && result.status >= 200 && result.status < 300) {
      await unitOfWork.flush(database);
    }
    sendTransport(response, result);
  });
};

export default handler;

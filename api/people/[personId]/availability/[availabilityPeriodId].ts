import { AvailabilityService } from '@eutaktos/application';
import { AvailabilityHttpTransport } from '@eutaktos/transport';
import { resolvePrincipal } from '../../../_auth';
import { assertTrustedMutation, BadRequestError, runEndpoint } from '../../../_endpoint';
import { sendTransport, transportRequest } from '../../../_transport';
import { PeopleSnapshotUnitOfWork, RuntimeIds } from '../../../_uow';
import { methodNotAllowed, queryValue, type ApiHandler } from '../../../_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'DELETE') {
    methodNotAllowed(response, ['DELETE']);
    return;
  }

  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const principal = await resolvePrincipal(request, database);
    const personId = queryValue(request, 'personId')?.trim();
    const availabilityPeriodId = queryValue(request, 'availabilityPeriodId')?.trim();
    if (!personId || personId.length > 200) throw new BadRequestError('Invalid personId');
    if (!availabilityPeriodId || availabilityPeriodId.length > 200) throw new BadRequestError('Invalid availabilityPeriodId');

    const rows = await database.entities(principal.tenantId, 'person');
    const unitOfWork = new PeopleSnapshotUnitOfWork(principal.tenantId, rows);
    const service = new AvailabilityService(unitOfWork, new RuntimeIds());
    const transport = new AvailabilityHttpTransport(service);
    const result = transport.remove(transportRequest(request, principal, { personId, availabilityPeriodId }));
    if (result.status >= 200 && result.status < 300) await unitOfWork.flush(database);
    sendTransport(response, result);
  });
};

export default handler;

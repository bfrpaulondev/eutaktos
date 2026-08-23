import { CongregationSettingsService } from '@eutaktos/application';
import { CongregationSettingsHttpTransport } from '@eutaktos/transport';
import { requireCapability, resolvePrincipal } from '../_auth';
import { assertTrustedMutation, runEndpoint } from '../_endpoint';
import { CongregationSnapshotUnitOfWork } from '../_congregation-uow';
import { RuntimeIds } from '../_uow';
import { sendTransport, transportRequest } from '../_transport';
import { methodNotAllowed, type ApiHandler } from '../_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'PUT') {
    methodNotAllowed(response, ['GET', 'PUT']);
    return;
  }

  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'tenant.manage');
    if (request.method === 'PUT') assertTrustedMutation(request);

    const rows = await database.entities(principal.tenantId, 'congregation');
    const unitOfWork = new CongregationSnapshotUnitOfWork(principal.tenantId, rows);
    const service = new CongregationSettingsService(unitOfWork, new RuntimeIds());
    const transport = new CongregationSettingsHttpTransport(service);
    const result = request.method === 'GET'
      ? transport.get(transportRequest(request, principal))
      : transport.save(transportRequest(request, principal));

    if (request.method === 'PUT' && result.status >= 200 && result.status < 300) {
      await unitOfWork.flush(database);
    }
    sendTransport(response, result);
  });
};

export default handler;

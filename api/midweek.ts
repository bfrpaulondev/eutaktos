import { MidweekSchedulingHttpTransport } from '@eutaktos/transport';
import { requireCapability, resolvePrincipal } from './_auth';
import { assertTrustedMutation, runEndpoint } from './_endpoint';
import { loadMidweekOverview, loadMidweekScheduling } from './_midweek';
import { sendTransport, transportRequest } from './_transport';
import { json, methodNotAllowed, type ApiHandler } from './_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'POST') { methodNotAllowed(response, ['GET', 'POST']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    if (request.method === 'GET') {
      json(response, 200, await loadMidweekOverview(database, principal));
      return;
    }
    requireCapability(principal, 'schedule.write');
    assertTrustedMutation(request);
    const { service, unitOfWork } = await loadMidweekScheduling(database, principal);
    const result = new MidweekSchedulingHttpTransport(service).createMeeting(transportRequest(request, principal));
    if (result.status >= 200 && result.status < 300) await unitOfWork.flush(database);
    sendTransport(response, result);
  });
};

export default handler;

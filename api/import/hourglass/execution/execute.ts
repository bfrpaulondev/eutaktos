import { createAccessContext } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../../../_auth';
import { assertTrustedMutation, BadRequestError, exactKeys, requestBody, requiredString, runEndpoint } from '../../../_endpoint';
import { json, methodNotAllowed, type ApiHandler } from '../../../_types';
import { executePreparedHourglassHandshake, HourglassHandshakeError } from '../_handshake';
import { HOURGLASS_REQUEST_MAX_BODY_BYTES, inspectHourglassRequestPayload } from '../_request';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'people.write');
    requireCapability(principal, 'eligibility.read');
    requireCapability(principal, 'eligibility.write');

    const body = requestBody(request.body);
    exactKeys(body, ['source', 'payload', 'attemptId', 'confirmationDigest']);
    const attemptId = requiredString(body, 'attemptId', 120);
    const confirmationDigest = requiredString(body, 'confirmationDigest', 64);
    const inspection = inspectHourglassRequestPayload(body.source, body.payload);
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });

    try {
      const result = await executePreparedHourglassHandshake(database, context, inspection, attemptId, confirmationDigest);
      json(response, 200, result);
    } catch (error) {
      if (error instanceof HourglassHandshakeError) throw new BadRequestError(error.message);
      throw error;
    }
  }, { maxBodyBytes: HOURGLASS_REQUEST_MAX_BODY_BYTES });
};

export default handler;

import { HOURGLASS_IMPORT_LIMITS } from '@eutaktos/application';
import { createAccessContext } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../../_auth';
import { BadRequestError, assertTrustedMutation, runEndpoint } from '../../_endpoint';
import { json, methodNotAllowed, type ApiHandler } from '../../_types';
import { preparePersistedHourglassExecutionAttempt } from './_attempt';
import { parseHourglassPrepareRequest } from './_request';

function expectedError(error: unknown): never {
  if (error instanceof Error && error.message.startsWith('Hourglass ')) throw new BadRequestError(error.message);
  throw error;
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'people.write');
    requireCapability(principal, 'eligibility.read');
    requireCapability(principal, 'eligibility.write');
    const input = parseHourglassPrepareRequest(request);
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
    try {
      const attempt = await preparePersistedHourglassExecutionAttempt(database, context, input.inspection, input.mutationId);
      json(response, 200, Object.freeze({
        contractVersion: 'hourglass-execution-prepare-v1',
        executionId: attempt.executionId,
        expiresAt: attempt.expiresAt,
        counts: attempt.counts,
        canExecute: attempt.counts.conflict === 0,
      }));
    } catch (error) { expectedError(error); }
  }, { maxBodyBytes: HOURGLASS_IMPORT_LIMITS.maxJsonBytes + 2048 });
};

export default handler;

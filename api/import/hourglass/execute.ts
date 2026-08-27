import { HOURGLASS_IMPORT_LIMITS } from '@eutaktos/application';
import { createAccessContext } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../../_auth';
import { BadRequestError, assertTrustedMutation, runEndpoint } from '../../_endpoint';
import { json, methodNotAllowed, type ApiHandler } from '../../_types';
import { loadPersistedHourglassExecutionAttempt } from './_attempt';
import { executeHourglassImport } from './_execution';
import { parseHourglassExecuteRequest } from './_request';

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
    const input = parseHourglassExecuteRequest(request);
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
    try {
      const attempt = await loadPersistedHourglassExecutionAttempt(database, context, input.inspection, input.executionId, input.confirmationDigest);
      const result = await executeHourglassImport(database, context, input.inspection, attempt.confirmationDigest, attempt);
      json(response, 200, Object.freeze({
        contractVersion: 'hourglass-execution-result-v1',
        outcome: result.outcome,
        ...(result.migrationId ? { migrationId: result.migrationId } : {}),
        createdCount: result.createdCount,
        unchangedCount: result.unchangedCount,
      }));
    } catch (error) { expectedError(error); }
  }, { maxBodyBytes: HOURGLASS_IMPORT_LIMITS.maxJsonBytes + 2048 });
};

export default handler;

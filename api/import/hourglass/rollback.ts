import { createAccessContext } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../../_auth';
import { BadRequestError, assertTrustedMutation, runEndpoint } from '../../_endpoint';
import { json, methodNotAllowed, type ApiHandler } from '../../_types';
import { parseHourglassRollbackRequest } from './_request';
import { rollbackHourglassImport } from './_rollback';

function expectedError(error: unknown): never {
  if (error instanceof Error && error.message.startsWith('Hourglass ')) throw new BadRequestError(error.message);
  throw error;
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    assertTrustedMutation(request);
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.write');
    requireCapability(principal, 'eligibility.write');
    const migrationId = parseHourglassRollbackRequest(request);
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
    try {
      const result = await rollbackHourglassImport(database, context, migrationId);
      json(response, 200, Object.freeze({
        contractVersion: 'hourglass-rollback-result-v1',
        outcome: result.outcome,
        migrationId: result.migrationId,
        removedCount: result.removedCount,
      }));
    } catch (error) { expectedError(error); }
  });
};

export default handler;

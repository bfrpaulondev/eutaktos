import { HOURGLASS_IMPORT_LIMITS, type HourglassMigrationPreview } from '@eutaktos/application';
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

function reasonCode(reason: string): 'DISPLAY_NAME_DIFFERS' | 'EXPLICIT_ELIGIBILITY_DIFFERS' {
  if (reason === 'Display name differs from the existing Eutaktos person') return 'DISPLAY_NAME_DIFFERS';
  if (reason === 'Explicit eligibility differs from the Hourglass import') return 'EXPLICIT_ELIGIBILITY_DIFFERS';
  throw new Error('Unknown Hourglass preview reason');
}

function publicPreview(preview: Readonly<HourglassMigrationPreview>) {
  return Object.freeze({
    matchingPolicy: 'tenant-scoped-external-id-only' as const,
    counts: preview.counts,
    report: preview.report,
    persons: Object.freeze(preview.persons.map(person => Object.freeze({
      displayName: person.displayName,
      action: person.action,
      linked: Boolean(person.targetPersonId),
      reasonCodes: Object.freeze(person.reasons.map(reasonCode)),
      explicitAssignmentTypeIds: person.explicitAssignmentTypeIds,
    }))),
  });
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
      const prepared = await preparePersistedHourglassExecutionAttempt(database, context, input.inspection, input.mutationId);
      const attempt = prepared.attempt;
      json(response, 200, Object.freeze({
        contractVersion: 'hourglass-execution-prepare-v1',
        executionId: attempt.executionId,
        expiresAt: attempt.expiresAt,
        confirmationDigest: attempt.confirmationDigest,
        counts: attempt.counts,
        canExecute: attempt.counts.conflict === 0,
        preview: publicPreview(prepared.preview),
      }));
    } catch (error) { expectedError(error); }
  }, { maxBodyBytes: HOURGLASS_IMPORT_LIMITS.maxJsonBytes + 2048 });
};

export default handler;

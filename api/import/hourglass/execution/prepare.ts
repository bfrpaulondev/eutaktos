import type { HourglassMigrationPreview } from '@eutaktos/application';
import { createAccessContext } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../../../_auth';
import { assertTrustedMutation, BadRequestError, exactKeys, requestBody, runEndpoint } from '../../../_endpoint';
import { json, methodNotAllowed, type ApiHandler } from '../../../_types';
import { HourglassHandshakeError, prepareHourglassExecutionHandshake } from '../_handshake';
import { HOURGLASS_REQUEST_MAX_BODY_BYTES, inspectHourglassRequestPayload } from '../_request';

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

    const body = requestBody(request.body);
    exactKeys(body, ['source', 'payload']);
    const inspection = inspectHourglassRequestPayload(body.source, body.payload);
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
    try {
      const prepared = await prepareHourglassExecutionHandshake(database, context, inspection);
      json(response, 200, Object.freeze({
        attemptId: prepared.attemptId,
        expiresAt: prepared.expiresAt,
        confirmationDigest: prepared.confirmationDigest,
        ...publicPreview(prepared.preview),
      }));
    } catch (error) {
      if (error instanceof HourglassHandshakeError) throw new BadRequestError(error.message);
      throw error;
    }
  }, { maxBodyBytes: HOURGLASS_REQUEST_MAX_BODY_BYTES });
};

export default handler;

import { PersonArchiveService } from '@eutaktos/application';
import {
  createAccessContext,
  personArchiveState,
  type CongregationPerson,
  type PersonArchiveState,
} from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../../_auth';
import { assertTrustedMutation, BadRequestError, exactKeys, requestBody, requiredString, runEndpoint } from '../../_endpoint';
import { PeopleSnapshotUnitOfWork, RuntimeIds } from '../../_uow';
import { json, methodNotAllowed, queryValue, type ApiHandler } from '../../_types';

function projection(person: CongregationPerson, canWrite: boolean) {
  const state = personArchiveState(person);
  return Object.freeze({
    status: state.current ? 'archived' as const : 'active' as const,
    ...(state.current ? { current: Object.freeze({ archivedAt: state.current.archivedAt, reason: state.current.reason }) } : {}),
    history: Object.freeze(state.history.map(entry => Object.freeze({
      action: entry.action,
      occurredAt: entry.occurredAt,
      ...(entry.reason ? { reason: entry.reason } : {}),
    }))),
    capabilities: Object.freeze({ write: canWrite }),
  });
}

function sameArchiveReason(state: PersonArchiveState, reason: string): boolean {
  return state.current?.reason === reason.trim().replace(/\s+/g, ' ');
}

const handler: ApiHandler = async (request, response) => {
  if (!['GET', 'POST'].includes(request.method ?? '')) { methodNotAllowed(response, ['GET', 'POST']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    const personId = queryValue(request, 'personId')?.trim();
    if (!personId || personId.length > 200) throw new BadRequestError('Invalid personId');

    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
    const rows = await database.entities(principal.tenantId, 'person');
    const unitOfWork = new PeopleSnapshotUnitOfWork(principal.tenantId, rows);
    const existing = unitOfWork.findById(context, personId);
    if (!existing) { json(response, 404, { error: 'Person not found' }); return; }
    const canWrite = principal.capabilities.includes('people.write');

    if (request.method === 'GET') {
      json(response, 200, projection(existing, canWrite));
      return;
    }

    assertTrustedMutation(request);
    requireCapability(principal, 'people.write');
    const body = requestBody(request.body);
    exactKeys(body, ['action', 'reason']);
    const action = requiredString(body, 'action', 20);
    const service = new PersonArchiveService(unitOfWork, new RuntimeIds());
    let person: CongregationPerson;

    if (action === 'archive') {
      const reason = requiredString(body, 'reason', 240);
      const state = personArchiveState(existing);
      if (state.current) {
        if (!sameArchiveReason(state, reason)) throw new BadRequestError('Person is already archived');
        json(response, 200, projection(existing, true));
        return;
      }
      person = service.archive(context, { personId, reason }, { correlationId: request.headers?.['x-correlation-id'] as string | undefined });
    } else if (action === 'restore') {
      if (body.reason !== undefined) throw new BadRequestError('reason is not allowed for restore');
      const state = personArchiveState(existing);
      if (!state.current) {
        if (state.history.at(-1)?.action === 'restored') { json(response, 200, projection(existing, true)); return; }
        throw new BadRequestError('Person is not archived');
      }
      person = service.restore(context, { personId }, { correlationId: request.headers?.['x-correlation-id'] as string | undefined });
    } else {
      throw new BadRequestError('action must be archive or restore');
    }

    await unitOfWork.flush(database);
    json(response, 200, projection(person, true));
  });
};

export default handler;

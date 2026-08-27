import { requireCapability, resolvePrincipal } from '../_auth';
import { runEndpoint } from '../_endpoint';
import { PeopleSnapshotUnitOfWork } from '../_uow';
import { json, methodNotAllowed, type ApiHandler } from '../_types';
import { buildAuthorizedHourglassIndex } from './hourglass-index-model';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') {
    methodNotAllowed(response, ['GET']);
    return;
  }

  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    // Import preview is administrative: reading the directory alone must not expose
    // migration identities or explicit eligibility. Require both capabilities.
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'people.write');

    const rows = await database.entities(principal.tenantId, 'person');
    const people = new PeopleSnapshotUnitOfWork(principal.tenantId, rows).list(principal);
    const persons = buildAuthorizedHourglassIndex(people);
    json(response, 200, { persons });
  });
};

export default handler;

import { requireCapability, resolvePrincipal } from '../../../_auth';
import { BadRequestError, runEndpoint } from '../../../_endpoint';
import { json, methodNotAllowed, queryValue, type ApiHandler } from '../../../_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'access.manage');
    const raw = queryValue(request, 'subjectId');
    const subjectId = raw?.trim();
    if (!subjectId || subjectId.length > 200 || /[(),]/.test(subjectId)) throw new BadRequestError('Invalid subjectId');
    const grants = await database.grantsForSubject(principal.tenantId, subjectId);
    json(response, 200, grants.map(grant => ({
      id: grant.id,
      subjectId: grant.subject_id,
      capability: grant.capability,
      grantedAt: grant.granted_at,
      ...(grant.revoked_at ? { revokedAt: grant.revoked_at } : {}),
    })));
  });
};
export default handler;

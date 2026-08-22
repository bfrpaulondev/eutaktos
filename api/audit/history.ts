import { requireCapability, resolvePrincipal } from '../_auth';
import { BadRequestError, runEndpoint } from '../_endpoint';
import { json, methodNotAllowed, queryValue, type ApiHandler } from '../_types';

const RESOURCE_TYPES = new Set([
  'person','household','service-group','responsibility','delegation','congregation','eligibility','availability',
  'emergency-contact','access-grant','midweek-meeting','student-assignment','non-student-assignment','weekend-meeting','public-talk-assignment',
]);
const ACTIONS = new Set(['create','update','delete','grant','revoke']);

function optionalIdentifier(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[(),]/.test(normalized)) throw new BadRequestError(`Invalid ${field}`);
  return normalized;
}
function iso(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(Date.parse(value))) throw new BadRequestError(`Invalid ${field}`);
  return new Date(value).toISOString();
}
function limit(value: string | undefined): number {
  if (value === undefined) return 100;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) throw new BadRequestError('Invalid limit');
  return parsed;
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'audit.read');

    const resourceType = queryValue(request, 'resourceType');
    const action = queryValue(request, 'action');
    if (resourceType !== undefined && !RESOURCE_TYPES.has(resourceType)) throw new BadRequestError('Invalid resourceType');
    if (action !== undefined && !ACTIONS.has(action)) throw new BadRequestError('Invalid action');

    const rows = await database.audit({
      tenantId: principal.tenantId,
      ...(resourceType ? { resourceType } : {}),
      ...(action ? { action } : {}),
      ...(optionalIdentifier(queryValue(request, 'resourceId'), 'resourceId') ? { resourceId: optionalIdentifier(queryValue(request, 'resourceId'), 'resourceId') } : {}),
      ...(optionalIdentifier(queryValue(request, 'actorId'), 'actorId') ? { actorId: optionalIdentifier(queryValue(request, 'actorId'), 'actorId') } : {}),
      ...(iso(queryValue(request, 'from'), 'from') ? { from: iso(queryValue(request, 'from'), 'from') } : {}),
      ...(iso(queryValue(request, 'to'), 'to') ? { to: iso(queryValue(request, 'to'), 'to') } : {}),
      limit: limit(queryValue(request, 'limit')),
    });

    json(response, 200, rows.map(row => ({
      id: row.id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      action: row.action,
      actorId: row.actor_id,
      occurredAt: row.occurred_at,
      changedFields: row.changed_fields,
    })));
  });
};
export default handler;

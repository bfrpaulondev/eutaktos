import { requireCapability, resolvePrincipal } from '../_auth';
import { BadRequestError, runEndpoint } from '../_endpoint';
import { PeopleMapDatabase, type PeopleMapPoint } from '../_people-map-db';
import { json, methodNotAllowed, type ApiHandler } from '../_types';

export function projectPeopleMap(points: readonly PeopleMapPoint[]) {
  return Object.freeze({
    contractVersion: 'people-map-v1' as const,
    points: Object.freeze([...points]
      .map(point => Object.freeze({ personId: point.personId, displayName: point.displayName, latitude: point.latitude, longitude: point.longitude }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.personId.localeCompare(right.personId))),
  });
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    if (Object.keys(request.query).length) throw new BadRequestError('People map does not accept query parameters');
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'map.read');
    const points = await new PeopleMapDatabase().list(principal.tenantId);
    json(response, 200, projectPeopleMap(points));
  });
};

export default handler;

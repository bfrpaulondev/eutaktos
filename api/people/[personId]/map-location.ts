import { createAccessContext, createPeopleMapLocation, isPersonPublicationArchived } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal, type VerifiedPrincipal } from '../../_auth';
import { assertTrustedMutation, BadRequestError, exactKeys, requestBody, runEndpoint } from '../../_endpoint';
import { PeopleMapDatabase } from '../../_people-map-db';
import { PeopleSnapshotUnitOfWork } from '../../_uow';
import { json, methodNotAllowed, queryValue, type ApiHandler } from '../../_types';

export function requirePeopleMapWrite(principal: VerifiedPrincipal): void {
  requireCapability(principal, 'people.write');
  requireCapability(principal, 'map.write');
}

export function parsePeopleMapLocationBody(value: unknown): Readonly<{ latitude: number; longitude: number }> {
  const body = requestBody(value);
  exactKeys(body, ['latitude', 'longitude']);
  const latitude = body.latitude;
  const longitude = body.longitude;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)) throw new BadRequestError('latitude must be a finite number');
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) throw new BadRequestError('longitude must be a finite number');
  if (latitude < -90 || latitude > 90) throw new BadRequestError('latitude is invalid');
  if (longitude < -180 || longitude > 180) throw new BadRequestError('longitude is invalid');
  return Object.freeze({ latitude, longitude });
}

function mapLocationMutationResponse(changed: boolean, location: Readonly<{ latitude: number; longitude: number }> | null) {
  return Object.freeze({
    contractVersion: 'people-map-location-v1' as const,
    changed,
    location: location ? Object.freeze({ latitude: location.latitude, longitude: location.longitude }) : null,
  });
}

const handler: ApiHandler = async (request, response) => {
  if (!['PUT', 'DELETE'].includes(request.method ?? '')) {
    methodNotAllowed(response, ['PUT', 'DELETE']);
    return;
  }

  await runEndpoint(request, response, async database => {
    if (Object.keys(request.query).some(key => key !== 'personId')) {
      throw new BadRequestError('People map location does not accept query parameters');
    }

    const principal = await resolvePrincipal(request, database);
    requirePeopleMapWrite(principal);
    assertTrustedMutation(request);

    const personId = queryValue(request, 'personId')?.trim();
    if (!personId || personId.length > 200) throw new BadRequestError('Invalid personId');

    const rows = await database.entities(principal.tenantId, 'person');
    const context = createAccessContext({
      tenantId: principal.tenantId,
      actorId: principal.actorId,
      capabilities: principal.capabilities,
    });
    const people = new PeopleSnapshotUnitOfWork(principal.tenantId, rows);
    const person = people.findById(context, personId);
    if (!person) {
      json(response, 404, { error: 'Person not found' });
      return;
    }

    const mapDatabase = new PeopleMapDatabase();
    if (request.method === 'DELETE') {
      const changed = await mapDatabase.remove({
        tenantId: principal.tenantId,
        personId,
        actorId: principal.actorId,
        removedAt: new Date().toISOString(),
      });
      json(response, 200, mapLocationMutationResponse(changed, null));
      return;
    }

    if (!person.active || isPersonPublicationArchived(person)) {
      throw new BadRequestError('Person is not publishable');
    }

    const input = parsePeopleMapLocationBody(request.body);
    const normalized = createPeopleMapLocation({
      tenantId: principal.tenantId,
      personId,
      latitude: input.latitude,
      longitude: input.longitude,
      updatedAt: new Date().toISOString(),
    });
    const result = await mapDatabase.set({
      tenantId: normalized.tenantId,
      personId: normalized.personId,
      actorId: principal.actorId,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      updatedAt: normalized.updatedAt,
    });
    json(response, 200, mapLocationMutationResponse(result.changed, result));
  });
};

export default handler;

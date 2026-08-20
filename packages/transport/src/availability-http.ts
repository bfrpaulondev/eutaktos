import {
  createAccessContext,
  type AccessContext,
  type AvailabilityPeriod,
  type AvailabilityPeriodId,
  type PersonId,
} from '@eutaktos/domain';
import type {
  AddUnavailabilityInput,
  AvailabilityService,
  RequestMetadata,
} from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface AvailabilityPeriodDto {
  id: AvailabilityPeriodId;
  startsAt: string;
  endsAt: string;
  reasonCode?: AvailabilityPeriod['reasonCode'];
}

export interface AvailabilityPort {
  list(context: AccessContext, personId: PersonId): readonly AvailabilityPeriod[];
  addUnavailability(
    context: AccessContext,
    input: AddUnavailabilityInput,
    metadata?: RequestMetadata,
  ): unknown;
  removeUnavailability(
    context: AccessContext,
    input: { personId: PersonId; availabilityPeriodId: AvailabilityPeriodId },
    metadata?: RequestMetadata,
  ): unknown;
}

export type AvailabilityApplication = Pick<AvailabilityService, 'list' | 'addUnavailability' | 'removeUnavailability'>;

function unauthorized(): TransportResponse<{ error: string }> {
  return { status: 401, body: { error: 'Unauthorized' } };
}

function toContext(principal: VerifiedPrincipal | undefined): Readonly<AccessContext> | undefined {
  if (!principal) return undefined;
  return createAccessContext({
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    capabilities: principal.capabilities,
  });
}

function metadata(request: TransportRequest): RequestMetadata {
  return request.correlationId ? { correlationId: request.correlationId } : {};
}

function requiredParam(request: TransportRequest, key: string): string | undefined {
  const value = request.params?.[key]?.trim();
  return value || undefined;
}

function objectBody(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Request body must be an object');
  }
  return value as Readonly<Record<string, unknown>>;
}

function rejectUnknownKeys(body: Readonly<Record<string, unknown>>, allowed: readonly string[]): void {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(body).filter(key => !allowedKeys.has(key));
  if (unknown.length > 0) throw new Error(`Unknown request fields: ${unknown.sort().join(', ')}`);
}

function requiredString(body: Readonly<Record<string, unknown>>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function optionalReasonCode(body: Readonly<Record<string, unknown>>): AvailabilityPeriod['reasonCode'] | undefined {
  const value = body.reasonCode;
  if (value === undefined) return undefined;
  if (value !== 'away' && value !== 'unavailable' && value !== 'other') {
    throw new Error('reasonCode must be away, unavailable or other');
  }
  return value;
}

function parseCreateBody(personId: PersonId, value: unknown): AddUnavailabilityInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['startsAt', 'endsAt', 'reasonCode']);
  const reasonCode = optionalReasonCode(body);
  return {
    personId,
    startsAt: requiredString(body, 'startsAt'),
    endsAt: requiredString(body, 'endsAt'),
    ...(reasonCode ? { reasonCode } : {}),
  };
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Person not found') return { status: 404, body: { error: 'Person not found' } };
  if (message === 'Unavailability period not found') return { status: 404, body: { error: 'Unavailability period not found' } };
  if (
    message.includes('must be') ||
    message.includes('is required') ||
    message.includes('Invalid ISO date') ||
    message.includes('must end after') ||
    message.startsWith('Unknown request fields:')
  ) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

export function toAvailabilityPeriodDto(period: AvailabilityPeriod): AvailabilityPeriodDto {
  if (!period.id) throw new Error('Availability period id is required');
  return {
    id: period.id,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    ...(period.reasonCode ? { reasonCode: period.reasonCode } : {}),
  };
}

/**
 * Away/availability data is exposed only through this capability-scoped boundary.
 * The general People Directory deliberately omits it.
 */
export class AvailabilityHttpTransport {
  readonly #availability: AvailabilityPort;

  constructor(availability: AvailabilityPort) {
    this.#availability = availability;
  }

  list(request: TransportRequest): TransportResponse<readonly AvailabilityPeriodDto[] | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const personId = requiredParam(request, 'personId');
    if (!personId) return { status: 400, body: { error: 'personId is required' } };
    try {
      return {
        status: 200,
        body: this.#availability.list(context, personId).map(toAvailabilityPeriodDto),
      };
    } catch (error) {
      return safeError(error);
    }
  }

  create(request: TransportRequest): TransportResponse<AvailabilityPeriodDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const personId = requiredParam(request, 'personId');
    if (!personId) return { status: 400, body: { error: 'personId is required' } };
    try {
      const input = parseCreateBody(personId, request.body);
      const updated = this.#availability.addUnavailability(context, input, metadata(request)) as {
        availability: readonly AvailabilityPeriod[];
      };
      const created = updated.availability[updated.availability.length - 1];
      if (!created) throw new Error('Availability period was not created');
      return { status: 201, body: toAvailabilityPeriodDto(created) };
    } catch (error) {
      return safeError(error);
    }
  }

  remove(request: TransportRequest): TransportResponse<null | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const personId = requiredParam(request, 'personId');
    const availabilityPeriodId = requiredParam(request, 'availabilityPeriodId');
    if (!personId) return { status: 400, body: { error: 'personId is required' } };
    if (!availabilityPeriodId) {
      return { status: 400, body: { error: 'availabilityPeriodId is required' } };
    }
    try {
      this.#availability.removeUnavailability(
        context,
        { personId, availabilityPeriodId },
        metadata(request),
      );
      return { status: 204, body: null };
    } catch (error) {
      return safeError(error);
    }
  }
}

import {
  createAccessContext,
  type AccessContext,
  type Capability,
  type ResponsibilityAssignment,
  type ResponsibilityId,
} from '@eutaktos/domain';
import type {
  AssignResponsibilityInput,
  EndResponsibilityInput,
  RequestMetadata,
} from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface ResponsibilityDto {
  id: string;
  personId: string;
  responsibilityKey: string;
  startsAt: string;
  endsAt?: string;
}

export interface ResponsibilityPort {
  listResponsibilities(context: AccessContext): readonly ResponsibilityAssignment[];
  getResponsibility(context: AccessContext, id: ResponsibilityId): ResponsibilityAssignment | undefined;
  assignResponsibility(context: AccessContext, input: AssignResponsibilityInput, metadata?: RequestMetadata): ResponsibilityAssignment;
  endResponsibility(context: AccessContext, input: EndResponsibilityInput, metadata?: RequestMetadata): ResponsibilityAssignment;
}

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

export function toResponsibilityDto(r: ResponsibilityAssignment): ResponsibilityDto {
  return {
    id: r.id,
    personId: r.personId,
    responsibilityKey: r.responsibilityKey,
    startsAt: r.startsAt,
    ...(r.endsAt ? { endsAt: r.endsAt } : {}),
  };
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

function optionalString(body: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function parseAssignBody(value: unknown): Omit<AssignResponsibilityInput, 'id'> {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['personId', 'responsibilityKey', 'startsAt', 'endsAt']);
  const endsAt = optionalString(body, 'endsAt');
  return {
    personId: requiredString(body, 'personId'),
    responsibilityKey: requiredString(body, 'responsibilityKey'),
    startsAt: requiredString(body, 'startsAt'),
    ...(endsAt !== undefined ? { endsAt } : {}),
  };
}

function parseEndBody(value: unknown): { endsAt: string } {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['endsAt']);
  return { endsAt: requiredString(body, 'endsAt') };
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Responsibility not found') return { status: 404, body: { error: 'Responsibility not found' } };
  if (
    message.includes('must be') ||
    message.includes('is required') ||
    message.includes('too long') ||
    message.startsWith('Unknown request fields:') ||
    message.includes('Invalid ISO date') ||
    message.includes('must end after')
  ) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

export class ResponsibilityHttpTransport {
  readonly #responsibilities: ResponsibilityPort;

  constructor(responsibilities: ResponsibilityPort) {
    this.#responsibilities = responsibilities;
  }

  list(request: TransportRequest): TransportResponse<readonly ResponsibilityDto[] | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    try {
      return {
        status: 200,
        body: this.#responsibilities.listResponsibilities(context).map(toResponsibilityDto),
      };
    } catch (error) {
      return safeError(error);
    }
  }

  get(request: TransportRequest): TransportResponse<ResponsibilityDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const responsibilityId = request.params?.responsibilityId?.trim();
    if (!responsibilityId) return { status: 400, body: { error: 'responsibilityId is required' } };
    try {
      const r = this.#responsibilities.getResponsibility(context, responsibilityId);
      return r
        ? { status: 200, body: toResponsibilityDto(r) }
        : { status: 404, body: { error: 'Responsibility not found' } };
    } catch (error) {
      return safeError(error);
    }
  }

  assign(request: TransportRequest): TransportResponse<ResponsibilityDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    try {
      const parsed = parseAssignBody(request.body);
      const id = crypto.randomUUID();
      const r = this.#responsibilities.assignResponsibility(
        context,
        { id, ...parsed },
        metadata(request),
      );
      return { status: 201, body: toResponsibilityDto(r) };
    } catch (error) {
      return safeError(error);
    }
  }

  end(request: TransportRequest): TransportResponse<ResponsibilityDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const responsibilityId = request.params?.responsibilityId?.trim();
    if (!responsibilityId) return { status: 400, body: { error: 'responsibilityId is required' } };
    try {
      const { endsAt } = parseEndBody(request.body);
      const r = this.#responsibilities.endResponsibility(
        context,
        { id: responsibilityId, endsAt },
        metadata(request),
      );
      return { status: 200, body: toResponsibilityDto(r) };
    } catch (error) {
      return safeError(error);
    }
  }
}

import {
  createAccessContext,
  type AccessContext,
  type Capability,
  type PersonId,
} from '@eutaktos/domain';
import type { RequestMetadata, UpdatePersonProfileInput } from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface OrdinaryContactDto {
  readonly phone?: string;
  readonly email?: string;
  readonly address?: string;
}

export interface OrdinaryContactPort {
  get(context: AccessContext, personId: PersonId): { id: PersonId; ordinaryContact?: OrdinaryContactDto } | undefined;
  updateProfile(context: AccessContext, input: UpdatePersonProfileInput, metadata?: RequestMetadata): unknown;
}

function toContext(principal: VerifiedPrincipal | undefined): Readonly<AccessContext> | undefined {
  if (!principal) return undefined;
  return createAccessContext({
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    capabilities: principal.capabilities as readonly Capability[],
  });
}

function metadata(request: TransportRequest): RequestMetadata {
  return request.correlationId ? { correlationId: request.correlationId } : {};
}

function unauthorized(): TransportResponse<{ error: string }> {
  return { status: 401, body: { error: 'Unauthorized' } };
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Person not found') return { status: 404, body: { error: 'Person not found' } };
  if (message.includes('must be') || message.includes('is required') || message.includes('too long') || message.includes('is invalid') || message.startsWith('Unknown request fields:')) return { status: 400, body: { error: message } };
  return { status: 500, body: { error: 'Internal server error' } };
}

function objectBody(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be an object');
  return value as Readonly<Record<string, unknown>>;
}

function optionalNullableString(body: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string or null`);
  return value;
}

function parseContact(value: unknown): OrdinaryContactDto {
  const body = objectBody(value);
  const unknown = Object.keys(body).filter(key => !['phone', 'email', 'address'].includes(key));
  if (unknown.length) throw new Error(`Unknown request fields: ${unknown.sort().join(', ')}`);
  const phone = optionalNullableString(body, 'phone');
  const email = optionalNullableString(body, 'email');
  const address = optionalNullableString(body, 'address');
  return Object.freeze({ ...(phone !== undefined ? { phone } : {}), ...(email !== undefined ? { email } : {}), ...(address !== undefined ? { address } : {}) });
}

function toDto(person: { ordinaryContact?: OrdinaryContactDto }): OrdinaryContactDto {
  const contact = person.ordinaryContact;
  return Object.freeze({
    ...(contact?.phone ? { phone: contact.phone } : {}),
    ...(contact?.email ? { email: contact.email } : {}),
    ...(contact?.address ? { address: contact.address } : {}),
  });
}

/**
 * Ordinary profile contacts remain a dedicated, capability-checked projection.
 * They are deliberately excluded from general directory and base person DTOs.
 */
export class OrdinaryContactHttpTransport {
  readonly #people: OrdinaryContactPort;

  constructor(people: OrdinaryContactPort) {
    this.#people = people;
  }

  get(request: TransportRequest): TransportResponse<OrdinaryContactDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const personId = request.params?.personId?.trim();
    if (!personId) return { status: 400, body: { error: 'personId is required' } };
    try {
      const person = this.#people.get(context, personId);
      return person ? { status: 200, body: toDto(person) } : { status: 404, body: { error: 'Person not found' } };
    } catch (error) {
      return safeError(error);
    }
  }

  update(request: TransportRequest): TransportResponse<OrdinaryContactDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const personId = request.params?.personId?.trim();
    if (!personId) return { status: 400, body: { error: 'personId is required' } };
    try {
      const ordinaryContact = parseContact(request.body);
      const updated = this.#people.updateProfile(context, { personId, ordinaryContact }, metadata(request)) as { ordinaryContact?: OrdinaryContactDto };
      return { status: 200, body: toDto(updated) };
    } catch (error) {
      return safeError(error);
    }
  }
}

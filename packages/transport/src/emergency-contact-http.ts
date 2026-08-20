import {
  createAccessContext,
  type AccessContext,
  type EmergencyContact,
  type EmergencyContactId,
  type PersonId,
} from '@eutaktos/domain';
import type {
  EmergencyContactService,
  RequestMetadata,
  UpsertEmergencyContactInput,
} from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface EmergencyContactDto {
  id: EmergencyContactId;
  name: string;
  phone: string;
  relationship?: string;
}

export interface EmergencyContactPort {
  list(context: AccessContext, personId: PersonId): readonly EmergencyContact[];
  upsert(
    context: AccessContext,
    input: UpsertEmergencyContactInput,
    metadata?: RequestMetadata,
  ): EmergencyContact;
  remove(
    context: AccessContext,
    personId: PersonId,
    contactId: EmergencyContactId,
    metadata?: RequestMetadata,
  ): void;
}

export type EmergencyContactApplication = Pick<EmergencyContactService, 'list' | 'upsert' | 'remove'>;

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

function optionalNullableString(
  body: Readonly<Record<string, unknown>>,
  key: string,
): string | null | undefined {
  const value = body[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw new Error(`${key} must be a string or null`);
  return value;
}

function parseUpsertBody(personId: PersonId, contactId: EmergencyContactId | undefined, value: unknown): UpsertEmergencyContactInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['name', 'phone', 'relationship']);
  const relationship = optionalNullableString(body, 'relationship');
  return {
    personId,
    ...(contactId ? { contactId } : {}),
    name: requiredString(body, 'name'),
    phone: requiredString(body, 'phone'),
    ...(relationship !== undefined ? { relationship } : {}),
  };
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Person not found') return { status: 404, body: { error: 'Person not found' } };
  if (message === 'Emergency contact not found') return { status: 404, body: { error: 'Emergency contact not found' } };
  if (
    message.includes('must be') ||
    message.includes('is required') ||
    message.includes('too long') ||
    message.startsWith('Unknown request fields:')
  ) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

export function toEmergencyContactDto(contact: EmergencyContact): EmergencyContactDto {
  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    ...(contact.relationship ? { relationship: contact.relationship } : {}),
  };
}

/**
 * Emergency contacts are intentionally exposed through a separate capability-scoped
 * boundary. They must never be serialized by the general People Directory endpoint.
 */
export class EmergencyContactHttpTransport {
  readonly #contacts: EmergencyContactPort;

  constructor(contacts: EmergencyContactPort) {
    this.#contacts = contacts;
  }

  list(request: TransportRequest): TransportResponse<readonly EmergencyContactDto[] | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const personId = requiredParam(request, 'personId');
    if (!personId) return { status: 400, body: { error: 'personId is required' } };
    try {
      return { status: 200, body: this.#contacts.list(context, personId).map(toEmergencyContactDto) };
    } catch (error) {
      return safeError(error);
    }
  }

  create(request: TransportRequest): TransportResponse<EmergencyContactDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const personId = requiredParam(request, 'personId');
    if (!personId) return { status: 400, body: { error: 'personId is required' } };
    try {
      const contact = this.#contacts.upsert(context, parseUpsertBody(personId, undefined, request.body), metadata(request));
      return { status: 201, body: toEmergencyContactDto(contact) };
    } catch (error) {
      return safeError(error);
    }
  }

  update(request: TransportRequest): TransportResponse<EmergencyContactDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const personId = requiredParam(request, 'personId');
    const contactId = requiredParam(request, 'contactId');
    if (!personId) return { status: 400, body: { error: 'personId is required' } };
    if (!contactId) return { status: 400, body: { error: 'contactId is required' } };
    try {
      const contact = this.#contacts.upsert(context, parseUpsertBody(personId, contactId, request.body), metadata(request));
      return { status: 200, body: toEmergencyContactDto(contact) };
    } catch (error) {
      return safeError(error);
    }
  }

  remove(request: TransportRequest): TransportResponse<null | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const personId = requiredParam(request, 'personId');
    const contactId = requiredParam(request, 'contactId');
    if (!personId) return { status: 400, body: { error: 'personId is required' } };
    if (!contactId) return { status: 400, body: { error: 'contactId is required' } };
    try {
      this.#contacts.remove(context, personId, contactId, metadata(request));
      return { status: 204, body: null };
    } catch (error) {
      return safeError(error);
    }
  }
}

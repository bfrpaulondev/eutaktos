import {
  createAccessContext,
  type AccessContext,
  type Capability,
  type CongregationPerson,
  type PersonContactDetails,
  type PersonId,
} from '@eutaktos/domain';
import type { CreatePersonInput, PeopleDirectoryService, RequestMetadata, UpdatePersonProfileInput } from '@eutaktos/application';

export interface VerifiedPrincipal { tenantId: string; actorId: PersonId; capabilities: readonly Capability[]; }
export interface TransportRequest<TBody = unknown> { principal?: VerifiedPrincipal; params?: Readonly<Record<string, string | undefined>>; body?: TBody; correlationId?: string; }
export interface TransportResponse<TBody = unknown> { status: number; body: TBody; }
export interface PersonProfileDto { id: PersonId; displayName: string; preferredLocale?: string; active: boolean; }
export interface PersonDetailDto extends PersonProfileDto { contact?: Readonly<PersonContactDetails>; }

export interface PeopleDirectoryPort {
  list(context: AccessContext): readonly CongregationPerson[];
  get(context: AccessContext, personId: PersonId): CongregationPerson | undefined;
  create(context: AccessContext, input: CreatePersonInput, metadata?: RequestMetadata): CongregationPerson;
  updateProfile(context: AccessContext, input: UpdatePersonProfileInput, metadata?: RequestMetadata): CongregationPerson;
}
export type PeopleDirectoryApplication = Pick<PeopleDirectoryService, 'list' | 'get' | 'create' | 'updateProfile'>;

function unauthorized(): TransportResponse<{ error: string }> { return { status: 401, body: { error: 'Unauthorized' } }; }
function toContext(principal: VerifiedPrincipal | undefined): Readonly<AccessContext> | undefined { return principal ? createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities }) : undefined; }
function metadata(request: TransportRequest): RequestMetadata { return request.correlationId ? { correlationId: request.correlationId } : {}; }

/** Directory/list responses intentionally remain contact-free. */
export function toPersonProfileDto(person: CongregationPerson): PersonProfileDto {
  return { id: person.id, displayName: person.displayName, ...(person.preferredLocale ? { preferredLocale: person.preferredLocale } : {}), active: person.active };
}
export function toPersonDetailDto(person: CongregationPerson): PersonDetailDto {
  return { ...toPersonProfileDto(person), ...(person.contact ? { contact: person.contact } : {}) };
}

function objectBody(value: unknown): Readonly<Record<string, unknown>> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be an object'); return value as Readonly<Record<string, unknown>>; }
function rejectUnknownKeys(body: Readonly<Record<string, unknown>>, allowed: readonly string[]): void { const allowedKeys = new Set(allowed); const unknown = Object.keys(body).filter(key => !allowedKeys.has(key)); if (unknown.length) throw new Error(`Unknown request fields: ${unknown.sort().join(', ')}`); }
function optionalString(body: Readonly<Record<string, unknown>>, key: string): string | undefined { const value = body[key]; if (value === undefined) return undefined; if (typeof value !== 'string') throw new Error(`${key} must be a string`); return value; }
function optionalNullableString(body: Readonly<Record<string, unknown>>, key: string): string | null | undefined { const value = body[key]; if (value === undefined || value === null) return value; if (typeof value !== 'string') throw new Error(`${key} must be a string or null`); return value; }
function optionalBoolean(body: Readonly<Record<string, unknown>>, key: string): boolean | undefined { const value = body[key]; if (value === undefined) return undefined; if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean`); return value; }

function parseAddress(value: unknown): PersonContactDetails['address'] {
  if (value === undefined) return undefined;
  const body = objectBody(value); rejectUnknownKeys(body, ['line1', 'line2', 'postalCode', 'locality', 'countryCode']);
  return { ...(optionalString(body, 'line1') !== undefined ? { line1: optionalString(body, 'line1') } : {}), ...(optionalString(body, 'line2') !== undefined ? { line2: optionalString(body, 'line2') } : {}), ...(optionalString(body, 'postalCode') !== undefined ? { postalCode: optionalString(body, 'postalCode') } : {}), ...(optionalString(body, 'locality') !== undefined ? { locality: optionalString(body, 'locality') } : {}), ...(optionalString(body, 'countryCode') !== undefined ? { countryCode: optionalString(body, 'countryCode') } : {}) };
}
function parseContact(value: unknown): PersonContactDetails | null | undefined {
  if (value === undefined || value === null) return value;
  const body = objectBody(value); rejectUnknownKeys(body, ['phone', 'email', 'address']);
  const phone = optionalString(body, 'phone'); const email = optionalString(body, 'email'); const address = parseAddress(body.address);
  return { ...(phone !== undefined ? { phone } : {}), ...(email !== undefined ? { email } : {}), ...(address !== undefined ? { address } : {}) };
}
function parseCreatePersonBody(value: unknown): CreatePersonInput {
  const body = objectBody(value); rejectUnknownKeys(body, ['displayName', 'preferredLocale', 'active', 'contact']);
  const displayName = body.displayName; if (typeof displayName !== 'string') throw new Error('displayName must be a string');
  const preferredLocale = optionalString(body, 'preferredLocale'); const active = optionalBoolean(body, 'active'); const contact = parseContact(body.contact);
  return { displayName, ...(preferredLocale !== undefined ? { preferredLocale } : {}), ...(active !== undefined ? { active } : {}), ...(contact ? { contact } : {}) };
}
function parseUpdatePersonBody(personId: string, value: unknown): UpdatePersonProfileInput {
  const body = objectBody(value); rejectUnknownKeys(body, ['displayName', 'preferredLocale', 'active', 'contact']);
  const displayName = optionalString(body, 'displayName'); const preferredLocale = optionalNullableString(body, 'preferredLocale'); const active = optionalBoolean(body, 'active'); const contact = parseContact(body.contact);
  return { personId, ...(displayName !== undefined ? { displayName } : {}), ...(preferredLocale !== undefined ? { preferredLocale } : {}), ...(active !== undefined ? { active } : {}), ...(contact !== undefined ? { contact } : {}) };
}
function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Person not found') return { status: 404, body: { error: 'Person not found' } };
  if (message.includes('must be') || message.includes('is required') || message.includes('too long') || message.includes('control characters') || message.startsWith('Unknown request fields:')) return { status: 400, body: { error: message } };
  return { status: 500, body: { error: 'Internal server error' } };
}

export class PeopleHttpTransport {
  readonly #people: PeopleDirectoryPort;
  constructor(people: PeopleDirectoryPort) { this.#people = people; }
  list(request: TransportRequest): TransportResponse<readonly PersonProfileDto[] | { error: string }> { const context = toContext(request.principal); if (!context) return unauthorized(); try { return { status: 200, body: this.#people.list(context).map(toPersonProfileDto) }; } catch (error) { return safeError(error); } }
  get(request: TransportRequest): TransportResponse<PersonDetailDto | { error: string }> { const context = toContext(request.principal); if (!context) return unauthorized(); const personId = request.params?.personId?.trim(); if (!personId) return { status: 400, body: { error: 'personId is required' } }; try { const person = this.#people.get(context, personId); return person ? { status: 200, body: toPersonDetailDto(person) } : { status: 404, body: { error: 'Person not found' } }; } catch (error) { return safeError(error); } }
  create(request: TransportRequest): TransportResponse<PersonDetailDto | { error: string }> { const context = toContext(request.principal); if (!context) return unauthorized(); try { const person = this.#people.create(context, parseCreatePersonBody(request.body), metadata(request)); return { status: 201, body: toPersonDetailDto(person) }; } catch (error) { return safeError(error); } }
  update(request: TransportRequest): TransportResponse<PersonDetailDto | { error: string }> { const context = toContext(request.principal); if (!context) return unauthorized(); const personId = request.params?.personId?.trim(); if (!personId) return { status: 400, body: { error: 'personId is required' } }; try { const person = this.#people.updateProfile(context, parseUpdatePersonBody(personId, request.body), metadata(request)); return { status: 200, body: toPersonDetailDto(person) }; } catch (error) { return safeError(error); } }
}

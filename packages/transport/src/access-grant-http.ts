import {
  createAccessContext,
  isCapability,
  type AccessContext,
  type AccessGrant,
  type Capability,
} from '@eutaktos/domain';
import type { GrantCapabilityInput, RequestMetadata } from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface AccessGrantDto {
  id: string;
  subjectId: string;
  capability: Capability;
  grantedAt: string;
  revokedAt?: string;
}

export interface AccessGrantPort {
  listBySubject(context: AccessContext, subjectId: string): readonly Readonly<AccessGrant>[];
  grant(context: AccessContext, input: GrantCapabilityInput, metadata?: RequestMetadata): Readonly<AccessGrant>;
  revoke(context: AccessContext, grantId: string, metadata?: RequestMetadata): Readonly<AccessGrant>;
}

function toContext(principal: VerifiedPrincipal | undefined): Readonly<AccessContext> | undefined {
  if (!principal) return undefined;
  return createAccessContext({
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    capabilities: principal.capabilities,
  });
}

function objectBody(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be an object');
  return value as Readonly<Record<string, unknown>>;
}

function rejectUnknownKeys(body: Readonly<Record<string, unknown>>, allowed: readonly string[]): void {
  const known = new Set(allowed);
  const unknown = Object.keys(body).filter(key => !known.has(key));
  if (unknown.length) throw new Error(`Unknown request fields: ${unknown.sort().join(', ')}`);
}

function requiredString(body: Readonly<Record<string, unknown>>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function parseGrant(value: unknown): GrantCapabilityInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['subjectId', 'capability']);
  const capability = body.capability;
  if (!isCapability(capability)) throw new Error('Unsupported capability');
  return { subjectId: requiredString(body, 'subjectId'), capability };
}

function assertEmptyBody(value: unknown): void {
  if (value === undefined) return;
  const body = objectBody(value);
  rejectUnknownKeys(body, []);
}

function metadata(request: TransportRequest): RequestMetadata {
  return request.correlationId ? { correlationId: request.correlationId } : {};
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Access grant not found') return { status: 404, body: { error: 'Access grant not found' } };
  if (
    message.includes('must be') || message.includes('is required') || message.includes('is too long') ||
    message === 'Unsupported capability' || message.startsWith('Unknown request fields:')
  ) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

export function toAccessGrantDto(grant: AccessGrant): AccessGrantDto {
  return {
    id: grant.id,
    subjectId: grant.subjectId,
    capability: grant.capability,
    grantedAt: grant.grantedAt,
    ...(grant.revokedAt ? { revokedAt: grant.revokedAt } : {}),
  };
}

export class AccessGrantHttpTransport {
  readonly #grants: AccessGrantPort;

  constructor(grants: AccessGrantPort) {
    this.#grants = grants;
  }

  listBySubject(request: TransportRequest): TransportResponse<readonly AccessGrantDto[] | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return { status: 401, body: { error: 'Unauthorized' } };
    const subjectId = request.params?.subjectId?.trim();
    if (!subjectId) return { status: 400, body: { error: 'subjectId is required' } };
    try {
      assertEmptyBody(request.body);
      return { status: 200, body: this.#grants.listBySubject(context, subjectId).map(toAccessGrantDto) };
    } catch (error) {
      return safeError(error);
    }
  }

  grant(request: TransportRequest): TransportResponse<AccessGrantDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return { status: 401, body: { error: 'Unauthorized' } };
    try {
      const grant = this.#grants.grant(context, parseGrant(request.body), metadata(request));
      return { status: 201, body: toAccessGrantDto(grant) };
    } catch (error) {
      return safeError(error);
    }
  }

  revoke(request: TransportRequest): TransportResponse<AccessGrantDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return { status: 401, body: { error: 'Unauthorized' } };
    const grantId = request.params?.grantId?.trim();
    if (!grantId) return { status: 400, body: { error: 'grantId is required' } };
    try {
      assertEmptyBody(request.body);
      return { status: 200, body: toAccessGrantDto(this.#grants.revoke(context, grantId, metadata(request))) };
    } catch (error) {
      return safeError(error);
    }
  }
}

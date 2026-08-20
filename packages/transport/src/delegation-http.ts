import {
  createAccessContext,
  DELEGATED_SCOPES,
  type AccessContext,
  type DelegatedScope,
} from '@eutaktos/domain';
import type {
  DelegationRecord,
  GrantDelegationInput,
  RequestMetadata,
} from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface DelegationDto {
  id: string;
  grantorId: string;
  delegateId: string;
  scopes: readonly DelegatedScope[];
  startsAt: string;
  endsAt?: string;
  grantedAt: string;
  revokedAt?: string;
}

export interface DelegationPort {
  list(context: AccessContext): readonly DelegationRecord[];
  grant(context: AccessContext, input: GrantDelegationInput, metadata?: RequestMetadata): DelegationRecord;
  revoke(context: AccessContext, delegationId: string, metadata?: RequestMetadata): DelegationRecord;
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

function optionalString(body: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function parseScopes(value: unknown): readonly DelegatedScope[] {
  if (!Array.isArray(value) || value.some(scope => typeof scope !== 'string')) {
    throw new Error('scopes must be an array of strings');
  }
  const allowed = new Set<string>(DELEGATED_SCOPES);
  for (const scope of value) {
    if (!allowed.has(scope)) throw new Error(`Unsupported delegation scope: ${scope}`);
  }
  return value as DelegatedScope[];
}

function parseGrant(value: unknown): GrantDelegationInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['grantorId', 'delegateId', 'scopes', 'startsAt', 'endsAt']);
  const endsAt = optionalString(body, 'endsAt');
  return {
    grantorId: requiredString(body, 'grantorId'),
    delegateId: requiredString(body, 'delegateId'),
    scopes: parseScopes(body.scopes),
    startsAt: requiredString(body, 'startsAt'),
    ...(endsAt !== undefined ? { endsAt } : {}),
  };
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
  if (message === 'Delegation not found') return { status: 404, body: { error: 'Delegation not found' } };
  if (
    message.includes('must be') ||
    message.includes('is required') ||
    message.includes('cannot be') ||
    message.includes('must end') ||
    message.includes('Unsupported delegation scope') ||
    message.startsWith('Invalid ISO date:') ||
    message.startsWith('Unknown request fields:')
  ) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

export function toDelegationDto(value: DelegationRecord): DelegationDto {
  return {
    id: value.id,
    grantorId: value.grantorId,
    delegateId: value.delegateId,
    scopes: [...value.scopes],
    startsAt: value.startsAt,
    ...(value.endsAt ? { endsAt: value.endsAt } : {}),
    grantedAt: value.grantedAt,
    ...(value.revokedAt ? { revokedAt: value.revokedAt } : {}),
  };
}

export class DelegationHttpTransport {
  readonly #delegations: DelegationPort;

  constructor(delegations: DelegationPort) {
    this.#delegations = delegations;
  }

  list(request: TransportRequest): TransportResponse<readonly DelegationDto[] | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return { status: 401, body: { error: 'Unauthorized' } };
    try {
      return { status: 200, body: this.#delegations.list(context).map(toDelegationDto) };
    } catch (error) {
      return safeError(error);
    }
  }

  grant(request: TransportRequest): TransportResponse<DelegationDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return { status: 401, body: { error: 'Unauthorized' } };
    try {
      const delegation = this.#delegations.grant(context, parseGrant(request.body), metadata(request));
      return { status: 201, body: toDelegationDto(delegation) };
    } catch (error) {
      return safeError(error);
    }
  }

  revoke(request: TransportRequest): TransportResponse<DelegationDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return { status: 401, body: { error: 'Unauthorized' } };
    const delegationId = request.params?.delegationId?.trim();
    if (!delegationId) return { status: 400, body: { error: 'delegationId is required' } };
    try {
      assertEmptyBody(request.body);
      return { status: 200, body: toDelegationDto(this.#delegations.revoke(context, delegationId, metadata(request))) };
    } catch (error) {
      return safeError(error);
    }
  }
}

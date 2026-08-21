import {
  createAccessContext,
  type AccessContext,
  type Capability,
  type PersonId,
  type ServiceGroup,
  type ServiceGroupId,
} from '@eutaktos/domain';
import type {
  CreateServiceGroupInput,
  RequestMetadata,
  UpdateServiceGroupInput,
} from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface ServiceGroupDto {
  id: string;
  name: string;
  memberIds: readonly string[];
  overseerId?: string;
  assistantId?: string;
}

export interface ServiceGroupPort {
  listServiceGroups(context: AccessContext): readonly ServiceGroup[];
  getServiceGroup(context: AccessContext, id: ServiceGroupId): ServiceGroup | undefined;
  createServiceGroup(context: AccessContext, input: CreateServiceGroupInput, metadata?: RequestMetadata): ServiceGroup;
  updateServiceGroup(context: AccessContext, input: UpdateServiceGroupInput, metadata?: RequestMetadata): ServiceGroup;
  deleteServiceGroup(context: AccessContext, id: ServiceGroupId, metadata?: RequestMetadata): boolean;
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

export function toServiceGroupDto(group: ServiceGroup): ServiceGroupDto {
  return {
    id: group.id,
    name: group.name,
    memberIds: group.memberIds,
    ...(group.overseerId ? { overseerId: group.overseerId } : {}),
    ...(group.assistantId ? { assistantId: group.assistantId } : {}),
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

function optionalNullableString(
  body: Readonly<Record<string, unknown>>,
  key: string,
): string | null | undefined {
  const value = body[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw new Error(`${key} must be a string or null`);
  return value;
}

function requiredStringArray(body: Readonly<Record<string, unknown>>, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, i) => {
    if (typeof item !== 'string') throw new Error(`${key}[${i}] must be a string`);
    return item;
  });
}

function optionalStringArray(body: Readonly<Record<string, unknown>>, key: string): string[] | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${key} must be an array`);
  return value.map((item, i) => {
    if (typeof item !== 'string') throw new Error(`${key}[${i}] must be a string`);
    return item;
  });
}

function parseCreateServiceGroupBody(value: unknown): Omit<CreateServiceGroupInput, 'id'> {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['name', 'memberIds', 'overseerId', 'assistantId']);
  return {
    name: requiredString(body, 'name'),
    memberIds: requiredStringArray(body, 'memberIds'),
    ...(body.overseerId !== undefined ? { overseerId: requiredString(body, 'overseerId') } : {}),
    ...(body.assistantId !== undefined ? { assistantId: requiredString(body, 'assistantId') } : {}),
  };
}

function parseUpdateServiceGroupBody(groupId: string, value: unknown): UpdateServiceGroupInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['name', 'memberIds', 'overseerId', 'assistantId']);
  const name = optionalString(body, 'name');
  const memberIds = optionalStringArray(body, 'memberIds');
  const overseerId = optionalNullableString(body, 'overseerId');
  const assistantId = optionalNullableString(body, 'assistantId');
  return {
    id: groupId,
    ...(name !== undefined ? { name } : {}),
    ...(memberIds !== undefined ? { memberIds } : {}),
    ...(overseerId !== undefined ? { overseerId } : {}),
    ...(assistantId !== undefined ? { assistantId } : {}),
  };
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Service group not found') return { status: 404, body: { error: 'Service group not found' } };
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

export class ServiceGroupHttpTransport {
  readonly #groups: ServiceGroupPort;

  constructor(groups: ServiceGroupPort) {
    this.#groups = groups;
  }

  list(request: TransportRequest): TransportResponse<readonly ServiceGroupDto[] | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    try {
      return { status: 200, body: this.#groups.listServiceGroups(context).map(toServiceGroupDto) };
    } catch (error) {
      return safeError(error);
    }
  }

  get(request: TransportRequest): TransportResponse<ServiceGroupDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const groupId = request.params?.serviceGroupId?.trim();
    if (!groupId) return { status: 400, body: { error: 'serviceGroupId is required' } };
    try {
      const group = this.#groups.getServiceGroup(context, groupId);
      return group
        ? { status: 200, body: toServiceGroupDto(group) }
        : { status: 404, body: { error: 'Service group not found' } };
    } catch (error) {
      return safeError(error);
    }
  }

  create(request: TransportRequest): TransportResponse<ServiceGroupDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    try {
      const parsed = parseCreateServiceGroupBody(request.body);
      const id = crypto.randomUUID();
      const group = this.#groups.createServiceGroup(
        context,
        { id, ...parsed },
        metadata(request),
      );
      return { status: 201, body: toServiceGroupDto(group) };
    } catch (error) {
      return safeError(error);
    }
  }

  update(request: TransportRequest): TransportResponse<ServiceGroupDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const groupId = request.params?.serviceGroupId?.trim();
    if (!groupId) return { status: 400, body: { error: 'serviceGroupId is required' } };
    try {
      const group = this.#groups.updateServiceGroup(
        context,
        parseUpdateServiceGroupBody(groupId, request.body),
        metadata(request),
      );
      return { status: 200, body: toServiceGroupDto(group) };
    } catch (error) {
      return safeError(error);
    }
  }

  delete(request: TransportRequest): TransportResponse<{ deleted: boolean } | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const groupId = request.params?.serviceGroupId?.trim();
    if (!groupId) return { status: 400, body: { error: 'serviceGroupId is required' } };
    try {
      this.#groups.deleteServiceGroup(context, groupId, metadata(request));
      return { status: 200, body: { deleted: true } };
    } catch (error) {
      return safeError(error);
    }
  }
}

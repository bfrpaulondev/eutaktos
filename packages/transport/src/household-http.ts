import {
  createAccessContext,
  type AccessContext,
  type Capability,
  type Household,
  type HouseholdId,
  type PersonId,
} from '@eutaktos/domain';
import type {
  CreateHouseholdInput,
  RequestMetadata,
  UpdateHouseholdInput,
} from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface HouseholdDto {
  id: string;
  name: string;
  memberIds: readonly string[];
}

export interface HouseholdPort {
  listHouseholds(context: AccessContext): readonly Household[];
  getHousehold(context: AccessContext, id: HouseholdId): Household | undefined;
  createHousehold(context: AccessContext, input: CreateHouseholdInput, metadata?: RequestMetadata): Household;
  updateHousehold(context: AccessContext, input: UpdateHouseholdInput, metadata?: RequestMetadata): Household;
  deleteHousehold(context: AccessContext, id: HouseholdId, metadata?: RequestMetadata): boolean;
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

export function toHouseholdDto(household: Household): HouseholdDto {
  return {
    id: household.id,
    name: household.name,
    memberIds: household.memberIds,
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

function parseCreateHouseholdBody(value: unknown): Omit<CreateHouseholdInput, 'id'> {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['name', 'memberIds']);
  return {
    name: requiredString(body, 'name'),
    memberIds: requiredStringArray(body, 'memberIds'),
  };
}

function parseUpdateHouseholdBody(householdId: string, value: unknown): UpdateHouseholdInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['name', 'memberIds']);
  const name = optionalString(body, 'name');
  const memberIds = optionalStringArray(body, 'memberIds');
  return {
    id: householdId,
    ...(name !== undefined ? { name } : {}),
    ...(memberIds !== undefined ? { memberIds } : {}),
  };
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Household not found') return { status: 404, body: { error: 'Household not found' } };
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

export class HouseholdHttpTransport {
  readonly #households: HouseholdPort;

  constructor(households: HouseholdPort) {
    this.#households = households;
  }

  list(request: TransportRequest): TransportResponse<readonly HouseholdDto[] | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    try {
      return { status: 200, body: this.#households.listHouseholds(context).map(toHouseholdDto) };
    } catch (error) {
      return safeError(error);
    }
  }

  get(request: TransportRequest): TransportResponse<HouseholdDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const householdId = request.params?.householdId?.trim();
    if (!householdId) return { status: 400, body: { error: 'householdId is required' } };
    try {
      const household = this.#households.getHousehold(context, householdId);
      return household
        ? { status: 200, body: toHouseholdDto(household) }
        : { status: 404, body: { error: 'Household not found' } };
    } catch (error) {
      return safeError(error);
    }
  }

  create(request: TransportRequest): TransportResponse<HouseholdDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    try {
      const parsed = parseCreateHouseholdBody(request.body);
      const id = crypto.randomUUID();
      const household = this.#households.createHousehold(
        context,
        { id, ...parsed },
        metadata(request),
      );
      return { status: 201, body: toHouseholdDto(household) };
    } catch (error) {
      return safeError(error);
    }
  }

  update(request: TransportRequest): TransportResponse<HouseholdDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const householdId = request.params?.householdId?.trim();
    if (!householdId) return { status: 400, body: { error: 'householdId is required' } };
    try {
      const household = this.#households.updateHousehold(
        context,
        parseUpdateHouseholdBody(householdId, request.body),
        metadata(request),
      );
      return { status: 200, body: toHouseholdDto(household) };
    } catch (error) {
      return safeError(error);
    }
  }

  delete(request: TransportRequest): TransportResponse<{ deleted: boolean } | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();
    const householdId = request.params?.householdId?.trim();
    if (!householdId) return { status: 400, body: { error: 'householdId is required' } };
    try {
      this.#households.deleteHousehold(context, householdId, metadata(request));
      return { status: 200, body: { deleted: true } };
    } catch (error) {
      return safeError(error);
    }
  }
}

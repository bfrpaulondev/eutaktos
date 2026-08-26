import {
  createAccessContext,
  latestEligibilityDecision,
  type AccessContext,
  type AssignmentTypeId,
  type CongregationPerson,
  type EligibilityGrant,
  type PersonId,
} from '@eutaktos/domain';
import type { RequestMetadata, SetEligibilityInput } from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface EligibilityDecisionDto {
  assignmentTypeId: AssignmentTypeId;
  enabled: boolean;
  decidedAt: string;
}

export interface EligibilityPort {
  listEligibility(context: AccessContext, personId: PersonId): readonly EligibilityGrant[];
  setEligibility(
    context: AccessContext,
    input: SetEligibilityInput,
    metadata?: RequestMetadata,
  ): CongregationPerson;
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
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(body).filter(key => !allowedKeys.has(key));
  if (unknown.length) throw new Error(`Unknown request fields: ${unknown.sort().join(', ')}`);
}

function parseInput(personId: PersonId, value: unknown): SetEligibilityInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['assignmentTypeId', 'enabled']);
  if (typeof body.assignmentTypeId !== 'string') throw new Error('assignmentTypeId must be a string');
  if (typeof body.enabled !== 'boolean') throw new Error('enabled must be a boolean');
  return { personId, assignmentTypeId: body.assignmentTypeId, enabled: body.enabled };
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Person not found') return { status: 404, body: { error: 'Person not found' } };
  if (message.includes('must be') || message.includes('is required') || message.includes('is too long') || message.startsWith('Unknown request fields:')) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

function toDecisionDto(decision: EligibilityGrant): EligibilityDecisionDto {
  return {
    assignmentTypeId: decision.assignmentTypeId,
    enabled: decision.enabled,
    decidedAt: decision.decidedAt,
  };
}

function currentDecisions(decisions: readonly EligibilityGrant[]): readonly EligibilityDecisionDto[] {
  const assignmentTypeIds = [...new Set(decisions.map(decision => decision.assignmentTypeId))]
    .sort((a, b) => a.localeCompare(b));
  return assignmentTypeIds.map(assignmentTypeId => {
    const decision = latestEligibilityDecision(decisions, assignmentTypeId);
    if (!decision) throw new Error('Eligibility decision was not recorded');
    return toDecisionDto(decision);
  });
}

function latestDecision(person: CongregationPerson, assignmentTypeId: AssignmentTypeId): EligibilityDecisionDto {
  const decision = latestEligibilityDecision(person.eligibility, assignmentTypeId);
  if (!decision) throw new Error('Eligibility decision was not recorded');
  return toDecisionDto(decision);
}

export class EligibilityHttpTransport {
  readonly #eligibility: EligibilityPort;

  constructor(eligibility: EligibilityPort) {
    this.#eligibility = eligibility;
  }

  list(request: TransportRequest): TransportResponse<readonly EligibilityDecisionDto[] | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return { status: 401, body: { error: 'Unauthorized' } };
    const personId = request.params?.personId?.trim();
    if (!personId) return { status: 400, body: { error: 'personId is required' } };

    try {
      return { status: 200, body: currentDecisions(this.#eligibility.listEligibility(context, personId)) };
    } catch (error) {
      return safeError(error);
    }
  }

  set(request: TransportRequest): TransportResponse<EligibilityDecisionDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return { status: 401, body: { error: 'Unauthorized' } };
    const personId = request.params?.personId?.trim();
    if (!personId) return { status: 400, body: { error: 'personId is required' } };

    try {
      const input = parseInput(personId, request.body);
      const metadata = request.correlationId ? { correlationId: request.correlationId } : {};
      const person = this.#eligibility.setEligibility(context, input, metadata);
      return { status: 200, body: latestDecision(person, input.assignmentTypeId) };
    } catch (error) {
      return safeError(error);
    }
  }
}

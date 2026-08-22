import {
  assertCapability,
  assertResponseTenant,
  createAuditEvent,
  createDomainEvent,
  transitionAssignmentResponseIdempotent,
  type AccessContext,
  type AssignmentResponse,
  type AuditEvent,
  type DomainEvent,
  type StructuredReason,
} from '@eutaktos/domain';
import { eventCorrelation, type RequestMetadata } from './people-service';

export interface AssignmentResponseChange {
  readonly response: Readonly<AssignmentResponse>;
  readonly auditEvents: readonly Readonly<AuditEvent>[];
  readonly domainEvents: readonly Readonly<DomainEvent>[];
}

export interface AssignmentResponseUnitOfWork {
  findResponse(context: AccessContext, responseId: string): Readonly<AssignmentResponse> | undefined;
  commit(context: AccessContext, change: AssignmentResponseChange): void;
}

export interface AssignmentResponseRuntime {
  now(): string;
  nextId(scope: 'audit' | 'event'): string;
}

type ResponseCommand = 'confirm' | 'decline' | 'acknowledge';

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

export class AssignmentResponseService {
  readonly #uow: AssignmentResponseUnitOfWork;
  readonly #runtime: AssignmentResponseRuntime;

  constructor(uow: AssignmentResponseUnitOfWork, runtime: AssignmentResponseRuntime) {
    this.#uow = uow; this.#runtime = runtime;
  }

  #apply(context: AccessContext, responseIdInput: string, command: ResponseCommand, reason: StructuredReason | undefined, metadata: RequestMetadata): Readonly<AssignmentResponse> {
    assertCapability(context, 'schedule.read');
    const response = this.#uow.findResponse(context, required(responseIdInput, 'responseId'));
    if (!response) throw new Error('Assignment response not found');
    assertResponseTenant(response, context.tenantId);
    if (response.personId !== context.actorId) throw new Error('Assignment response can only be changed by its assigned person');

    const target = command === 'confirm' ? 'confirmed' : command === 'decline' ? 'declined' : 'acknowledged';
    const at = this.#runtime.now();
    const next = transitionAssignmentResponseIdempotent(response, target, at, command === 'acknowledge' ? undefined : reason);
    if (next === response) return response;

    const audit = createAuditEvent({
      id: this.#runtime.nextId('audit'), tenantId: context.tenantId,
      resourceType: 'assignment-response', resourceId: response.id, action: 'update',
      actorId: context.actorId, occurredAt: at,
      changedFields: command === 'acknowledge' ? ['status', 'acknowledgedAt'] : ['status', 'respondedAt', ...(reason ? ['reason'] : [])],
    });
    const event = createDomainEvent({
      id: this.#runtime.nextId('event'), tenantId: context.tenantId,
      type: command === 'decline' ? 'AssignmentDeclined' : 'AssignmentResponseUpdated',
      aggregateId: response.assignmentId, actorId: context.actorId, occurredAt: at,
      schemaVersion: 1, ...eventCorrelation(metadata),
    });
    this.#uow.commit(context, { response: next, auditEvents: [audit], domainEvents: [event] });
    return next;
  }

  confirm(context: AccessContext, responseId: string, reason?: StructuredReason, metadata: RequestMetadata = {}): Readonly<AssignmentResponse> {
    return this.#apply(context, responseId, 'confirm', reason, metadata);
  }

  decline(context: AccessContext, responseId: string, reason?: StructuredReason, metadata: RequestMetadata = {}): Readonly<AssignmentResponse> {
    return this.#apply(context, responseId, 'decline', reason, metadata);
  }

  acknowledge(context: AccessContext, responseId: string, metadata: RequestMetadata = {}): Readonly<AssignmentResponse> {
    return this.#apply(context, responseId, 'acknowledge', undefined, metadata);
  }
}

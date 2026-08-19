import type { PersonId, TenantId } from './people';

export type DomainEventType =
  | 'PersonCreated'
  | 'PersonUpdated'
  | 'AvailabilityChanged'
  | 'EligibilityChanged'
  | 'ResponsibilityChanged'
  | 'AssignmentCreated'
  | 'AssignmentDeclined'
  | 'AssignmentReplaced'
  | 'ReviewRequested'
  | 'ReviewDecisionRecorded'
  | 'ExportCreated'
  | 'SensitiveRecordAccessed';

export interface DomainEvent {
  id: string;
  tenantId: TenantId;
  type: DomainEventType;
  aggregateId: string;
  actorId: PersonId;
  occurredAt: string;
  schemaVersion: 1;
  correlationId?: string;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
  return value;
}

/**
 * The base event envelope intentionally contains identifiers and event type only.
 * Personal names, notes, contact details and spiritual/review content must not be
 * copied into general-purpose event metadata. Domain-specific consumers fetch the
 * minimum authorized state they need from the source domain.
 */
export function createDomainEvent(input: DomainEvent): Readonly<DomainEvent> {
  required(input.id, 'eventId');
  required(input.tenantId, 'tenantId');
  required(input.aggregateId, 'aggregateId');
  required(input.actorId, 'actorId');
  validateInstant(input.occurredAt);
  if (input.schemaVersion !== 1) throw new Error('Unsupported domain event schema version');

  if (input.correlationId) {
    return Object.freeze({
      ...input,
      correlationId: required(input.correlationId, 'correlationId'),
    });
  }

  const { correlationId: _omitted, ...event } = input;
  return Object.freeze(event);
}

export function assertEventTenant(event: DomainEvent, tenantId: TenantId): void {
  if (event.tenantId !== tenantId) throw new Error('Cross-tenant domain event access denied');
}

export function orderDomainEvents(events: readonly DomainEvent[]): readonly DomainEvent[] {
  return [...events].sort((left, right) => {
    const delta = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
    return delta || left.id.localeCompare(right.id);
  });
}

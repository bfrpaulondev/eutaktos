import type { PersonId, TenantId } from './people';

export type DomainEventType =
  | 'PersonCreated'
  | 'PersonUpdated'
  | 'CongregationCreated'
  | 'CongregationUpdated'
  | 'HouseholdCreated'
  | 'HouseholdUpdated'
  | 'HouseholdDeleted'
  | 'ServiceGroupCreated'
  | 'ServiceGroupUpdated'
  | 'ServiceGroupDeleted'
  | 'AvailabilityChanged'
  | 'EligibilityChanged'
  | 'EmergencyContactChanged'
  | 'ResponsibilityChanged'
  | 'DelegationGranted'
  | 'DelegationRevoked'
  | 'CapabilityGranted'
  | 'CapabilityRevoked'
  | 'AssignmentCreated'
  | 'AssignmentDeclined'
  | 'AssignmentReplaced'
  | 'AssignmentCancelled'
  | 'AssignmentCompleted'
  | 'AssignmentResponseUpdated'
  | 'DutyDefinitionCreated'
  | 'DutyAssigned'
  | 'DutyReplaced'
  | 'DutyCancelled'
  | 'DutyCompleted'
  | 'NotificationIntentQueued'
  | 'MigrationApplied'
  | 'MigrationRolledBack'
  | 'MidweekMeetingCreated'
  | 'MidweekMeetingUpdated'
  | 'MidweekMeetingPublished'
  | 'MidweekMeetingCancelled'
  | 'MidweekMeetingArchived'
  | 'ReviewRequested'
  | 'ReviewDecisionRecorded'
  | 'ExportCreated'
  | 'SensitiveRecordAccessed';

export type DomainEventPayloadValue = string | number | boolean | null;
export type DomainEventPayload = Readonly<Record<string, DomainEventPayloadValue>>;

export interface DomainEvent {
  id: string;
  tenantId: TenantId;
  type: DomainEventType;
  aggregateId: string;
  actorId: PersonId;
  occurredAt: string;
  schemaVersion: 1;
  correlationId?: string;
  payload?: DomainEventPayload;
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

function normalizePayload(payload: DomainEventPayload | undefined): DomainEventPayload | undefined {
  if (payload === undefined) return undefined;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Domain event payload must be an object');
  const entries = Object.entries(payload);
  if (entries.length > 20) throw new Error('Domain event payload has too many fields');
  const normalized: Record<string, DomainEventPayloadValue> = {};
  for (const [rawKey, value] of entries) {
    const key = required(rawKey, 'payload key');
    if (key.length > 100) throw new Error('Domain event payload key is too long');
    if (typeof value === 'string') {
      if (value.length > 500) throw new Error(`Domain event payload value is too long: ${key}`);
      normalized[key] = value;
      continue;
    }
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      normalized[key] = value;
      continue;
    }
    throw new Error(`Invalid domain event payload value: ${key}`);
  }
  return Object.freeze(normalized);
}

export function createDomainEvent(input: DomainEvent): Readonly<DomainEvent> {
  required(input.id, 'eventId');
  required(input.tenantId, 'tenantId');
  required(input.aggregateId, 'aggregateId');
  required(input.actorId, 'actorId');
  validateInstant(input.occurredAt);
  if (input.schemaVersion !== 1) throw new Error('Unsupported domain event schema version');

  const payload = normalizePayload(input.payload);
  const correlationId = input.correlationId ? required(input.correlationId, 'correlationId') : undefined;
  const event: DomainEvent = {
    id: input.id,
    tenantId: input.tenantId,
    type: input.type,
    aggregateId: input.aggregateId,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
    schemaVersion: input.schemaVersion,
    ...(correlationId ? { correlationId } : {}),
    ...(payload ? { payload } : {}),
  };
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

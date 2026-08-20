import type { PersonId, TenantId } from './people';

export type AuditEventId = string;

export type AuditedResourceType =
  | 'person'
  | 'congregation'
  | 'household'
  | 'service-group'
  | 'responsibility'
  | 'eligibility'
  | 'availability'
  | 'emergency-contact';

export interface AuditEvent {
  id: AuditEventId;
  tenantId: TenantId;
  resourceType: AuditedResourceType;
  resourceId: string;
  action: 'create' | 'update' | 'delete' | 'grant' | 'revoke';
  actorId: PersonId;
  occurredAt: string;
  changedFields: readonly string[];
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseInstant(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ISO date: ${value}`);
  return timestamp;
}

export function createAuditEvent(input: AuditEvent): Readonly<AuditEvent> {
  required(input.id, 'auditEventId');
  required(input.tenantId, 'tenantId');
  required(input.resourceId, 'resourceId');
  required(input.actorId, 'actorId');
  parseInstant(input.occurredAt);

  const changedFields = [...new Set(input.changedFields.map(field => required(field, 'changedField')))].sort();
  if (input.action === 'update' && changedFields.length === 0) {
    throw new Error('Update audit events require changedFields');
  }

  return Object.freeze({ ...input, changedFields: Object.freeze(changedFields) });
}

export function assertAuditTenant(event: AuditEvent, tenantId: TenantId): void {
  if (event.tenantId !== tenantId) throw new Error('Cross-tenant audit access denied');
}

export function orderAuditEvents(events: readonly AuditEvent[]): readonly AuditEvent[] {
  return [...events].sort((left, right) => {
    const timeDelta = parseInstant(left.occurredAt) - parseInstant(right.occurredAt);
    return timeDelta || left.id.localeCompare(right.id);
  });
}

export function hasAuditEventFor(
  events: readonly AuditEvent[],
  resourceType: AuditedResourceType,
  resourceId: string,
): boolean {
  return events.some(event => event.resourceType === resourceType && event.resourceId === resourceId);
}

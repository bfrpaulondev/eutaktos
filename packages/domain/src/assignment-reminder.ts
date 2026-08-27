import type { PersonId, TenantId } from './people';

export interface AssignmentReminderRecord {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly assignmentId: string;
  readonly recipientId: PersonId;
  readonly deliveryId: string;
  readonly queuedAt: string;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

function instant(value: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('queuedAt must be a valid ISO instant');
  return value;
}

export function createAssignmentReminderRecord(input: AssignmentReminderRecord): Readonly<AssignmentReminderRecord> {
  const deliveryId = required(input.deliveryId, 'deliveryId');
  return Object.freeze({
    id: required(input.id, 'id'),
    tenantId: required(input.tenantId, 'tenantId'),
    assignmentId: required(input.assignmentId, 'assignmentId'),
    recipientId: required(input.recipientId, 'recipientId'),
    deliveryId,
    queuedAt: instant(input.queuedAt),
  });
}

export function assertAssignmentReminderTenant(record: Readonly<AssignmentReminderRecord>, tenantId: TenantId): void {
  if (record.tenantId !== tenantId) throw new Error('Cross-tenant assignment reminder access denied');
}

export function latestAssignmentReminder(
  records: readonly Readonly<AssignmentReminderRecord>[],
  tenantId: TenantId,
  assignmentId: string,
  recipientId: PersonId,
): Readonly<AssignmentReminderRecord> | undefined {
  const normalizedAssignmentId = required(assignmentId, 'assignmentId');
  const normalizedRecipientId = required(recipientId, 'recipientId');
  return records
    .filter(record => record.tenantId === tenantId && record.assignmentId === normalizedAssignmentId && record.recipientId === normalizedRecipientId)
    .sort((left, right) => right.queuedAt.localeCompare(left.queuedAt))[0];
}

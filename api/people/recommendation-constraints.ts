import { normalizeManualRecommendationConstraint, type ManualRecommendationConstraint } from '@eutaktos/application';
import { createAuditEvent, createDomainEvent, type AccessContext } from '@eutaktos/domain';
import type { EntityRow, SupabaseRestDatabase } from '../_db';

const ENTITY_TYPE = 'recommendation-manual-constraint';

type ConstraintDatabase = Pick<SupabaseRestDatabase, 'entities' | 'entity' | 'applyEntityChange' | 'deleteEntityChange'>;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function stored(row: EntityRow, tenantId: string): Readonly<ManualRecommendationConstraint> {
  if (row.tenant_id !== tenantId || row.entity_type !== ENTITY_TYPE || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error('Invalid stored manual recommendation constraint');
  }
  const value = row.data as Readonly<Record<string, unknown>>;
  if (value.id !== row.entity_id || value.tenantId !== tenantId) throw new Error('Invalid stored manual recommendation constraint identity');
  return normalizeManualRecommendationConstraint({
    id: String(value.id),
    tenantId,
    personId: String(value.personId ?? ''),
    assignmentTypeId: String(value.assignmentTypeId ?? ''),
    kind: value.kind as 'exclude',
    createdAt: String(value.createdAt ?? ''),
  });
}

export async function manualRecommendationConstraintId(tenantId: string, personId: string, assignmentTypeId: string): Promise<string> {
  const digest = await sha256(`${tenantId}\u001f${personId}\u001f${assignmentTypeId}`);
  return `recommendation-constraint-${digest.slice(0, 32)}`;
}

export async function loadManualRecommendationConstraints(
  database: ConstraintDatabase,
  tenantId: string,
): Promise<readonly Readonly<ManualRecommendationConstraint>[]> {
  const rows = await database.entities(tenantId, ENTITY_TYPE);
  return Object.freeze(rows.map(row => stored(row, tenantId)));
}

export async function changeManualRecommendationConstraint(
  database: ConstraintDatabase,
  context: AccessContext,
  personIdInput: string,
  assignmentTypeIdInput: string,
  action: 'exclude' | 'allow',
): Promise<Readonly<{ excluded: boolean; changed: boolean }>> {
  const personId = personIdInput.trim();
  const assignmentTypeId = assignmentTypeIdInput.trim();
  if (!personId || personId.length > 200) throw new Error('Invalid manual constraint person');
  if (!assignmentTypeId || assignmentTypeId.length > 200) throw new Error('Invalid manual constraint assignment type');
  const id = await manualRecommendationConstraintId(context.tenantId, personId, assignmentTypeId);
  const currentRow = await database.entity(context.tenantId, ENTITY_TYPE, id);
  const current = currentRow ? stored(currentRow, context.tenantId) : undefined;

  if (action === 'exclude' && current) return Object.freeze({ excluded: true, changed: false });
  if (action === 'allow' && !currentRow) return Object.freeze({ excluded: false, changed: false });

  const occurredAt = new Date().toISOString();
  const audit = createAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    tenantId: context.tenantId,
    resourceType: 'recommendation-constraint',
    resourceId: id,
    action: action === 'exclude' ? 'create' : 'delete',
    actorId: context.actorId,
    occurredAt,
    changedFields: ['status'],
  });
  const event = createDomainEvent({
    id: `event-${crypto.randomUUID()}`,
    tenantId: context.tenantId,
    type: 'RecommendationConstraintChanged',
    aggregateId: id,
    actorId: context.actorId,
    occurredAt,
    schemaVersion: 1,
  });

  if (action === 'exclude') {
    const constraint = normalizeManualRecommendationConstraint({ id, tenantId: context.tenantId, personId, assignmentTypeId, kind: 'exclude', createdAt: occurredAt });
    await database.applyEntityChange({
      p_tenant_id: context.tenantId,
      p_entity_type: ENTITY_TYPE,
      p_entity_id: id,
      p_data: constraint,
      p_expected_version: null,
      p_audit: audit,
      p_event: event,
    });
    return Object.freeze({ excluded: true, changed: true });
  }

  await database.deleteEntityChange({
    p_tenant_id: context.tenantId,
    p_entity_type: ENTITY_TYPE,
    p_entity_id: id,
    p_expected_version: currentRow!.version,
    p_audit: audit,
    p_event: event,
  });
  return Object.freeze({ excluded: false, changed: true });
}

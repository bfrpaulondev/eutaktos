import { createAuditEvent, createDomainEvent, type AccessContext } from '@eutaktos/domain';
import type { EntityRow, SupabaseRestDatabase } from '../../_db';

export interface HourglassRollbackResult {
  readonly outcome: 'rolled-back' | 'already-rolled-back';
  readonly migrationId: string;
  readonly removedCount: number;
}

type RollbackDatabase = Pick<SupabaseRestDatabase, 'entity' | 'rollbackHourglassCreateMigration'>;

function migrationCreateIds(row: EntityRow, tenantId: string, migrationId: string): readonly string[] {
  if (row.tenant_id !== tenantId || row.entity_type !== 'hourglass-migration' || row.entity_id !== migrationId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error('Invalid stored Hourglass migration');
  }
  const data = row.data as Readonly<Record<string, unknown>>;
  const log = data.log;
  const steps = data.postCommitSteps;
  if (!log || typeof log !== 'object' || Array.isArray(log) || !Array.isArray(steps)) throw new Error('Invalid stored Hourglass migration state');
  const logRecord = log as Readonly<Record<string, unknown>>;
  if (logRecord.tenantId !== tenantId || logRecord.migrationId !== migrationId || (logRecord.status !== 'completed' && logRecord.status !== 'rolled-back')) {
    throw new Error('Invalid stored Hourglass migration status');
  }
  const ids = steps.map(step => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error('Invalid stored Hourglass rollback evidence');
    const record = step as Readonly<Record<string, unknown>>;
    if (record.kind !== 'create' || typeof record.internalId !== 'string' || !record.internalId.trim()) throw new Error('Hourglass migration is not create-only');
    return record.internalId.trim();
  });
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate Hourglass rollback identity');
  return Object.freeze(ids);
}

export async function rollbackHourglassImport(
  database: RollbackDatabase,
  context: AccessContext,
  migrationIdInput: string,
): Promise<Readonly<HourglassRollbackResult>> {
  if (!context.capabilities.includes('people.write') || !context.capabilities.includes('eligibility.write')) throw new Error('Missing Hourglass rollback capability');
  const migrationId = migrationIdInput.trim();
  if (!/^hourglass-migration-[0-9a-f]{32}$/.test(migrationId)) throw new Error('Invalid Hourglass migration identity');
  const before = await database.entity(context.tenantId, 'hourglass-migration', migrationId);
  if (!before) throw new Error('Hourglass migration not found');
  const createdIds = migrationCreateIds(before, context.tenantId, migrationId);
  const occurredAt = new Date().toISOString();
  const audit = createAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    tenantId: context.tenantId,
    resourceType: 'migration',
    resourceId: migrationId,
    action: 'update',
    actorId: context.actorId,
    occurredAt,
    changedFields: ['status'],
  });
  const event = createDomainEvent({
    id: `event-${crypto.randomUUID()}`,
    tenantId: context.tenantId,
    type: 'MigrationRolledBack',
    aggregateId: migrationId,
    actorId: context.actorId,
    occurredAt,
    schemaVersion: 1,
  });
  const rolledBack = await database.rollbackHourglassCreateMigration({
    p_tenant_id: context.tenantId,
    p_migration_id: migrationId,
    p_audit: audit,
    p_event: event,
  });

  const after = await database.entity(context.tenantId, 'hourglass-migration', migrationId);
  if (!after) throw new Error('Hourglass rollback verification failed');
  const afterData = after.data as Readonly<Record<string, unknown>>;
  const afterLog = afterData?.log;
  if (!afterLog || typeof afterLog !== 'object' || Array.isArray(afterLog) || (afterLog as Readonly<Record<string, unknown>>).status !== 'rolled-back') {
    throw new Error('Hourglass rollback verification failed');
  }
  for (const personId of createdIds) {
    if (await database.entity(context.tenantId, 'person', personId)) throw new Error('Hourglass rollback person verification failed');
  }

  return Object.freeze({ outcome: rolledBack.outcome, migrationId, removedCount: createdIds.length });
}

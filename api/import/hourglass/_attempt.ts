import type { HourglassImportInspection } from '@eutaktos/application';
import { createAuditEvent, createDomainEvent, type AccessContext } from '@eutaktos/domain';
import type { EntityRow, SupabaseRestDatabase } from '../../_db';
import { prepareHourglassExecution, type HourglassExecutionAttempt } from './_execution';

const ENTITY_TYPE = 'hourglass-execution-attempt';
const MAX_AGE_MS = 30 * 60 * 1000;

export interface PersistedHourglassExecutionAttempt extends HourglassExecutionAttempt {
  readonly tenantId: string;
  readonly actorId: string;
  readonly sourceDigest: string;
  readonly confirmationDigest: string;
  readonly expiresAt: string;
  readonly counts: Readonly<Record<'create' | 'unchanged' | 'conflict', number>>;
}

type AttemptDatabase = Pick<SupabaseRestDatabase, 'entity' | 'applyEntityChange'> & Parameters<typeof prepareHourglassExecution>[0];

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

export async function hourglassInspectionDigest(inspection: Readonly<HourglassImportInspection>): Promise<string> {
  return sha256(stableJson(inspection));
}

export async function hourglassExecutionId(context: AccessContext, mutationId: string): Promise<string> {
  const normalized = mutationId.trim();
  if (!/^[A-Za-z0-9._~-]{8,120}$/.test(normalized)) throw new Error('Invalid Hourglass prepare mutation identity');
  const digest = await sha256(`${context.tenantId}\u001f${context.actorId}\u001f${normalized}`);
  return `hourglass-execution-${digest.slice(0, 32)}`;
}

function exactString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid stored Hourglass execution ${name}`);
  return value.trim();
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid stored Hourglass execution counts');
  return value;
}

function parseAttempt(row: EntityRow, tenantId: string): Readonly<PersistedHourglassExecutionAttempt> {
  if (row.tenant_id !== tenantId || row.entity_type !== ENTITY_TYPE || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error('Invalid stored Hourglass execution attempt');
  }
  const value = row.data as Readonly<Record<string, unknown>>;
  if (value.id !== row.entity_id || value.tenantId !== tenantId) throw new Error('Invalid stored Hourglass execution attempt identity');
  const counts = value.counts;
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) throw new Error('Invalid stored Hourglass execution counts');
  const countRecord = counts as Readonly<Record<string, unknown>>;
  const initiatedAt = exactString(value.initiatedAt, 'timestamp');
  const expiresAt = exactString(value.expiresAt, 'expiry');
  if (!Number.isFinite(Date.parse(initiatedAt)) || !Number.isFinite(Date.parse(expiresAt))) throw new Error('Invalid stored Hourglass execution timestamp');
  const sourceDigest = exactString(value.sourceDigest, 'source digest');
  const confirmationDigest = exactString(value.confirmationDigest, 'confirmation digest');
  if (!/^[0-9a-f]{64}$/.test(sourceDigest) || !/^[0-9a-f]{64}$/.test(confirmationDigest)) throw new Error('Invalid stored Hourglass execution digest');
  return Object.freeze({
    executionId: row.entity_id,
    tenantId,
    actorId: exactString(value.actorId, 'actor'),
    sourceDigest,
    confirmationDigest,
    initiatedAt,
    expiresAt,
    counts: Object.freeze({ create: count(countRecord.create), unchanged: count(countRecord.unchanged), conflict: count(countRecord.conflict) }),
  });
}

function assertAttemptOwner(attempt: Readonly<PersistedHourglassExecutionAttempt>, context: AccessContext, sourceDigest: string): void {
  if (attempt.tenantId !== context.tenantId || attempt.actorId !== context.actorId) throw new Error('Hourglass execution attempt ownership mismatch');
  if (attempt.sourceDigest !== sourceDigest) throw new Error('Hourglass execution attempt source mismatch');
}

function assertNotExpired(attempt: Readonly<PersistedHourglassExecutionAttempt>, now = Date.now()): void {
  if (Date.parse(attempt.expiresAt) < now) throw new Error('Hourglass execution confirmation expired');
}

async function existingAttempt(database: AttemptDatabase, context: AccessContext, executionId: string): Promise<Readonly<PersistedHourglassExecutionAttempt> | undefined> {
  const row = await database.entity(context.tenantId, ENTITY_TYPE, executionId);
  return row ? parseAttempt(row, context.tenantId) : undefined;
}

async function assertCurrentConfirmation(
  database: AttemptDatabase,
  context: AccessContext,
  inspection: Readonly<HourglassImportInspection>,
  attempt: Readonly<PersistedHourglassExecutionAttempt>,
): Promise<void> {
  const prepared = await prepareHourglassExecution(database, context, inspection, attempt);
  if (prepared.confirmationDigest !== attempt.confirmationDigest) throw new Error('Hourglass preparation is stale; start a new comparison');
}

export async function preparePersistedHourglassExecutionAttempt(
  database: AttemptDatabase,
  context: AccessContext,
  inspection: Readonly<HourglassImportInspection>,
  mutationId: string,
): Promise<Readonly<PersistedHourglassExecutionAttempt>> {
  const sourceDigest = await hourglassInspectionDigest(inspection);
  const executionId = await hourglassExecutionId(context, mutationId);
  const existing = await existingAttempt(database, context, executionId);
  if (existing) {
    assertAttemptOwner(existing, context, sourceDigest);
    assertNotExpired(existing);
    await assertCurrentConfirmation(database, context, inspection, existing);
    return existing;
  }

  const initiatedAt = new Date().toISOString();
  const executionAttempt = Object.freeze({ executionId, initiatedAt });
  const prepared = await prepareHourglassExecution(database, context, inspection, executionAttempt);
  const expiresAt = new Date(Date.parse(initiatedAt) + MAX_AGE_MS).toISOString();
  const data = Object.freeze({
    id: executionId,
    tenantId: context.tenantId,
    actorId: context.actorId,
    sourceDigest,
    confirmationDigest: prepared.confirmationDigest,
    counts: prepared.counts,
    initiatedAt,
    expiresAt,
  });
  const auditEvent = createAuditEvent({
    id: `audit-${crypto.randomUUID()}`,
    tenantId: context.tenantId,
    resourceType: 'migration',
    resourceId: executionId,
    action: 'create',
    actorId: context.actorId,
    occurredAt: initiatedAt,
    changedFields: ['confirmation'],
  });
  const domainEvent = createDomainEvent({
    id: `event-${crypto.randomUUID()}`,
    tenantId: context.tenantId,
    type: 'MigrationPrepared',
    aggregateId: executionId,
    actorId: context.actorId,
    occurredAt: initiatedAt,
    schemaVersion: 1,
  });

  try {
    await database.applyEntityChange({
      p_tenant_id: context.tenantId,
      p_entity_type: ENTITY_TYPE,
      p_entity_id: executionId,
      p_data: data,
      p_expected_version: null,
      p_audit: auditEvent,
      p_event: domainEvent,
    });
    return Object.freeze({ executionId, tenantId: context.tenantId, actorId: context.actorId, sourceDigest, confirmationDigest: prepared.confirmationDigest, counts: prepared.counts, initiatedAt, expiresAt });
  } catch (error) {
    const raced = await existingAttempt(database, context, executionId);
    if (!raced) throw error;
    assertAttemptOwner(raced, context, sourceDigest);
    assertNotExpired(raced);
    await assertCurrentConfirmation(database, context, inspection, raced);
    return raced;
  }
}

export async function loadPersistedHourglassExecutionAttempt(
  database: AttemptDatabase,
  context: AccessContext,
  inspection: Readonly<HourglassImportInspection>,
  executionIdInput: string,
): Promise<Readonly<PersistedHourglassExecutionAttempt>> {
  const executionId = executionIdInput.trim();
  if (!/^hourglass-execution-[0-9a-f]{32}$/.test(executionId)) throw new Error('Invalid Hourglass execution identity');
  const sourceDigest = await hourglassInspectionDigest(inspection);
  const attempt = await existingAttempt(database, context, executionId);
  if (!attempt) throw new Error('Hourglass execution attempt not found');
  assertAttemptOwner(attempt, context, sourceDigest);
  assertNotExpired(attempt);
  return attempt;
}

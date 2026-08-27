import type { HourglassImportInspection, HourglassMigrationPreview } from '@eutaktos/application';
import {
  createAuditEvent,
  createDomainEvent,
  type AccessContext,
} from '@eutaktos/domain';
import type { EntityRow, SupabaseRestDatabase } from '../../_db';
import {
  executeHourglassImport,
  hourglassMigrationIdForAttempt,
  prepareHourglassExecution,
  type HourglassExecutionAttempt,
  type HourglassExecutionDatabase,
  type HourglassExecutionResult,
} from './_execution';

const ATTEMPT_ENTITY_TYPE = 'hourglass-execution-attempt';
const ATTEMPT_TTL_MS = 15 * 60 * 1000;

export class HourglassHandshakeError extends Error {}

export interface HourglassHandshakeRuntime {
  now(): string;
  nextId(scope: 'hourglass-execution' | 'audit' | 'event'): string;
}

const defaultRuntime: HourglassHandshakeRuntime = Object.freeze({
  now: () => new Date().toISOString(),
  nextId: scope => `${scope}-${crypto.randomUUID()}`,
});

export interface HourglassPreparedHandshake {
  readonly attemptId: string;
  readonly expiresAt: string;
  readonly confirmationDigest: string;
  readonly counts: Readonly<Record<'create' | 'unchanged' | 'conflict', number>>;
  readonly preview: Readonly<HourglassMigrationPreview>;
}

export type HourglassHandshakeDatabase = HourglassExecutionDatabase & Pick<SupabaseRestDatabase, 'applyEntityChange'>;

interface StoredAttempt {
  readonly id: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly initiatedAt: string;
  readonly expiresAt: string;
  readonly inspectionDigest: string;
  readonly confirmationDigest: string;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hourglassInspectionDigest(inspection: Readonly<HourglassImportInspection>): Promise<string> {
  return sha256(JSON.stringify(inspection));
}

function validDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function storedAttempt(row: EntityRow | undefined, context: AccessContext, attemptId: string): Readonly<StoredAttempt> {
  if (!row || row.tenant_id !== context.tenantId || row.entity_type !== ATTEMPT_ENTITY_TYPE || row.entity_id !== attemptId) {
    throw new HourglassHandshakeError('Hourglass execution attempt is unavailable');
  }
  if (!row.data || typeof row.data !== 'object' || Array.isArray(row.data)) throw new Error('Invalid stored Hourglass execution attempt');
  const data = row.data as Readonly<Record<string, unknown>>;
  if (
    data.id !== attemptId || data.tenantId !== context.tenantId ||
    typeof data.actorId !== 'string' || typeof data.initiatedAt !== 'string' || typeof data.expiresAt !== 'string' ||
    !validDigest(data.inspectionDigest) || !validDigest(data.confirmationDigest) ||
    !Number.isFinite(Date.parse(data.initiatedAt)) || !Number.isFinite(Date.parse(data.expiresAt))
  ) throw new Error('Invalid stored Hourglass execution attempt');
  if (data.actorId !== context.actorId) throw new HourglassHandshakeError('Hourglass execution attempt is unavailable');
  return Object.freeze({
    id: attemptId,
    tenantId: context.tenantId,
    actorId: data.actorId,
    initiatedAt: data.initiatedAt,
    expiresAt: data.expiresAt,
    inspectionDigest: data.inspectionDigest,
    confirmationDigest: data.confirmationDigest,
  });
}

function normalizeAttemptId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._~-]{8,120}$/.test(normalized)) throw new HourglassHandshakeError('Invalid Hourglass execution attempt');
  return normalized;
}

function normalizeConfirmationDigest(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new HourglassHandshakeError('Invalid Hourglass confirmation digest');
  return normalized;
}

function expiresAtFor(initiatedAt: string): string {
  const timestamp = Date.parse(initiatedAt);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid Hourglass execution timestamp');
  return new Date(timestamp + ATTEMPT_TTL_MS).toISOString();
}

export async function prepareHourglassExecutionHandshake(
  database: HourglassHandshakeDatabase,
  context: AccessContext,
  inspection: Readonly<HourglassImportInspection>,
  runtime: HourglassHandshakeRuntime = defaultRuntime,
): Promise<Readonly<HourglassPreparedHandshake>> {
  const initiatedAt = runtime.now();
  const attempt: Readonly<HourglassExecutionAttempt> = Object.freeze({
    executionId: normalizeAttemptId(runtime.nextId('hourglass-execution')),
    initiatedAt,
  });
  const preparation = await prepareHourglassExecution(database, context, inspection, attempt);
  if (preparation.counts.conflict > 0) throw new HourglassHandshakeError('Hourglass preview contains unresolved conflicts');

  const expiresAt = expiresAtFor(initiatedAt);
  const inspectionDigest = await hourglassInspectionDigest(inspection);
  const stored: Readonly<StoredAttempt> = Object.freeze({
    id: attempt.executionId,
    tenantId: context.tenantId,
    actorId: context.actorId,
    initiatedAt,
    expiresAt,
    inspectionDigest,
    confirmationDigest: preparation.confirmationDigest,
  });
  const audit = createAuditEvent({
    id: runtime.nextId('audit'),
    tenantId: context.tenantId,
    resourceType: 'migration',
    resourceId: attempt.executionId,
    action: 'create',
    actorId: context.actorId,
    occurredAt: initiatedAt,
    changedFields: [],
  });
  const event = createDomainEvent({
    id: runtime.nextId('event'),
    tenantId: context.tenantId,
    type: 'MigrationPrepared',
    aggregateId: attempt.executionId,
    actorId: context.actorId,
    occurredAt: initiatedAt,
    schemaVersion: 1,
  });
  await database.applyEntityChange({
    p_tenant_id: context.tenantId,
    p_entity_type: ATTEMPT_ENTITY_TYPE,
    p_entity_id: attempt.executionId,
    p_data: stored,
    p_expected_version: null,
    p_audit: audit,
    p_event: event,
  });

  return Object.freeze({
    attemptId: attempt.executionId,
    expiresAt,
    confirmationDigest: preparation.confirmationDigest,
    counts: preparation.counts,
    preview: preparation.preview,
  });
}

function expectedExecutionError(error: unknown): HourglassHandshakeError | undefined {
  if (!(error instanceof Error)) return undefined;
  if (
    error.message === 'Hourglass confirmation is stale' ||
    error.message === 'Hourglass preview contains unresolved conflicts' ||
    error.message === 'Hourglass migration was rolled back'
  ) return new HourglassHandshakeError(error.message);
  return undefined;
}

export async function executePreparedHourglassHandshake(
  database: HourglassHandshakeDatabase,
  context: AccessContext,
  inspection: Readonly<HourglassImportInspection>,
  attemptIdInput: string,
  confirmationDigestInput: string,
  now: string = new Date().toISOString(),
): Promise<Readonly<HourglassExecutionResult>> {
  const attemptId = normalizeAttemptId(attemptIdInput);
  const suppliedConfirmation = normalizeConfirmationDigest(confirmationDigestInput);
  const row = await database.entity(context.tenantId, ATTEMPT_ENTITY_TYPE, attemptId);
  const stored = storedAttempt(row, context, attemptId);
  if (stored.confirmationDigest !== suppliedConfirmation) throw new HourglassHandshakeError('Hourglass confirmation does not match the prepared execution');
  if (await hourglassInspectionDigest(inspection) !== stored.inspectionDigest) throw new HourglassHandshakeError('Hourglass payload no longer matches the prepared execution');

  const attempt: Readonly<HourglassExecutionAttempt> = Object.freeze({ executionId: stored.id, initiatedAt: stored.initiatedAt });
  if (Date.parse(now) > Date.parse(stored.expiresAt)) {
    const migrationId = await hourglassMigrationIdForAttempt(context, attempt);
    const committed = await database.entity(context.tenantId, 'hourglass-migration', migrationId);
    if (!committed) throw new HourglassHandshakeError('Hourglass execution attempt has expired');
  }

  try {
    return await executeHourglassImport(database, context, inspection, stored.confirmationDigest, attempt);
  } catch (error) {
    const expected = expectedExecutionError(error);
    if (expected) throw expected;
    throw error;
  }
}

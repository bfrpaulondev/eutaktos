import {
  HOURGLASS_EXTERNAL_ID_PREFIX,
  appendMigrationOperation,
  createMigrationLog,
  createRollbackPlan,
  finishMigration,
  previewHourglassImport,
  type ExistingHourglassPerson,
  type HourglassImportInspection,
  type HourglassMigrationPreview,
} from '@eutaktos/application';
import {
  assertCapability,
  createAuditEvent,
  createDomainEvent,
  latestEligibilityDecision,
  type AccessContext,
  type CongregationPerson,
} from '@eutaktos/domain';
import type { EntityRow, SupabaseRestDatabase } from '../../_db';

export interface HourglassExecutionAttempt {
  readonly executionId: string;
  readonly initiatedAt: string;
}

export interface HourglassExecutionPreparation {
  readonly attempt: Readonly<HourglassExecutionAttempt>;
  readonly confirmationDigest: string;
  readonly counts: Readonly<Record<'create' | 'unchanged' | 'conflict', number>>;
}

export interface HourglassExecutionResult {
  readonly outcome: 'applied' | 'already-applied' | 'no-op';
  readonly migrationId?: string;
  readonly createdCount: number;
  readonly unchangedCount: number;
}

export type HourglassExecutionDatabase = Pick<
  SupabaseRestDatabase,
  'entities' | 'entity' | 'applyHourglassMigrationCommit'
>;

function assertExecutionCapabilities(context: AccessContext): void {
  assertCapability(context, 'people.read');
  assertCapability(context, 'people.write');
  assertCapability(context, 'eligibility.read');
  assertCapability(context, 'eligibility.write');
}

function normalizeAttempt(attempt: Readonly<HourglassExecutionAttempt>): Readonly<HourglassExecutionAttempt> {
  const executionId = attempt.executionId.trim();
  if (!/^[A-Za-z0-9._~-]{8,120}$/.test(executionId)) throw new Error('Invalid Hourglass execution identity');
  if (!Number.isFinite(Date.parse(attempt.initiatedAt))) throw new Error('Invalid Hourglass execution timestamp');
  return Object.freeze({ executionId, initiatedAt: attempt.initiatedAt });
}

export function createHourglassExecutionAttempt(): Readonly<HourglassExecutionAttempt> {
  return Object.freeze({ executionId: crypto.randomUUID(), initiatedAt: new Date().toISOString() });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function stableId(scope: string, context: AccessContext, attempt: Readonly<HourglassExecutionAttempt>, discriminator = ''): Promise<string> {
  const digest = await sha256(`${context.tenantId}\u001f${attempt.executionId}\u001f${scope}\u001f${discriminator}`);
  return `${scope}-${digest.slice(0, 32)}`;
}

function storedPerson(row: EntityRow, tenantId: string): Readonly<CongregationPerson> {
  if (row.tenant_id !== tenantId || row.entity_type !== 'person' || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error('Invalid stored Hourglass execution person');
  }
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored Hourglass execution person identity');
  return Object.freeze(structuredClone(data)) as Readonly<CongregationPerson>;
}

function explicitHourglassEligibility(person: Readonly<CongregationPerson>): readonly string[] {
  const ids = [...new Set(person.eligibility.map(decision => decision.assignmentTypeId).filter(id => id.startsWith('hourglass:')))];
  return Object.freeze(ids.filter(id => latestEligibilityDecision(person.eligibility, id)?.enabled === true).sort());
}

function existingHourglassPeople(tenantId: string, people: readonly Readonly<CongregationPerson>[]): readonly ExistingHourglassPerson[] {
  const rows: ExistingHourglassPerson[] = [];
  for (const person of people) {
    if (person.tenantId !== tenantId) throw new Error('Cross-tenant Hourglass execution person');
    for (const externalId of person.externalIds ?? []) {
      if (!externalId.startsWith(HOURGLASS_EXTERNAL_ID_PREFIX)) continue;
      rows.push(Object.freeze({
        tenantId,
        externalId,
        personId: person.id,
        displayName: person.displayName,
        active: person.active,
        explicitAssignmentTypeIds: explicitHourglassEligibility(person),
      }));
    }
  }
  return Object.freeze(rows);
}

function previewFor(
  inspection: Readonly<HourglassImportInspection>,
  context: AccessContext,
  people: readonly Readonly<CongregationPerson>[],
): Readonly<HourglassMigrationPreview> {
  return previewHourglassImport(inspection, context.tenantId, existingHourglassPeople(context.tenantId, people));
}

async function confirmationDigest(preview: Readonly<HourglassMigrationPreview>): Promise<string> {
  return sha256(JSON.stringify(preview));
}

function normalizeConfirmationDigest(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error('Invalid Hourglass confirmation digest');
  return normalized;
}

function storedReplayIds(row: EntityRow | undefined, tenantId: string, migrationId: string): ReadonlySet<string> {
  if (!row) return new Set<string>();
  if (row.tenant_id !== tenantId || row.entity_type !== 'hourglass-migration' || row.entity_id !== migrationId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error('Invalid stored Hourglass migration identity');
  }
  const data = row.data as Readonly<Record<string, unknown>>;
  const log = data.log;
  const postCommitSteps = data.postCommitSteps;
  if (!log || typeof log !== 'object' || Array.isArray(log) || !Array.isArray(postCommitSteps)) throw new Error('Invalid stored Hourglass migration state');
  const logRecord = log as Readonly<Record<string, unknown>>;
  if (logRecord.tenantId !== tenantId || logRecord.migrationId !== migrationId) throw new Error('Cross-tenant stored Hourglass migration');
  if (logRecord.status === 'rolled-back') throw new Error('Hourglass migration was rolled back');
  if (logRecord.status !== 'completed') throw new Error('Hourglass migration is not completed');
  const ids = new Set<string>();
  for (const raw of postCommitSteps) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid stored Hourglass migration replay evidence');
    const step = raw as Readonly<Record<string, unknown>>;
    if (step.kind !== 'create' || typeof step.internalId !== 'string' || !step.internalId.trim()) throw new Error('Invalid stored Hourglass migration replay evidence');
    if (ids.has(step.internalId)) throw new Error('Duplicate stored Hourglass migration replay identity');
    ids.add(step.internalId);
  }
  return ids;
}

export async function prepareHourglassExecution(
  database: HourglassExecutionDatabase,
  context: AccessContext,
  inspection: Readonly<HourglassImportInspection>,
  attempt: Readonly<HourglassExecutionAttempt> = createHourglassExecutionAttempt(),
): Promise<Readonly<HourglassExecutionPreparation>> {
  assertExecutionCapabilities(context);
  const normalizedAttempt = normalizeAttempt(attempt);
  const rows = await database.entities(context.tenantId, 'person');
  const people = Object.freeze(rows.map(row => storedPerson(row, context.tenantId)));
  const preview = previewFor(inspection, context, people);
  return Object.freeze({
    attempt: normalizedAttempt,
    confirmationDigest: await confirmationDigest(preview),
    counts: preview.counts,
  });
}

function expectedCreatedPerson(
  context: AccessContext,
  attempt: Readonly<HourglassExecutionAttempt>,
  personId: string,
  externalId: string,
  displayName: string,
  assignmentTypeIds: readonly string[],
): Readonly<CongregationPerson> {
  return Object.freeze({
    id: personId,
    tenantId: context.tenantId,
    displayName,
    active: false,
    externalIds: Object.freeze([externalId]),
    availability: Object.freeze([]),
    eligibility: Object.freeze(assignmentTypeIds.map(assignmentTypeId => Object.freeze({
      assignmentTypeId,
      enabled: true,
      decidedBy: context.actorId,
      decidedAt: attempt.initiatedAt,
    }))),
    emergencyContacts: Object.freeze([]),
  });
}

function assertCreatedPerson(actual: Readonly<CongregationPerson> | undefined, expected: Readonly<CongregationPerson>): void {
  if (!actual || actual.id !== expected.id || actual.tenantId !== expected.tenantId || actual.displayName !== expected.displayName || actual.active !== false) {
    throw new Error('Hourglass execution verification failed');
  }
  if (JSON.stringify(actual.externalIds ?? []) !== JSON.stringify(expected.externalIds ?? [])) throw new Error('Hourglass execution external reference verification failed');
  if (JSON.stringify(actual.availability) !== JSON.stringify(expected.availability)) throw new Error('Hourglass execution availability verification failed');
  if (JSON.stringify(actual.eligibility) !== JSON.stringify(expected.eligibility)) throw new Error('Hourglass execution eligibility verification failed');
  if (JSON.stringify(actual.emergencyContacts ?? []) !== JSON.stringify(expected.emergencyContacts ?? [])) throw new Error('Hourglass execution emergency-contact verification failed');
}

export async function executeHourglassImport(
  database: HourglassExecutionDatabase,
  context: AccessContext,
  inspection: Readonly<HourglassImportInspection>,
  confirmationDigestInput: string,
  attemptInput: Readonly<HourglassExecutionAttempt>,
): Promise<Readonly<HourglassExecutionResult>> {
  assertExecutionCapabilities(context);
  const attempt = normalizeAttempt(attemptInput);
  const expectedConfirmation = normalizeConfirmationDigest(confirmationDigestInput);
  const migrationId = await stableId('hourglass-migration', context, attempt);
  const [rows, storedMigration] = await Promise.all([
    database.entities(context.tenantId, 'person'),
    database.entity(context.tenantId, 'hourglass-migration', migrationId),
  ]);
  const replayIds = storedReplayIds(storedMigration, context.tenantId, migrationId);
  const currentPeople = Object.freeze(rows.map(row => storedPerson(row, context.tenantId)));
  const effectivePeople = replayIds.size
    ? Object.freeze(currentPeople.filter(person => !replayIds.has(person.id)))
    : currentPeople;
  const preview = previewFor(inspection, context, effectivePeople);
  if (await confirmationDigest(preview) !== expectedConfirmation) throw new Error('Hourglass confirmation is stale');
  if (preview.counts.conflict > 0) throw new Error('Hourglass preview contains unresolved conflicts');

  const creates = preview.persons.filter(person => person.action === 'create');
  if (creates.length === 0) {
    return Object.freeze({ outcome: 'no-op', createdCount: 0, unchangedCount: preview.counts.unchanged });
  }

  const personChanges: Array<Readonly<{ kind: 'create'; id: string; data: Readonly<CongregationPerson> }>> = [];
  const rollbackSteps: Array<Readonly<{ type: 'delete'; internalId: string }>> = [];
  let log = createMigrationLog({ tenantId: context.tenantId, migrationId, startedAt: attempt.initiatedAt });

  for (const person of creates) {
    const personId = await stableId('person', context, attempt, person.externalId);
    const operationId = await stableId('migration-operation', context, attempt, person.externalId);
    const data = expectedCreatedPerson(context, attempt, personId, person.externalId, person.displayName, person.explicitAssignmentTypeIds);
    personChanges.push(Object.freeze({ kind: 'create', id: personId, data }));
    rollbackSteps.push(Object.freeze({ type: 'delete', internalId: personId }));
    log = appendMigrationOperation(log, { operationId, kind: 'create', internalId: personId, executedAt: attempt.initiatedAt });
  }

  log = finishMigration(log, 'completed', attempt.initiatedAt);
  const rollbackPlan = createRollbackPlan({ tenantId: context.tenantId, migrationId, steps: rollbackSteps });
  const audit = createAuditEvent({
    id: await stableId('audit', context, attempt),
    tenantId: context.tenantId,
    resourceType: 'migration',
    resourceId: migrationId,
    action: 'create',
    actorId: context.actorId,
    occurredAt: attempt.initiatedAt,
    changedFields: ['operations'],
  });
  const event = createDomainEvent({
    id: await stableId('event', context, attempt),
    tenantId: context.tenantId,
    type: 'MigrationApplied',
    aggregateId: migrationId,
    actorId: context.actorId,
    occurredAt: attempt.initiatedAt,
    schemaVersion: 1,
  });

  const committed = await database.applyHourglassMigrationCommit({
    p_tenant_id: context.tenantId,
    p_migration: Object.freeze({ log, rollbackPlan, audit, event }),
    p_person_changes: Object.freeze(personChanges),
  });

  const verifiedRows = await database.entities(context.tenantId, 'person');
  const verifiedPeople = new Map(verifiedRows.map(row => {
    const person = storedPerson(row, context.tenantId);
    return [person.id, person] as const;
  }));
  for (const change of personChanges) assertCreatedPerson(verifiedPeople.get(change.id), change.data);

  return Object.freeze({
    outcome: committed.outcome,
    migrationId,
    createdCount: personChanges.length,
    unchangedCount: preview.counts.unchanged,
  });
}

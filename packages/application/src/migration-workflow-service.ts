import {
  assertCapability,
  createAuditEvent,
  createDomainEvent,
  type AccessContext,
  type AuditEvent,
  type DomainEvent,
} from '@eutaktos/domain';
import { appendMigrationOperation, createMigrationLog, createRollbackPlan, finishMigration, markMigrationRolledBack, type MigrationLog, type RollbackPlan } from './migration-log';
import { previewMigration, type ExistingMigrationPerson, type MigrationPreview } from './migration-preview';
import type { MigrationPersonRow } from './migration-schema';
import { eventCorrelation, type RequestMetadata } from './people-service';

export interface MigrationPersonChange {
  readonly kind: 'create' | 'update';
  readonly internalId: string;
  readonly source: Readonly<MigrationPersonRow>;
}

export interface StoredMigration {
  readonly log: Readonly<MigrationLog>;
  readonly rollbackPlan: Readonly<RollbackPlan>;
}

export interface MigrationWorkflowChange {
  readonly changes: readonly Readonly<MigrationPersonChange>[];
  readonly log: Readonly<MigrationLog>;
  readonly rollbackPlan: Readonly<RollbackPlan>;
  readonly auditEvents: readonly Readonly<AuditEvent>[];
  readonly domainEvents: readonly Readonly<DomainEvent>[];
}

export interface MigrationRollbackChange {
  readonly rollbackPlan: Readonly<RollbackPlan>;
  readonly log: Readonly<MigrationLog>;
  readonly auditEvents: readonly Readonly<AuditEvent>[];
  readonly domainEvents: readonly Readonly<DomainEvent>[];
}

export interface MigrationWorkflowUnitOfWork {
  listExistingPeople(context: AccessContext): readonly Readonly<ExistingMigrationPerson>[];
  commitMigration(context: AccessContext, change: MigrationWorkflowChange): void;
  findMigration(context: AccessContext, migrationId: string): Readonly<StoredMigration> | undefined;
  commitRollback(context: AccessContext, change: MigrationRollbackChange): void;
}

export interface MigrationWorkflowRuntime {
  now(): string;
  nextId(scope: 'migration' | 'migration-operation' | 'person' | 'audit' | 'event'): string;
}

export interface PreparedMigration {
  readonly preview: Readonly<MigrationPreview>;
  readonly confirmation: string;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 5_000_000) throw new Error(`${field} is too long`);
  return normalized;
}

function confirmationFor(preview: Readonly<MigrationPreview>, existing: readonly Readonly<ExistingMigrationPerson>[]): string {
  const byId = new Map(existing.map(person => [person.id, person]));
  return JSON.stringify(preview.items.map(item => {
    const target = item.targetId ? byId.get(item.targetId) : undefined;
    return {
      externalId: item.externalId,
      action: item.action,
      targetId: item.targetId ?? null,
      targetBefore: target ? {
        externalId: target.externalId,
        displayName: target.displayName,
        active: target.active,
        preferredLocale: target.preferredLocale ?? null,
      } : null,
      requested: {
        displayName: item.source.displayName,
        active: item.source.active,
        preferredLocale: item.source.preferredLocale ?? null,
      },
    };
  }));
}

export class MigrationWorkflowService {
  readonly #uow: MigrationWorkflowUnitOfWork;
  readonly #runtime: MigrationWorkflowRuntime;

  constructor(uow: MigrationWorkflowUnitOfWork, runtime: MigrationWorkflowRuntime) {
    this.#uow = uow; this.#runtime = runtime;
  }

  prepare(context: AccessContext, rows: readonly Readonly<MigrationPersonRow>[]): Readonly<PreparedMigration> {
    assertCapability(context, 'people.write');
    const existing = this.#uow.listExistingPeople(context);
    const preview = previewMigration(rows, existing);
    return Object.freeze({ preview, confirmation: confirmationFor(preview, existing) });
  }

  execute(context: AccessContext, rows: readonly Readonly<MigrationPersonRow>[], confirmationInput: string, metadata: RequestMetadata = {}): Readonly<StoredMigration> {
    assertCapability(context, 'people.write');
    const confirmation = required(confirmationInput, 'confirmation');
    const existing = this.#uow.listExistingPeople(context);
    const preview = previewMigration(rows, existing);
    if (preview.counts.conflict || preview.counts.error) throw new Error('Migration preview contains unresolved conflicts or errors');
    if (confirmation !== confirmationFor(preview, existing)) throw new Error('Migration confirmation is stale or does not match the current preview');

    const byExternalId = new Map(existing.map(person => [person.externalId, person]));
    const changes: MigrationPersonChange[] = [];
    const rollbackSteps: { type: 'delete' | 'restore'; internalId: string; restore?: { externalId: string; displayName: string; active: boolean; preferredLocale?: string } }[] = [];
    for (const item of preview.items) {
      if (item.action === 'skip') continue;
      if (item.action === 'create') {
        const internalId = this.#runtime.nextId('person');
        changes.push(Object.freeze({ kind: 'create', internalId, source: item.source }));
        rollbackSteps.push({ type: 'delete', internalId });
        continue;
      }
      if (item.action !== 'update' || !item.targetId) throw new Error('Migration preview contains an unsupported action');
      const before = byExternalId.get(item.externalId);
      if (!before || before.id !== item.targetId) throw new Error('Migration target changed after preview');
      changes.push(Object.freeze({ kind: 'update', internalId: item.targetId, source: item.source }));
      rollbackSteps.push({ type: 'restore', internalId: item.targetId, restore: { externalId: before.externalId, displayName: before.displayName, active: before.active, ...(before.preferredLocale ? { preferredLocale: before.preferredLocale } : {}) } });
    }

    const at = this.#runtime.now();
    const migrationId = this.#runtime.nextId('migration');
    let log = createMigrationLog({ tenantId: context.tenantId, migrationId, startedAt: at });
    for (const change of changes) {
      log = appendMigrationOperation(log, { operationId: this.#runtime.nextId('migration-operation'), kind: change.kind, internalId: change.internalId, executedAt: at });
    }
    log = finishMigration(log, 'completed', at);
    const rollbackPlan = createRollbackPlan({ tenantId: context.tenantId, migrationId, steps: rollbackSteps });
    const audit = createAuditEvent({ id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'migration', resourceId: migrationId, action: 'create', actorId: context.actorId, occurredAt: at, changedFields: ['operations'] });
    const event = createDomainEvent({ id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'MigrationApplied', aggregateId: migrationId, actorId: context.actorId, occurredAt: at, schemaVersion: 1, ...eventCorrelation(metadata) });
    this.#uow.commitMigration(context, { changes: Object.freeze(changes), log, rollbackPlan, auditEvents: [audit], domainEvents: [event] });
    return Object.freeze({ log, rollbackPlan });
  }

  rollback(context: AccessContext, migrationIdInput: string, metadata: RequestMetadata = {}): Readonly<MigrationLog> {
    assertCapability(context, 'people.write');
    const migrationId = required(migrationIdInput, 'migrationId');
    const stored = this.#uow.findMigration(context, migrationId);
    if (!stored) throw new Error('Migration not found');
    if (stored.log.tenantId !== context.tenantId || stored.rollbackPlan.tenantId !== context.tenantId) throw new Error('Cross-tenant migration access denied');
    const at = this.#runtime.now();
    const log = markMigrationRolledBack(stored.log, at);
    const audit = createAuditEvent({ id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'migration', resourceId: migrationId, action: 'update', actorId: context.actorId, occurredAt: at, changedFields: ['status'] });
    const event = createDomainEvent({ id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'MigrationRolledBack', aggregateId: migrationId, actorId: context.actorId, occurredAt: at, schemaVersion: 1, ...eventCorrelation(metadata) });
    this.#uow.commitRollback(context, { rollbackPlan: stored.rollbackPlan, log, auditEvents: [audit], domainEvents: [event] });
    return log;
  }
}

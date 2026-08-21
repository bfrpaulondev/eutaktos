export type MigrationOperationType = 'create' | 'update';

export interface MigrationOperation {
  sequence: number;
  externalId: string;
  type: MigrationOperationType;
  internalId?: string;
  beforeSnapshot?: { displayName: string; active: boolean };
  afterSnapshot: { displayName: string; active: boolean; preferredLocale?: string };
  executedAt?: string;
}

export type MigrationLogStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled-back';

export interface MigrationLog {
  tenantId: string;
  migrationId: string;
  startedAt: string;
  completedAt?: string;
  status: MigrationLogStatus;
  operations: readonly MigrationOperation[];
}

export interface RollbackPlan {
  migrationId: string;
  canRollback: boolean;
  steps: readonly RollbackStep[];
}

export interface RollbackStep {
  sequence: number;
  externalId: string;
  type: 'delete' | 'revert';
  internalId?: string;
  revertTo?: { displayName: string; active: boolean };
}

export function createMigrationLog(tenantId: string, migrationId: string): MigrationLog {
  return {
    tenantId,
    migrationId,
    startedAt: new Date().toISOString(),
    status: 'pending',
    operations: [],
  };
}

export function addOperation(
  log: MigrationLog,
  operation: Omit<MigrationOperation, 'sequence'>,
): MigrationLog {
  const nextSequence = log.operations.length + 1;
  const newOperation: MigrationOperation = {
    ...operation,
    sequence: nextSequence,
  };

  return {
    ...log,
    operations: [...log.operations, newOperation],
  };
}

export function completeMigration(log: MigrationLog): MigrationLog {
  return {
    ...log,
    status: 'completed',
    completedAt: new Date().toISOString(),
  };
}

export function failMigration(log: MigrationLog): MigrationLog {
  return {
    ...log,
    status: 'failed',
  };
}

export function generateRollbackPlan(log: MigrationLog): RollbackPlan {
  const ops = log.operations;

  if (ops.length === 0) {
    return {
      migrationId: log.migrationId,
      canRollback: true,
      steps: [],
    };
  }

  let canRollback = true;
  const steps: RollbackStep[] = [];

  // Iterate in REVERSE order
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];

    if (op.type === 'create') {
      // For create: rollback is delete
      if (!op.internalId) {
        canRollback = false;
      }
      steps.push({
        sequence: ops.length - i, // 1-based sequence for rollback steps
        externalId: op.externalId,
        type: 'delete',
        internalId: op.internalId,
      });
    } else {
      // For update: rollback is revert
      if (!op.internalId || !op.beforeSnapshot) {
        canRollback = false;
      }
      steps.push({
        sequence: ops.length - i,
        externalId: op.externalId,
        type: 'revert',
        internalId: op.internalId,
        revertTo: op.beforeSnapshot,
      });
    }
  }

  return {
    migrationId: log.migrationId,
    canRollback,
    steps,
  };
}

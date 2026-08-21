import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMigrationLog,
  addOperation,
  completeMigration,
  failMigration,
  generateRollbackPlan,
  type MigrationLog,
} from './migration-log';

describe('migration-log', () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-06-15T12:00:00.000Z');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- createMigrationLog ---

  describe('createMigrationLog', () => {
    it('creates a log with pending status and empty operations', () => {
      const log = createMigrationLog('tenant-1', 'mig-1');

      expect(log.tenantId).toBe('tenant-1');
      expect(log.migrationId).toBe('mig-1');
      expect(log.startedAt).toBe('2025-06-15T12:00:00.000Z');
      expect(log.status).toBe('pending');
      expect(log.operations).toEqual([]);
      expect(log.completedAt).toBeUndefined();
    });
  });

  // --- addOperation ---

  describe('addOperation', () => {
    it('adds first operation with sequence 1', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        afterSnapshot: { displayName: 'Alice', active: true },
      });

      expect(log.operations).toHaveLength(1);
      expect(log.operations[0].sequence).toBe(1);
      expect(log.operations[0].externalId).toBe('ext-1');
      expect(log.operations[0].type).toBe('create');
    });

    it('auto-increments sequence for multiple operations', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        afterSnapshot: { displayName: 'Alice', active: true },
      });
      log = addOperation(log, {
        externalId: 'ext-2',
        type: 'update',
        beforeSnapshot: { displayName: 'Old Bob', active: true },
        afterSnapshot: { displayName: 'New Bob', active: false },
      });
      log = addOperation(log, {
        externalId: 'ext-3',
        type: 'create',
        afterSnapshot: { displayName: 'Carol', active: true },
      });

      expect(log.operations[0].sequence).toBe(1);
      expect(log.operations[1].sequence).toBe(2);
      expect(log.operations[2].sequence).toBe(3);
    });

    it('preserves operation fields', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'update',
        internalId: 'int-123',
        beforeSnapshot: { displayName: 'Old', active: true },
        afterSnapshot: { displayName: 'New', active: false, preferredLocale: 'en' },
        executedAt: '2025-06-15T12:01:00.000Z',
      });

      const op = log.operations[0];
      expect(op.internalId).toBe('int-123');
      expect(op.beforeSnapshot).toEqual({ displayName: 'Old', active: true });
      expect(op.afterSnapshot).toEqual({ displayName: 'New', active: false, preferredLocale: 'en' });
      expect(op.executedAt).toBe('2025-06-15T12:01:00.000Z');
    });
  });

  // --- Immutability ---

  describe('immutability', () => {
    it('addOperation returns a new log without mutating the original', () => {
      const log = createMigrationLog('t1', 'm1');
      const log2 = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        afterSnapshot: { displayName: 'A', active: true },
      });

      expect(log.operations).toHaveLength(0);
      expect(log2.operations).toHaveLength(1);
    });

    it('completeMigration returns a new log without mutating', () => {
      const log = createMigrationLog('t1', 'm1');
      const log2 = completeMigration(log);

      expect(log.status).toBe('pending');
      expect(log.completedAt).toBeUndefined();
      expect(log2.status).toBe('completed');
      expect(log2.completedAt).toBe('2025-06-15T12:00:00.000Z');
    });

    it('failMigration returns a new log without mutating', () => {
      const log = createMigrationLog('t1', 'm1');
      const log2 = failMigration(log);

      expect(log.status).toBe('pending');
      expect(log2.status).toBe('failed');
    });
  });

  // --- completeMigration ---

  describe('completeMigration', () => {
    it('sets status to completed and adds completedAt', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        afterSnapshot: { displayName: 'A', active: true },
      });
      log = completeMigration(log);

      expect(log.status).toBe('completed');
      expect(log.completedAt).toBe('2025-06-15T12:00:00.000Z');
      expect(log.operations).toHaveLength(1);
    });
  });

  // --- failMigration ---

  describe('failMigration', () => {
    it('sets status to failed without completedAt', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        afterSnapshot: { displayName: 'A', active: true },
      });
      log = failMigration(log);

      expect(log.status).toBe('failed');
      expect(log.completedAt).toBeUndefined();
    });
  });

  // --- generateRollbackPlan ---

  describe('generateRollbackPlan', () => {
    it('returns empty steps for log with no operations', () => {
      const log = createMigrationLog('t1', 'm1');
      const plan = generateRollbackPlan(log);

      expect(plan.canRollback).toBe(true);
      expect(plan.steps).toEqual([]);
      expect(plan.migrationId).toBe('m1');
    });

    it('generates delete steps for create operations in reverse order', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        internalId: 'int-1',
        afterSnapshot: { displayName: 'Alice', active: true },
      });
      log = addOperation(log, {
        externalId: 'ext-2',
        type: 'create',
        internalId: 'int-2',
        afterSnapshot: { displayName: 'Bob', active: true },
      });

      const plan = generateRollbackPlan(log);

      expect(plan.canRollback).toBe(true);
      expect(plan.steps).toHaveLength(2);
      // Reverse order: ext-2 first, then ext-1
      expect(plan.steps[0].type).toBe('delete');
      expect(plan.steps[0].externalId).toBe('ext-2');
      expect(plan.steps[0].internalId).toBe('int-2');
      expect(plan.steps[1].type).toBe('delete');
      expect(plan.steps[1].externalId).toBe('ext-1');
      expect(plan.steps[1].internalId).toBe('int-1');
    });

    it('generates revert steps for update operations in reverse order', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'update',
        internalId: 'int-1',
        beforeSnapshot: { displayName: 'Old Alice', active: true },
        afterSnapshot: { displayName: 'New Alice', active: false },
      });

      const plan = generateRollbackPlan(log);

      expect(plan.canRollback).toBe(true);
      expect(plan.steps[0].type).toBe('revert');
      expect(plan.steps[0].externalId).toBe('ext-1');
      expect(plan.steps[0].internalId).toBe('int-1');
      expect(plan.steps[0].revertTo).toEqual({ displayName: 'Old Alice', active: true });
    });

    it('handles mixed create and update operations in reverse order', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        internalId: 'int-1',
        afterSnapshot: { displayName: 'Alice', active: true },
      });
      log = addOperation(log, {
        externalId: 'ext-2',
        type: 'update',
        internalId: 'int-2',
        beforeSnapshot: { displayName: 'Old Bob', active: true },
        afterSnapshot: { displayName: 'New Bob', active: false },
      });
      log = addOperation(log, {
        externalId: 'ext-3',
        type: 'create',
        internalId: 'int-3',
        afterSnapshot: { displayName: 'Carol', active: true },
      });

      const plan = generateRollbackPlan(log);

      expect(plan.canRollback).toBe(true);
      expect(plan.steps).toHaveLength(3);
      // Reverse order: ext-3 (delete), ext-2 (revert), ext-1 (delete)
      expect(plan.steps[0].type).toBe('delete');
      expect(plan.steps[0].externalId).toBe('ext-3');
      expect(plan.steps[1].type).toBe('revert');
      expect(plan.steps[1].externalId).toBe('ext-2');
      expect(plan.steps[2].type).toBe('delete');
      expect(plan.steps[2].externalId).toBe('ext-1');
    });

    it('canRollback is false when create operation missing internalId', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        afterSnapshot: { displayName: 'Alice', active: true },
        // no internalId
      });

      const plan = generateRollbackPlan(log);

      expect(plan.canRollback).toBe(false);
      expect(plan.steps[0].type).toBe('delete');
      expect(plan.steps[0].internalId).toBeUndefined();
    });

    it('canRollback is false when update operation missing beforeSnapshot', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'update',
        internalId: 'int-1',
        // no beforeSnapshot
        afterSnapshot: { displayName: 'New Alice', active: false },
      });

      const plan = generateRollbackPlan(log);

      expect(plan.canRollback).toBe(false);
      expect(plan.steps[0].type).toBe('revert');
      expect(plan.steps[0].revertTo).toBeUndefined();
    });

    it('canRollback is false when update missing internalId', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'update',
        beforeSnapshot: { displayName: 'Old', active: true },
        afterSnapshot: { displayName: 'New', active: false },
        // no internalId
      });

      const plan = generateRollbackPlan(log);

      expect(plan.canRollback).toBe(false);
    });

    it('canRollback is false if any operation is incomplete in a batch', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        internalId: 'int-1',
        afterSnapshot: { displayName: 'Alice', active: true },
      });
      log = addOperation(log, {
        externalId: 'ext-2',
        type: 'create',
        afterSnapshot: { displayName: 'Bob', active: true },
        // missing internalId
      });

      const plan = generateRollbackPlan(log);

      expect(plan.canRollback).toBe(false);
    });

    it('assigns sequential sequence numbers to rollback steps', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        internalId: 'int-1',
        afterSnapshot: { displayName: 'A', active: true },
      });
      log = addOperation(log, {
        externalId: 'ext-2',
        type: 'create',
        internalId: 'int-2',
        afterSnapshot: { displayName: 'B', active: true },
      });

      const plan = generateRollbackPlan(log);

      expect(plan.steps[0].sequence).toBe(1);
      expect(plan.steps[1].sequence).toBe(2);
    });

    it('does not mutate the original log', () => {
      let log = createMigrationLog('t1', 'm1');
      log = addOperation(log, {
        externalId: 'ext-1',
        type: 'create',
        internalId: 'int-1',
        afterSnapshot: { displayName: 'A', active: true },
      });

      const plan = generateRollbackPlan(log);

      // Log should still have the original operations
      expect(log.operations).toHaveLength(1);
      expect(log.status).toBe('pending');
    });

    it('includes migrationId from the log', () => {
      const log = createMigrationLog('t1', 'unique-mig-id');
      const plan = generateRollbackPlan(log);

      expect(plan.migrationId).toBe('unique-mig-id');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  previewMigration,
  type MigrationPersonRow,
  type MigrationPreviewOptions,
} from './migration-preview';

function validRow(overrides: Partial<MigrationPersonRow> = {}): MigrationPersonRow {
  return {
    externalId: 'ext-1',
    displayName: 'Alice Johnson',
    active: true,
    normalizedDisplayName: 'Alice Johnson',
    validationErrors: [],
    isValid: true,
    ...overrides,
  };
}

function emptyOptions(): MigrationPreviewOptions {
  return {
    existingExternalIds: new Map(),
    existingDisplayNames: new Set(),
  };
}

function optionsWith(
  entries: Array<[string, { displayName: string; active: boolean }]>,
): MigrationPreviewOptions {
  return {
    existingExternalIds: new Map(entries),
    existingDisplayNames: new Set(entries.map(([, v]) => v.displayName)),
  };
}

describe('migration-preview', () => {
  describe('previewMigration', () => {
    // --- All create ---

    it('classifies all rows as create when no existing records', () => {
      const rows = [
        validRow({ externalId: 'ext-1' }),
        validRow({ externalId: 'ext-2' }),
        validRow({ externalId: 'ext-3' }),
      ];

      const result = previewMigration(rows, emptyOptions());

      expect(result.summary).toEqual({
        total: 3,
        create: 3,
        update: 0,
        skip: 0,
        conflict: 0,
        invalid: 0,
      });
      expect(result.actions[0].action).toBe('create');
      expect(result.actions[1].action).toBe('create');
      expect(result.actions[2].action).toBe('create');
    });

    // --- All skip ---

    it('classifies rows as skip when no changes detected', () => {
      const rows = [
        validRow({ externalId: 'ext-1', normalizedDisplayName: 'Alice', active: true }),
        validRow({ externalId: 'ext-2', normalizedDisplayName: 'Bob', active: false }),
      ];

      const options = optionsWith([
        ['ext-1', { displayName: 'Alice', active: true }],
        ['ext-2', { displayName: 'Bob', active: false }],
      ]);

      const result = previewMigration(rows, options);

      expect(result.summary.skip).toBe(2);
      expect(result.actions[0].reason).toBe('No changes detected');
    });

    // --- Mix of actions ---

    it('handles a mix of create, update, skip, conflict, and invalid', () => {
      const rows = [
        validRow({ externalId: 'ext-1' }), // create
        validRow({ externalId: 'ext-2', normalizedDisplayName: 'Alice Updated', active: true }), // update (name)
        validRow({ externalId: 'ext-3', normalizedDisplayName: 'Bob', active: false }), // skip (same)
        validRow({ externalId: 'ext-4', normalizedDisplayName: 'Carol New', active: true }), // conflict
        validRow({ externalId: 'ext-5', isValid: false, validationErrors: ['missing name'] }), // invalid
        validRow({ externalId: 'ext-6', normalizedDisplayName: 'Dave', active: false }), // update (active)
      ];

      const options = optionsWith([
        ['ext-2', { displayName: 'Alice Old', active: true }],
        ['ext-3', { displayName: 'Bob', active: false }],
        ['ext-4', { displayName: 'Carol Old', active: false }],
        ['ext-6', { displayName: 'Dave', active: true }],
      ]);

      const result = previewMigration(rows, options);

      expect(result.summary).toEqual({
        total: 6,
        create: 1,
        update: 2,
        skip: 1,
        conflict: 1,
        invalid: 1,
      });
      expect(result.actions[0].action).toBe('create');
      expect(result.actions[1].action).toBe('update');
      expect(result.actions[2].action).toBe('skip');
      expect(result.actions[3].action).toBe('conflict');
      expect(result.actions[4].action).toBe('invalid');
      expect(result.actions[5].action).toBe('update');
    });

    // --- Invalid rows ---

    it('classifies invalid rows with joined validation errors', () => {
      const rows = [
        validRow({
          externalId: 'ext-bad',
          isValid: false,
          validationErrors: ['displayName too long', 'invalid locale'],
        }),
      ];

      const result = previewMigration(rows, emptyOptions());

      expect(result.actions[0].action).toBe('invalid');
      expect(result.actions[0].reason).toBe('displayName too long; invalid locale');
    });

    it('handles empty validation errors on invalid row', () => {
      const rows = [
        validRow({ externalId: 'ext-bad', isValid: false, validationErrors: [] }),
      ];

      const result = previewMigration(rows, emptyOptions());

      expect(result.actions[0].action).toBe('invalid');
      expect(result.actions[0].reason).toBe('');
    });

    // --- Conflict detection ---

    it('detects conflict when both name and active differ', () => {
      const rows = [
        validRow({
          externalId: 'ext-c',
          normalizedDisplayName: 'New Name',
          active: true,
        }),
      ];

      const options = optionsWith([
        ['ext-c', { displayName: 'Old Name', active: false }],
      ]);

      const result = previewMigration(rows, options);

      expect(result.actions[0].action).toBe('conflict');
      expect(result.actions[0].reason).toBe('Multiple fields differ');
    });

    // --- Update detection ---

    it('detects name change as update', () => {
      const rows = [
        validRow({ externalId: 'ext-u', normalizedDisplayName: 'New Alice' }),
      ];

      const options = optionsWith([
        ['ext-u', { displayName: 'Old Alice', active: true }],
      ]);

      const result = previewMigration(rows, options);

      expect(result.actions[0].action).toBe('update');
      expect(result.actions[0].reason).toBe('Name change: Old Alice → New Alice');
    });

    it('detects active status change as update', () => {
      const rows = [
        validRow({ externalId: 'ext-a', normalizedDisplayName: 'Same', active: false }),
      ];

      const options = optionsWith([
        ['ext-a', { displayName: 'Same', active: true }],
      ]);

      const result = previewMigration(rows, options);

      expect(result.actions[0].action).toBe('update');
      expect(result.actions[0].reason).toBe('Active status change');
    });

    // --- Empty input ---

    it('handles empty input', () => {
      const result = previewMigration([], emptyOptions());

      expect(result.actions).toEqual([]);
      expect(result.summary).toEqual({
        total: 0,
        create: 0,
        update: 0,
        skip: 0,
        conflict: 0,
        invalid: 0,
      });
    });

    // --- Deterministic output ---

    it('produces deterministic output sorted by externalId', () => {
      const rows = [
        validRow({ externalId: 'charlie' }),
        validRow({ externalId: 'alice' }),
        validRow({ externalId: 'bob' }),
      ];

      const result1 = previewMigration(rows, emptyOptions());
      const result2 = previewMigration([...rows].reverse(), emptyOptions());

      expect(result1.actions.map(a => a.externalId)).toEqual([
        'alice', 'bob', 'charlie',
      ]);
      expect(result2.actions.map(a => a.externalId)).toEqual([
        'alice', 'bob', 'charlie',
      ]);
    });

    it('is idempotent — same inputs always produce same outputs', () => {
      const rows = [
        validRow({ externalId: 'z', normalizedDisplayName: 'Z', active: false }),
        validRow({
          externalId: 'a',
          isValid: false,
          validationErrors: ['err'],
          normalizedDisplayName: 'A',
        }),
      ];

      const options = optionsWith([
        ['z', { displayName: 'Z', active: true }],
      ]);

      const r1 = previewMigration(rows, options);
      const r2 = previewMigration(rows, options);

      expect(r1).toEqual(r2);
    });

    // --- Summary counts ---

    it('summary counts match action counts', () => {
      const rows = [
        validRow({ externalId: 'c1' }), // create
        validRow({ externalId: 'c2' }), // create
        validRow({ externalId: 'u1', normalizedDisplayName: 'Updated', active: true }), // update
        validRow({ externalId: 's1', normalizedDisplayName: 'Same' }), // skip
        validRow({
          externalId: 'i1',
          isValid: false,
          validationErrors: ['bad'],
          normalizedDisplayName: 'X',
        }), // invalid
      ];

      const options = optionsWith([
        ['u1', { displayName: 'Old', active: true }],
        ['s1', { displayName: 'Same', active: true }],
      ]);

      const result = previewMigration(rows, options);

      const counted = result.actions.reduce(
        (acc, a) => {
          acc[a.action]++;
          return acc;
        },
        { create: 0, update: 0, skip: 0, conflict: 0, invalid: 0 },
      );

      expect(result.summary.create).toBe(counted.create);
      expect(result.summary.update).toBe(counted.update);
      expect(result.summary.skip).toBe(counted.skip);
      expect(result.summary.conflict).toBe(counted.conflict);
      expect(result.summary.invalid).toBe(counted.invalid);
      expect(result.summary.total).toBe(result.actions.length);
    });

    // --- Immutability ---

    it('does not mutate input rows or options', () => {
      const rows = [validRow({ externalId: 'ext-1' })];
      const options = emptyOptions();
      const originalRows = [...rows];

      previewMigration(rows, options);

      expect(rows).toEqual(originalRows);
      expect(options.existingExternalIds.size).toBe(0);
    });

    // --- Index assignment ---

    it('assigns index based on sorted position, not original position', () => {
      const rows = [
        validRow({ externalId: 'b' }),
        validRow({ externalId: 'a' }),
      ];

      const result = previewMigration(rows, emptyOptions());

      expect(result.actions[0].index).toBe(0);
      expect(result.actions[0].externalId).toBe('a');
      expect(result.actions[1].index).toBe(1);
      expect(result.actions[1].externalId).toBe('b');
    });

    // --- Source preservation ---

    it('preserves the source row reference in each action', () => {
      const row = validRow({ externalId: 'ext-src' });
      const result = previewMigration([row], emptyOptions());

      expect(result.actions[0].source).toBe(row);
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  MIGRATION_SCHEMA_VERSION,
  normalizeMigrationRow,
  validateMigrationSchema,
  createEmptyMigrationSchema,
} from './migration-schema';

describe('MIGRATION_SCHEMA_VERSION', () => {
  it('equals 1', () => {
    expect(MIGRATION_SCHEMA_VERSION).toBe(1);
  });
});

describe('normalizeMigrationRow', () => {
  it('normalizes valid data', () => {
    const result = normalizeMigrationRow({
      externalId: '  ext-123  ',
      displayName: '  John   Doe  ',
      active: true,
      preferredLocale: 'en-US',
    });
    expect(result.externalId).toBe('ext-123');
    expect(result.normalizedDisplayName).toBe('John Doe');
    expect(result.active).toBe(true);
    expect(result.normalizedLocale).toBe('en-US');
    expect(result.isValid).toBe(true);
    expect(result.validationErrors).toHaveLength(0);
  });

  it('reports error for missing externalId', () => {
    const result = normalizeMigrationRow({
      displayName: 'John Doe',
      active: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.validationErrors).toContain('externalId is required');
    expect(result.externalId).toBe('');
  });

  it('reports error for empty externalId after trim', () => {
    const result = normalizeMigrationRow({
      externalId: '   ',
      displayName: 'John Doe',
      active: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.validationErrors).toContain('externalId is required');
  });

  it('reports error for missing displayName', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      active: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.validationErrors).toContain('displayName is required');
    expect(result.normalizedDisplayName).toBe('');
  });

  it('sets normalizedLocale to undefined for invalid locale', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
      active: false,
      preferredLocale: 'not-a-locale!!!',
    });
    expect(result.normalizedLocale).toBeUndefined();
    expect(result.preferredLocale).toBe('not-a-locale!!!');
    expect(result.isValid).toBe(true);
  });

  it('sets normalizedLocale to undefined for empty locale', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
      active: true,
      preferredLocale: '',
    });
    expect(result.normalizedLocale).toBeUndefined();
  });

  it('reports error for non-boolean active', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
      active: 'maybe',
    });
    expect(result.isValid).toBe(false);
    expect(result.validationErrors).toHaveLength(1);
    expect(result.validationErrors[0]).toContain('active');
  });

  it('coerces string "true" to boolean true', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
      active: 'true',
    });
    expect(result.active).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('coerces string "false" to boolean false', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
      active: 'false',
    });
    expect(result.active).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it('coerces string "yes" to boolean true', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
      active: 'yes',
    });
    expect(result.active).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('coerces number 1 to boolean true', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
      active: 1,
    });
    expect(result.active).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('coerces number 0 to boolean false', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
      active: 0,
    });
    expect(result.active).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it('defaults active to false when undefined', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
    });
    expect(result.active).toBe(false);
  });

  it('produces deterministic normalization for same input', () => {
    const input = {
      externalId: '  ext-99  ',
      displayName: '  Alice   Smith  ',
      active: true,
      preferredLocale: '  en-GB  ',
    };
    const first = normalizeMigrationRow(input);
    const second = normalizeMigrationRow(input);
    expect(first).toEqual(second);
  });

  it('collapses multiple whitespace in displayName', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Very   many    spaces   here',
      active: true,
    });
    expect(result.normalizedDisplayName).toBe('Very many spaces here');
  });

  it('reports multiple errors at once', () => {
    const result = normalizeMigrationRow({});
    expect(result.isValid).toBe(false);
    expect(result.validationErrors.length).toBeGreaterThanOrEqual(2);
    expect(result.validationErrors).toContain('externalId is required');
    expect(result.validationErrors).toContain('displayName is required');
  });

  it('normalizes locale case via Intl.Locale', () => {
    const result = normalizeMigrationRow({
      externalId: 'ext-1',
      displayName: 'Jane',
      active: true,
      preferredLocale: 'en-us',
    });
    expect(result.normalizedLocale).toBe('en-US');
  });
});

describe('validateMigrationSchema', () => {
  const validSchema = {
    version: 1,
    exportedAt: '2024-01-15T10:30:00.000Z',
    rows: [
      {
        externalId: 'ext-1',
        displayName: 'John Doe',
        active: true,
        preferredLocale: undefined,
        normalizedDisplayName: 'John Doe',
        normalizedLocale: undefined,
        validationErrors: [],
        isValid: true,
      },
    ],
  };

  it('accepts a valid schema', () => {
    const result = validateMigrationSchema(validSchema);
    expect(result.version).toBe(1);
    expect(result.rows).toHaveLength(1);
  });

  it('rejects wrong version', () => {
    expect(() => validateMigrationSchema({ ...validSchema, version: 2 })).toThrow('version');
  });

  it('rejects missing rows', () => {
    expect(() =>
      validateMigrationSchema({ version: 1, exportedAt: '2024-01-15T10:30:00.000Z' }),
    ).toThrow('rows');
  });

  it('rejects invalid exportedAt', () => {
    expect(() =>
      validateMigrationSchema({ ...validSchema, exportedAt: 'not-a-date' }),
    ).toThrow('exportedAt');
  });

  it('rejects non-object input', () => {
    expect(() => validateMigrationSchema('string')).toThrow('must be an object');
  });

  it('rejects array input', () => {
    expect(() => validateMigrationSchema([])).toThrow('must be an object');
  });

  it('rejects null input', () => {
    expect(() => validateMigrationSchema(null)).toThrow('must be an object');
  });

  it('rejects row with non-string externalId', () => {
    const badRows = [{ externalId: 123, displayName: 'X', active: true }];
    expect(() =>
      validateMigrationSchema({ version: 1, exportedAt: '2024-01-15T10:30:00.000Z', rows: badRows }),
    ).toThrow('rows[0].externalId');
  });

  it('rejects row with non-string displayName', () => {
    const badRows = [{ externalId: 'ext-1', displayName: 42, active: true }];
    expect(() =>
      validateMigrationSchema({ version: 1, exportedAt: '2024-01-15T10:30:00.000Z', rows: badRows }),
    ).toThrow('rows[0].displayName');
  });

  it('rejects row with non-boolean active', () => {
    const badRows = [{ externalId: 'ext-1', displayName: 'X', active: 'true' }];
    expect(() =>
      validateMigrationSchema({ version: 1, exportedAt: '2024-01-15T10:30:00.000Z', rows: badRows }),
    ).toThrow('rows[0].active');
  });

  it('rejects row that is not an object', () => {
    expect(() =>
      validateMigrationSchema({ version: 1, exportedAt: '2024-01-15T10:30:00.000Z', rows: ['string'] }),
    ).toThrow('rows[0] must be an object');
  });

  it('rejects missing version', () => {
    expect(() =>
      validateMigrationSchema({ exportedAt: '2024-01-15T10:30:00.000Z', rows: [] }),
    ).toThrow('version');
  });
});

describe('createEmptyMigrationSchema', () => {
  it('returns a schema with version 1', () => {
    const schema = createEmptyMigrationSchema();
    expect(schema.version).toBe(1);
  });

  it('returns a schema with empty rows', () => {
    const schema = createEmptyMigrationSchema();
    expect(schema.rows).toHaveLength(0);
  });

  it('returns a schema with a valid ISO exportedAt', () => {
    const schema = createEmptyMigrationSchema();
    expect(Number.isFinite(Date.parse(schema.exportedAt))).toBe(true);
  });

  it('returns a schema that passes validation', () => {
    const schema = createEmptyMigrationSchema();
    expect(() => validateMigrationSchema(schema)).not.toThrow();
  });
});

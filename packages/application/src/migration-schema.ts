export const MIGRATION_SCHEMA_VERSION = 1;

export interface MigrationPersonRow {
  // Required fields
  externalId: string;
  displayName: string;
  active: boolean;

  // Optional fields
  preferredLocale?: string;

  // Normalized/canonical fields
  normalizedDisplayName: string;
  normalizedLocale?: string;

  // Validation result
  validationErrors: readonly string[];
  isValid: boolean;
}

export interface MigrationSchema {
  version: number;
  exportedAt: string;
  rows: readonly MigrationPersonRow[];
}

function isValidIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function tryNormalizeLocale(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return new Intl.Locale(trimmed).toString();
  } catch {
    return undefined;
   }
}

function coerceToBoolean(value: unknown): { result: boolean; error?: string } {
  if (typeof value === 'boolean') return { result: value };
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return { result: true };
    if (lower === 'false' || lower === '0' || lower === 'no') return { result: false };
  }
  if (typeof value === 'number') {
    if (value === 1) return { result: true };
    if (value === 0) return { result: false };
  }
  return { result: false, error: 'active must be a boolean, or a string coercible to boolean (true/false/yes/no/1/0)' };
}

export function normalizeMigrationRow(input: {
  externalId?: string;
  displayName?: string;
  active?: unknown;
  preferredLocale?: string;
}): MigrationPersonRow {
  const errors: string[] = [];

  const externalId = (input.externalId ?? '').trim();
  if (!externalId) {
    errors.push('externalId is required');
  }

  const displayName = (input.displayName ?? '').trim().replace(/\s+/g, ' ');
  if (!displayName) {
    errors.push('displayName is required');
  }

  const { result: active, error: activeError } = coerceToBoolean(input.active);
  if (activeError) {
    errors.push(activeError);
  }

  const normalizedLocale = tryNormalizeLocale(input.preferredLocale);

  return {
    externalId,
    displayName,
    active,
    preferredLocale: input.preferredLocale,
    normalizedDisplayName: displayName,
    normalizedLocale,
    validationErrors: errors,
    isValid: errors.length === 0,
  };
}

export function validateMigrationSchema(schema: unknown): MigrationSchema {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    throw new Error('Migration schema must be an object');
  }

  const obj = schema as Record<string, unknown>;

  if (obj.version !== MIGRATION_SCHEMA_VERSION) {
    throw new Error(`Expected version ${MIGRATION_SCHEMA_VERSION}, got ${obj.version}`);
  }

  if (typeof obj.exportedAt !== 'string' || !isValidIsoDate(obj.exportedAt)) {
    throw new Error('exportedAt must be a valid ISO 8601 date string');
  }

  if (!Array.isArray(obj.rows)) {
    throw new Error('rows must be an array');
  }

  for (let i = 0; i < obj.rows.length; i++) {
    const row = obj.rows[i];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error(`rows[${i}] must be an object`);
    }
    const r = row as Record<string, unknown>;
    if (typeof r.externalId !== 'string') {
      throw new Error(`rows[${i}].externalId must be a string`);
    }
    if (typeof r.displayName !== 'string') {
      throw new Error(`rows[${i}].displayName must be a string`);
    }
    if (typeof r.active !== 'boolean') {
      throw new Error(`rows[${i}].active must be a boolean`);
    }
  }

  return schema as unknown as MigrationSchema;
}

export function createEmptyMigrationSchema(): MigrationSchema {
  return {
    version: MIGRATION_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    rows: [],
  };
}

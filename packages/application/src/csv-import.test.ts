import { describe, expect, it } from 'vitest';
import {
  parseCsvPeopleImport,
  isCsvFormulaInjection,
  sanitizeCsvCellValue,
} from './csv-import';

describe('isCsvFormulaInjection', () => {
  it('detects = formula', () => {
    expect(isCsvFormulaInjection('=SUM(A1:A2)')).toBe(true);
  });

  it('detects + formula', () => {
    expect(isCsvFormulaInjection('+cmd|/C calc')).toBe(true);
  });

  it('detects - formula', () => {
    expect(isCsvFormulaInjection('-SUM(A1:A2)')).toBe(true);
  });

  it('detects @ formula', () => {
    expect(isCsvFormulaInjection('@SUM(A1:A2)')).toBe(true);
  });

  it('detects tab followed by =', () => {
    expect(isCsvFormulaInjection('\t=cmd')).toBe(true);
  });

  it('detects DDE cmd|', () => {
    expect(isCsvFormulaInjection('cmd|/C calc')).toBe(true);
  });

  it('detects DDE excel|', () => {
    expect(isCsvFormulaInjection('excel|...')).toBe(true);
  });

  it('detects DDE msqry|', () => {
    expect(isCsvFormulaInjection('msqry|...')).toBe(true);
  });

  it('detects DDE case-insensitively', () => {
    expect(isCsvFormulaInjection('CMD|/C calc')).toBe(true);
  });

  it('returns false for normal text', () => {
    expect(isCsvFormulaInjection('John Doe')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCsvFormulaInjection('')).toBe(false);
  });

  it('returns false for text starting with letter', () => {
    expect(isCsvFormulaInjection('abc')).toBe(false);
  });
});

describe('sanitizeCsvCellValue', () => {
  it('prepends single quote for formula injection', () => {
    expect(sanitizeCsvCellValue('=CMD()')).toBe("'=CMD()");
  });

  it('returns as-is for safe values', () => {
    expect(sanitizeCsvCellValue('John Doe')).toBe('John Doe');
  });

  it('prepends quote for +formula', () => {
    expect(sanitizeCsvCellValue('+SUM(1)')).toBe("'+SUM(1)");
  });

  it('prepends quote for DDE', () => {
    expect(sanitizeCsvCellValue('cmd|/C calc')).toBe("'cmd|/C calc");
  });
});

describe('parseCsvPeopleImport', () => {
  it('parses valid CSV', () => {
    const csv = `externalId,displayName,active,preferredLocale
ext-1,John Doe,true,en-US
ext-2,Jane Smith,false,fr-FR`;
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.skipped).toBe(0);
    expect(result.total).toBe(2);
    expect(result.rows[0].externalId).toBe('ext-1');
    expect(result.rows[0].normalizedDisplayName).toBe('John Doe');
    expect(result.rows[0].active).toBe(true);
    expect(result.rows[0].normalizedLocale).toBe('en-US');
    expect(result.rows[0].isValid).toBe(true);
  });

  it('rejects formula injection in cells', () => {
    const csv = `externalId,displayName,active,preferredLocale
=CMD(),John Doe,true,en-US`;
    const result = parseCsvPeopleImport(csv);
    // The externalId gets sanitized (prepended with '), but it's not empty
    // so it should still parse. The sanitized value is "'=CMD()"
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].externalId).toBe("'=CMD()");
    expect(result.rows[0].isValid).toBe(true);
  });

  it('handles BOM at start of file', () => {
    const csv = '\uFEFFexternalId,displayName,active,preferredLocale\next-1,John Doe,true,en-US';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].externalId).toBe('ext-1');
    expect(result.rows[0].isValid).toBe(true);
  });

  it('handles \\r\\n line endings', () => {
    const csv = 'externalId,displayName,active,preferredLocale\r\next-1,John Doe,true,en-US';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].externalId).toBe('ext-1');
  });

  it('returns empty for missing required columns', () => {
    const csv = 'foo,bar\n1,2';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('handles empty CSV (only header)', () => {
    const csv = 'externalId,displayName,active,preferredLocale';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.skipped).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles completely empty input', () => {
    const result = parseCsvPeopleImport('');
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('respects maxRows', () => {
    const lines = ['externalId,displayName,active,preferredLocale'];
    for (let i = 0; i < 20; i++) {
      lines.push(`ext-${i},Person ${i},true,en-US`);
    }
    const csv = lines.join('\n');
    const result = parseCsvPeopleImport(csv, { maxRows: 5 });
    expect(result.rows).toHaveLength(5);
    expect(result.total).toBe(5);
  });

  it('skips malformed rows (too few columns)', () => {
    const csv = 'externalId,displayName,active,preferredLocale\next-1,John Doe\next-2,Good Row,true,en-US';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(2);
    expect(result.rows[0].externalId).toBe('ext-2');
  });

  it('handles case-insensitive headers', () => {
    const csv = 'ExternalId,DisplayName,Active,PreferredLocale\next-1,John Doe,true,en-US';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].externalId).toBe('ext-1');
  });

  it('handles missing optional preferredLocale', () => {
    const csv = 'externalId,displayName,active\next-1,John Doe,true';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].preferredLocale).toBeUndefined();
    expect(result.rows[0].isValid).toBe(true);
  });

  it('reports validation errors for invalid rows', () => {
    const csv = 'externalId,displayName,active,preferredLocale\n,John Doe,true,en-US';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].isValid).toBe(false);
    expect(result.rows[0].validationErrors).toContain('externalId is required');
  });

  it('handles unicode characters', () => {
    const csv = 'externalId,displayName,active,preferredLocale\next-1,José García,true,es-ES';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].normalizedDisplayName).toBe('José García');
    expect(result.rows[0].normalizedLocale).toBe('es-ES');
  });

  it('skips trailing empty lines', () => {
    const csv = 'externalId,displayName,active,preferredLocale\next-1,John Doe,true,en-US\n\n\n';
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { escapeCsvField, exportPeopleToCsv } from './csv-export';
import { normalizeMigrationRow, type MigrationPersonRow } from './migration-schema';
import { parseCsvPeopleImport } from './csv-import';

const validRow: MigrationPersonRow = normalizeMigrationRow({
  externalId: 'ext-1',
  displayName: 'John Doe',
  active: true,
  preferredLocale: 'en-US',
});

const validRow2: MigrationPersonRow = normalizeMigrationRow({
  externalId: 'ext-2',
  displayName: 'Jane Smith',
  active: false,
  preferredLocale: 'fr-FR',
});

describe('escapeCsvField', () => {
  it('does not escape simple values', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('wraps values containing commas in double quotes', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"');
  });

  it('escapes double quotes by doubling them', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps values containing newlines in double quotes', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles empty string', () => {
    expect(escapeCsvField('')).toBe('');
  });

  it('handles value with comma and quotes combined', () => {
    expect(escapeCsvField('a,"b",c')).toBe('"a,""b"",c"');
  });
});

describe('exportPeopleToCsv', () => {
  it('exports with default options (header included)', () => {
    const csv = exportPeopleToCsv([validRow]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('externalId,displayName,active,preferredLocale');
    expect(lines[1]).toContain('ext-1');
    expect(lines[1]).toContain('John Doe');
  });

  it('exports without header', () => {
    const csv = exportPeopleToCsv([validRow], { includeHeader: false });
    const lines = csv.split('\n');
    expect(lines[0]).toContain('ext-1');
    expect(lines[0]).not.toContain('externalId,');
  });

  it('uses custom line ending', () => {
    const csv = exportPeopleToCsv([validRow], { lineEnding: '\r\n' });
    expect(csv).toContain('\r\n');
    expect(csv).not.toMatch(/[^\r]\n/);
  });

  it('exports empty rows', () => {
    const csv = exportPeopleToCsv([]);
    expect(csv).toBe('externalId,displayName,active,preferredLocale');
  });

  it('exports multiple rows in order', () => {
    const csv = exportPeopleToCsv([validRow, validRow2]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('externalId,displayName,active,preferredLocale');
    expect(lines[1]).toContain('ext-1');
    expect(lines[2]).toContain('ext-2');
  });

  it('handles unicode characters', () => {
    const unicodeRow = normalizeMigrationRow({
      externalId: 'ext-u',
      displayName: 'José García',
      active: true,
      preferredLocale: 'es-ES',
    });
    const csv = exportPeopleToCsv([unicodeRow]);
    expect(csv).toContain('José García');
    });

  it('produces deterministic output', () => {
    const a = exportPeopleToCsv([validRow, validRow2]);
    const b = exportPeopleToCsv([validRow, validRow2]);
    expect(a).toBe(b);
  });

  it('uses custom columns', () => {
    const csv = exportPeopleToCsv([validRow], { columns: ['externalId', 'displayName'] });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('externalId,displayName');
    expect(lines[1]).toBe('ext-1,John Doe');
  });

  it('round-trips through parseCsvPeopleImport', () => {
    const originalRows = [validRow, validRow2];
    const csv = exportPeopleToCsv(originalRows);
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].externalId).toBe('ext-1');
    expect(result.rows[0].normalizedDisplayName).toBe('John Doe');
    expect(result.rows[0].active).toBe(true);
    expect(result.rows[0].normalizedLocale).toBe('en-US');
    expect(result.rows[1].externalId).toBe('ext-2');
    expect(result.rows[1].normalizedDisplayName).toBe('Jane Smith');
    expect(result.rows[1].active).toBe(false);
    expect(result.rows[1].normalizedLocale).toBe('fr-FR');
  });

  it('round-trips rows with commas in displayName', () => {
    const commaRow = normalizeMigrationRow({
      externalId: 'ext-comma',
      displayName: 'Doe, John Jr.',
      active: true,
    });
    const csv = exportPeopleToCsv([commaRow]);
    const result = parseCsvPeopleImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].normalizedDisplayName).toBe('Doe, John Jr.');
  });
});

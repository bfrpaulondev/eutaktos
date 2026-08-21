import type { MigrationPersonRow } from './migration-schema';

export interface CsvExportOptions {
  includeHeader?: boolean;
  columns?: readonly string[];
  lineEnding?: '\n' | '\r\n';
}

const DEFAULT_COLUMNS = ['externalId', 'displayName', 'active', 'preferredLocale'] as const;

export function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function exportPeopleToCsv(
  rows: readonly MigrationPersonRow[],
  options?: CsvExportOptions,
): string {
  const includeHeader = options?.includeHeader ?? true;
  const columns = options?.columns ?? [...DEFAULT_COLUMNS];
  const lineEnding = options?.lineEnding ?? '\n';

  const lines: string[] = [];

  if (includeHeader) {
    lines.push(columns.map(escapeCsvField).join(','));
  }

  for (const row of rows) {
    const values = columns.map(col => {
      const val = (row as unknown as Record<string, unknown>)[col];
      return escapeCsvField(val === undefined ? '' : String(val));
    });
    lines.push(values.join(','));
  }

  return lines.join(lineEnding);
}

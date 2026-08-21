import { normalizeMigrationRow, type MigrationPersonRow } from './migration-schema';

export interface CsvImportResult {
  rows: readonly MigrationPersonRow[];
  skipped: number;
  total: number;
}

export interface CsvImportOptions {
  maxRows?: number;
  allowedEncoding?: 'utf-8' | 'latin1';
}

const DDE_PREFIXES = ['cmd|', 'excel|', 'msqry|', 'outlook|', 'msaccess|', 'powerpnt|', 'winword|'];

const FORMULA_STARTERS = ['=', '+', '-', '@', '\t', '\r'];

export function isCsvFormulaInjection(value: string): boolean {
  if (value.length === 0) return false;
  const firstChar = value[0];

  // Check single-char formula starters
  for (const starter of FORMULA_STARTERS) {
    if (firstChar === starter) return true;
  }

  // Check tab/CR followed by = or @
  if (firstChar === '\t' || firstChar === '\r') {
    const next = value[1];
    if (next === '=' || next === '@') return true;
  }

  // Check DDE commands (case-insensitive)
  const lower = value.toLowerCase();
  for (const prefix of DDE_PREFIXES) {
    if (lower.startsWith(prefix)) return true;
  }

  return false;
}

export function sanitizeCsvCellValue(value: string): string {
  if (isCsvFormulaInjection(value)) {
    return "'" + value;
  }
  return value;
}

const DEFAULT_COLUMNS = ['externalId', 'displayName', 'active', 'preferredLocale'];

export function parseCsvPeopleImport(csvText: string, options?: CsvImportOptions): CsvImportResult {
  const maxRows = options?.maxRows ?? 10_000;

  // Strip BOM
  let text = csvText;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Split lines (handle \r\n and \n)
  const lines = text.split(/\r?\n/);

  if (lines.length === 0) {
    return { rows: [], skipped: 0, total: 0 };
  }

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

  // Find column indices
  const colIndex: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    colIndex[headers[i]] = i;
  }

  // Validate we have at least the expected columns
  const hasExternalId = headers.includes('externalid');
  const hasDisplayName = headers.includes('displayname');
  if (!hasExternalId || !hasDisplayName) {
    return { rows: [], skipped: 0, total: 0 };
  }

  const rows: MigrationPersonRow[] = [];
  let skipped = 0;
  let total = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue; // skip trailing empty lines

    if (total >= maxRows) break;
    total++;

    const cells = line.split(',');

    // Malformed row: wrong column count
    if (cells.length < headers.length) {
      skipped++;
      continue;
    }

    const get = (col: string): string => {
      const idx = colIndex[col];
      if (idx === undefined || idx >= cells.length) return '';
      return sanitizeCsvCellValue(cells[idx].trim());
    };

    const externalId = get('externalid');
    const displayName = get('displayname');
    const activeStr = get('active');
    const preferredLocale = get('preferredlocale');

    // Coerce active to a known type for normalizeMigrationRow
    let activeVal: unknown = false;
    const lower = activeStr.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      activeVal = true;
    } else if (lower === 'false' || lower === '0' || lower === 'no') {
      activeVal = false;
    } else if (activeStr === '') {
      activeVal = false;
    } else {
      activeVal = activeStr; // let normalizeMigrationRow handle the error
    }

    const row = normalizeMigrationRow({
      externalId,
      displayName,
      active: activeVal,
      preferredLocale: preferredLocale || undefined,
    });

    rows.push(row);
  }

  return { rows, skipped, total };
}

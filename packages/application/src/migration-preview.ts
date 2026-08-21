export interface MigrationPersonRow {
  externalId: string;
  displayName: string;
  active: boolean;
  preferredLocale?: string;
  normalizedDisplayName: string;
  normalizedLocale?: string;
  validationErrors: readonly string[];
  isValid: boolean;
}

export type MigrationAction = 'create' | 'update' | 'skip' | 'conflict' | 'invalid';

export interface MigrationPreviewRow {
  index: number;
  externalId: string;
  action: MigrationAction;
  reason: string;
  source: MigrationPersonRow;
}

export interface MigrationSummary {
  total: number;
  create: number;
  update: number;
  skip: number;
  conflict: number;
  invalid: number;
}

export interface MigrationPreviewResult {
  actions: readonly MigrationPreviewRow[];
  summary: MigrationSummary;
}

export interface MigrationPreviewOptions {
  existingExternalIds: ReadonlyMap<string, { displayName: string; active: boolean }>;
  existingDisplayNames: ReadonlySet<string>;
}

export function previewMigration(
  rows: readonly MigrationPersonRow[],
  options: MigrationPreviewOptions,
): MigrationPreviewResult {
  // Sort by externalId for deterministic ordering
  const sorted = [...rows].sort((a, b) => a.externalId.localeCompare(b.externalId));

  const actions: MigrationPreviewRow[] = sorted.map((row, index) => {
    return classifyRow(row, index, options);
  });

  const summary = buildSummary(actions);

  return { actions, summary };
}

function classifyRow(
  row: MigrationPersonRow,
  index: number,
  options: MigrationPreviewOptions,
): MigrationPreviewRow {
  // 1. Invalid rows
  if (!row.isValid) {
    return {
      index,
      externalId: row.externalId,
      action: 'invalid',
      reason: row.validationErrors.join('; '),
      source: row,
    };
  }

  const existing = options.existingExternalIds.get(row.externalId);

  // 2. New record
  if (existing === undefined) {
    return {
      index,
      externalId: row.externalId,
      action: 'create',
      reason: 'New record',
      source: row,
    };
  }

  // 3. Existing record — check for changes
  const nameChanged = row.normalizedDisplayName !== existing.displayName;
  const activeChanged = row.active !== existing.active;

  // 3a. Both changed → conflict
  if (nameChanged && activeChanged) {
    return {
      index,
      externalId: row.externalId,
      action: 'conflict',
      reason: 'Multiple fields differ',
      source: row,
    };
  }

  // 3b. Name changed → update
  if (nameChanged) {
    return {
      index,
      externalId: row.externalId,
      action: 'update',
      reason: `Name change: ${existing.displayName} → ${row.normalizedDisplayName}`,
      source: row,
    };
  }

  // 3c. Active changed → update
  if (activeChanged) {
    return {
      index,
      externalId: row.externalId,
      action: 'update',
      reason: 'Active status change',
      source: row,
    };
  }

  // 3d. No changes → skip
  return {
    index,
    externalId: row.externalId,
    action: 'skip',
    reason: 'No changes detected',
    source: row,
  };
}

function buildSummary(actions: readonly MigrationPreviewRow[]): MigrationSummary {
  const summary: MigrationSummary = {
    total: actions.length,
    create: 0,
    update: 0,
    skip: 0,
    conflict: 0,
    invalid: 0,
  };

  for (const action of actions) {
    summary[action.action]++;
  }

  return summary;
}

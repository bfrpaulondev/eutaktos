import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const expectedMuiConsumers = Object.freeze([
  'AccessManagementDialog.tsx',
  'App.tsx',
  'AuditHistoryDialog.tsx',
  'AuthSignInPanel.tsx',
  'CongregationSettingsDialog.tsx',
  'EligibilityDialog.tsx',
  'HourglassImportInspector.tsx',
  'HouseholdsSection.tsx',
  'MagicLinkConfirmationPanel.tsx',
  'MidweekAuthoringControls.tsx',
  'MidweekWorkspace.tsx',
  'ProductionDashboard.tsx',
  'PwaUpdateRecovery.tsx',
  'ResponsibilitiesSection.tsx',
  'SectionWorkspace.tsx',
  'ServiceGroupsSection.tsx',
  'TaskShell.tsx',
  'ui/MuiCompat.tsx',
  'AwayPeriodsSection.tsx',
].sort());

function walk(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function muiConsumers(): readonly string[] {
  const root = join(process.cwd(), 'src');
  return walk(root)
    .filter(path => /\.[cm]?[jt]sx?$/.test(path))
    .filter(path => !path.endsWith('MuiBoundary.test.ts'))
    .filter(path => /(?:from\s+|import\s*)['"]@mui\/material(?:\/[^'"]+)?['"]/.test(readFileSync(path, 'utf8')))
    .map(path => relative(root, path).replaceAll('\\', '/'))
    .sort();
}

describe('PX11 MUI retirement boundary', () => {
  it('keeps an explicit inventory and rejects new or unrecorded MUI consumers', () => {
    expect(muiConsumers()).toEqual(expectedMuiConsumers);
  });

  it('confirms migrated shell primitives no longer depend on MUI', () => {
    const root = join(process.cwd(), 'src');
    for (const file of ['LogoutControl.tsx', 'PwaConnectionStatus.tsx']) {
      expect(readFileSync(join(root, file), 'utf8')).not.toContain('@mui/material');
    }
  });
});

import { describe, expect, it } from 'vitest';

const expectedMuiConsumers = Object.freeze([
  'App.tsx',
  'MidweekAuthoringControls.tsx',
  'MidweekWorkspace.tsx',
  'SectionWorkspace.tsx',
  'ServiceGroupsSection.tsx',
  'TaskShell.tsx',
  'theme.ts',
  'ui/MuiCompat.tsx',
].sort());

const sourceModules = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Readonly<Record<string, string>>;

function source(path: string): string {
  const value = sourceModules[`./${path}`];
  if (typeof value !== 'string') throw new Error(`Missing source module: ${path}`);
  return value;
}

function muiConsumers(): readonly string[] {
  return Object.entries(sourceModules)
    .filter(([path]) => !path.endsWith('/MuiBoundary.test.ts'))
    .filter(([, contents]) => /(?:from\s+|import\s*)['"]@mui\/material(?:\/[^'"]+)?['"]/.test(contents))
    .map(([path]) => path.replace(/^\.\//, ''))
    .sort();
}

describe('PX11 MUI retirement boundary', () => {
  it('keeps an explicit inventory and rejects new or unrecorded MUI consumers', () => {
    expect(muiConsumers()).toEqual(expectedMuiConsumers);
  });

  it('confirms migrated product/shell primitives no longer depend on MUI', () => {
    for (const file of ['AccessManagementDialog.tsx', 'AuditHistoryDialog.tsx', 'AuthSignInPanel.tsx', 'AwayPeriodsSection.tsx', 'CongregationSettingsDialog.tsx', 'EligibilityDialog.tsx', 'HouseholdsSection.tsx', 'HourglassImportInspector.tsx', 'LogoutControl.tsx', 'MagicLinkConfirmationPanel.tsx', 'ProductionDashboard.tsx', 'PwaConnectionStatus.tsx', 'PwaUpdateRecovery.tsx', 'ResponsibilitiesSection.tsx']) {
      expect(source(file)).not.toContain('@mui/material');
    }
  });
});

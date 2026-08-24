import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(fileName: string): string {
  return readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8');
}

const labelledDialogs = [
  ['HouseholdsSection.tsx', 'household-delete-title', 'household-delete-description'],
  ['ServiceGroupsSection.tsx', 'service-group-delete-title', 'service-group-delete-description'],
  ['ResponsibilitiesSection.tsx', 'responsibility-finish-title', 'responsibility-finish-description'],
  ['AwayPeriodsSection.tsx', 'away-remove-title', 'away-remove-description'],
  ['EligibilityDialog.tsx', 'eligibility-confirmation-title', 'eligibility-confirmation-description'],
  ['AccessManagementDialog.tsx', 'access-grant-title', 'access-grant-confirmation'],
  ['AccessManagementDialog.tsx', 'access-revoke-title', 'access-revoke-confirmation'],
  ['CongregationSettingsDialog.tsx', 'settings-discard-title', 'settings-discard-description'],
  ['EmergencyContactsDialog.tsx', 'emergency-contact-remove-title', 'emergency-contact-remove-description'],
  ['MidweekAuthoringControls.tsx', 'midweek-publish-title', 'midweek-publish-description'],
] as const;

describe('Accessibility: production confirmation dialogs are named and described', () => {
  it.each(labelledDialogs)('%s wires aria-labelledby=%s and aria-describedby=%s to real ids', (fileName, titleId, descriptionId) => {
    const component = source(fileName);
    expect(component).toContain(`aria-labelledby="${titleId}"`);
    expect(component).toContain(`id="${titleId}"`);
    expect(component).toContain(`aria-describedby="${descriptionId}"`);
    expect(component).toContain(`id="${descriptionId}"`);
  });
});

describe('Accessibility: destructive confirmation semantics stay explicit', () => {
  it('delete/remove actions keep error emphasis on the real components', () => {
    for (const fileName of ['HouseholdsSection.tsx', 'ServiceGroupsSection.tsx', 'AwayPeriodsSection.tsx', 'EmergencyContactsDialog.tsx', 'AccessManagementDialog.tsx']) {
      expect(source(fileName)).toContain('color="error"');
    }
  });

  it('discard/finish actions keep warning emphasis on the real components', () => {
    for (const fileName of ['ResponsibilitiesSection.tsx', 'CongregationSettingsDialog.tsx']) {
      expect(source(fileName)).toContain('color="warning"');
    }
  });
});

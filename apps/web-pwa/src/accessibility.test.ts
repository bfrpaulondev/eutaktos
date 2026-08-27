import { describe, expect, it } from 'vitest';
import accessSource from './AccessManagementDialog.tsx?raw';
import awaySource from './AwayPeriodsSection.tsx?raw';
import settingsSource from './CongregationSettingsDialog.tsx?raw';
import eligibilitySource from './EligibilityDialog.tsx?raw';
import emergencySource from './EmergencyContactsDialog.tsx?raw';
import householdSource from './HouseholdsSection.tsx?raw';
import midweekSource from './MidweekAuthoringControls.tsx?raw';
import responsibilitiesSource from './ResponsibilitiesSection.tsx?raw';
import serviceGroupsSource from './ServiceGroupsSection.tsx?raw';

const labelledDialogs = [
  [householdSource, 'household-delete-title', 'household-delete-description'],
  [serviceGroupsSource, 'service-group-delete-title', 'service-group-delete-description'],
  [responsibilitiesSource, 'responsibility-finish-title', 'responsibility-finish-description'],
  [awaySource, 'away-remove-title', 'away-remove-description'],
  [eligibilitySource, 'eligibility-confirmation-title', 'eligibility-confirmation-description'],
  [accessSource, 'access-grant-title', 'access-grant-confirmation'],
  [accessSource, 'access-revoke-title', 'access-revoke-confirmation'],
  [settingsSource, 'settings-discard-title', 'settings-discard-description'],
  [emergencySource, 'emergency-contact-remove-title', 'emergency-contact-remove-description'],
  [midweekSource, 'midweek-publish-title', 'midweek-publish-description'],
] as const;

describe('Accessibility: production confirmation dialogs are named and described', () => {
  it.each(labelledDialogs)('wires aria-labelledby=%s and aria-describedby=%s to real ids', (component, titleId, descriptionId) => {
    expect(component).toContain(`aria-labelledby="${titleId}"`);
    expect(component).toContain(`id="${titleId}"`);
    expect(component).toContain(`aria-describedby="${descriptionId}"`);
    expect(component).toContain(`id="${descriptionId}"`);
  });
});

describe('Accessibility: destructive confirmation semantics stay explicit', () => {
  it('keeps Ant danger semantics on migrated destructive actions', () => {
    for (const component of [accessSource, awaySource, emergencySource, householdSource, serviceGroupsSource, settingsSource, responsibilitiesSource]) {
      expect(component).toMatch(/<Button\b[^>]*\bdanger(?:\s|=|>)/);
    }
  });
});

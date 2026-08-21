import { describe, expect, it } from 'vitest';
import { canSaveCongregationSettings, settingsAreEqual } from './CongregationSettingsDialog';
import type { CongregationSettingsDto } from './lib/congregationSettingsApi';

const settings: CongregationSettingsDto = {
  name: 'Congregação Central',
  timezone: 'Europe/Lisbon',
  defaultLocale: 'pt-PT',
  midweekMeeting: { weekday: 2, localTime: '19:30' },
  weekendMeeting: { weekday: 0, localTime: '10:00' },
};

describe('CongregationSettingsDialog safeguards', () => {
  it('detects unsaved changes across profile and regular meeting fields', () => {
    expect(settingsAreEqual(settings, { ...settings, midweekMeeting: { ...settings.midweekMeeting } })).toBe(true);
    expect(settingsAreEqual(settings, { ...settings, weekendMeeting: { ...settings.weekendMeeting, localTime: '11:00' } })).toBe(false);
    expect(settingsAreEqual(settings, { ...settings, name: 'Outra congregação' })).toBe(false);
  });

  it('allows a complete valid form and blocks invalid or concurrent submissions', () => {
    expect(canSaveCongregationSettings(settings, false)).toBe(true);
    expect(canSaveCongregationSettings({ ...settings, midweekMeeting: { ...settings.midweekMeeting, localTime: '25:00' } }, false)).toBe(false);
    expect(canSaveCongregationSettings(settings, true)).toBe(false);
  });
});

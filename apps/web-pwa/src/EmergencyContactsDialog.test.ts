import { describe, expect, it } from 'vitest';
import { canSubmitEmergencyContact, emergencyContactAccess, hasUnsavedEmergencyContactDraft } from './EmergencyContactsDialog';

// Keep these guards deterministic; browser acceptance separately covers the mounted emergency surface.
describe('EmergencyContactsDialog submission guard', () => {
  it('requires a non-blank name and phone before a sensitive contact can be saved', () => {
    expect(canSubmitEmergencyContact('', '', false)).toBe(false);
    expect(canSubmitEmergencyContact('  ', '+351 210 000 000', false)).toBe(false);
    expect(canSubmitEmergencyContact('Ana Silva', '   ', false)).toBe(false);
    expect(canSubmitEmergencyContact('Ana Silva', '+351 210 000 000', false)).toBe(true);
  });

  it('blocks double submission while the contact is being saved', () => {
    expect(canSubmitEmergencyContact('Ana Silva', '+351 210 000 000', true)).toBe(false);
  });
});

describe('EmergencyContactsDialog capability boundary', () => {
  it('fails closed unless the authenticated session explicitly grants emergency read', () => {
    expect(emergencyContactAccess([])).toEqual({ canRead: false, canWrite: false });
    expect(emergencyContactAccess(['people.read'])).toEqual({ canRead: false, canWrite: false });
    expect(emergencyContactAccess(['emergency-contacts.write'])).toEqual({ canRead: false, canWrite: false });
  });

  it('keeps write strictly dependent on both emergency read and write capabilities', () => {
    expect(emergencyContactAccess(['emergency-contacts.read'])).toEqual({ canRead: true, canWrite: false });
    expect(emergencyContactAccess(['emergency-contacts.read', 'emergency-contacts.write'])).toEqual({ canRead: true, canWrite: true });
  });
});

describe('EmergencyContactsDialog unsaved draft guard', () => {
  it('protects any entered contact field before closing the sensitive dialog', () => {
    expect(hasUnsavedEmergencyContactDraft('', '', '')).toBe(false);
    expect(hasUnsavedEmergencyContactDraft('Example person', '', '')).toBe(true);
    expect(hasUnsavedEmergencyContactDraft('', '+000 000 000', '')).toBe(true);
    expect(hasUnsavedEmergencyContactDraft('', '', 'Family')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { canSubmitEmergencyContact } from './EmergencyContactsDialog';

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

import { describe, expect, it } from 'vitest';
import { canSubmitHousehold, hasUnsavedHouseholdDraft, parseMemberIds } from './HouseholdsSection';

describe('HouseholdsSection member normalization', () => {
  it('keeps only unique non-empty API member IDs in their entered order', () => {
    expect(parseMemberIds(' person-1, person-2, person-1, , person-3 ')).toEqual(['person-1', 'person-2', 'person-3']);
  });

  it('does not invent members when the input is blank', () => {
    expect(parseMemberIds(' , , ')).toEqual([]);
  });
});

describe('HouseholdsSection submission guard', () => {
  it('requires a household name and blocks an additional save while saving', () => {
    expect(canSubmitHousehold('  ', false)).toBe(false);
    expect(canSubmitHousehold('Martins', true)).toBe(false);
    expect(canSubmitHousehold('Martins', false)).toBe(true);
  });
});

describe('HouseholdsSection unsaved draft guard', () => {
  it('requires confirmation only when create or edit values differ from the actual record', () => {
    const household = { id: 'household-1', name: 'Martins', memberIds: ['person-1', 'person-2'] };
    expect(hasUnsavedHouseholdDraft('', '', null)).toBe(false);
    expect(hasUnsavedHouseholdDraft('Martins', 'person-1, person-2', household)).toBe(false);
    expect(hasUnsavedHouseholdDraft('Martins', 'person-2, person-1', household)).toBe(true);
    expect(hasUnsavedHouseholdDraft('Martins', 'person-1', household)).toBe(true);
    expect(hasUnsavedHouseholdDraft('New household', '', null)).toBe(true);
  });
});

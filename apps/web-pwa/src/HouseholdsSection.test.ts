import { describe, expect, it } from 'vitest';
import { canSubmitHousehold, parseMemberIds } from './HouseholdsSection';

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

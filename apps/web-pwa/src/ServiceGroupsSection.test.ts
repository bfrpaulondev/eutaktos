import { describe, expect, it } from 'vitest';
import { canSubmitServiceGroup, parseServiceGroupMemberIds } from './ServiceGroupsSection';

describe('ServiceGroupsSection member normalization', () => {
  it('keeps unique non-empty member IDs in entry order', () => {
    expect(parseServiceGroupMemberIds(' member-1, member-2, member-1, , member-3 ')).toEqual(['member-1', 'member-2', 'member-3']);
  });

  it('returns no members for an empty input without synthesizing data', () => {
    expect(parseServiceGroupMemberIds(' , ')).toEqual([]);
  });
});

describe('ServiceGroupsSection submission guard', () => {
  it('requires a group name and blocks the UI while a save is in progress', () => {
    expect(canSubmitServiceGroup(' ', false)).toBe(false);
    expect(canSubmitServiceGroup('Group A', true)).toBe(false);
    expect(canSubmitServiceGroup('Group A', false)).toBe(true);
  });
});

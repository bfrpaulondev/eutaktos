import { describe, expect, it } from 'vitest';
import { canSubmitServiceGroup, hasUnsavedServiceGroupDraft, parseServiceGroupMemberIds } from './ServiceGroupsSection';

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

describe('ServiceGroupsSection unsaved draft guard', () => {
  it('compares members and named roles before allowing a close without confirmation', () => {
    const group = { id: 'group-1', name: 'Group A', memberIds: ['person-1'], overseerId: 'person-2', assistantId: undefined };
    expect(hasUnsavedServiceGroupDraft('', '', '', '', null)).toBe(false);
    expect(hasUnsavedServiceGroupDraft('Group A', 'person-1', 'person-2', '', group)).toBe(false);
    expect(hasUnsavedServiceGroupDraft('Group A', 'person-1', 'person-3', '', group)).toBe(true);
    expect(hasUnsavedServiceGroupDraft('Group A', 'person-2, person-1', 'person-2', '', group)).toBe(true);
    expect(hasUnsavedServiceGroupDraft('', '', '', 'person-4', null)).toBe(true);
  });
});

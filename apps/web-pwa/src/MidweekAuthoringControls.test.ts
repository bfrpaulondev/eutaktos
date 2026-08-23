import { describe, expect, it } from 'vitest';
import { BUILTIN_PARTS, slotAllowsStudentAssignment } from './MidweekAuthoringControls';

describe('Midweek authoring part definitions', () => {
  it('ships deterministic built-in part definitions', () => {
    expect(BUILTIN_PARTS.map(part => part.id)).toEqual([
      'builtin:opening-remarks',
      'builtin:treasures-from-gods-word',
      'builtin:apply-yourself-to-the-ministry',
      'builtin:living-as-christians',
    ]);
  });

  it('only exposes student assignment for student-capable parts', () => {
    expect(slotAllowsStudentAssignment(undefined)).toBe(false);
    expect(slotAllowsStudentAssignment('custom:e2e')).toBe(false);
    expect(slotAllowsStudentAssignment('builtin:opening-remarks')).toBe(false);
    expect(slotAllowsStudentAssignment('builtin:treasures-from-gods-word')).toBe(false);
    expect(slotAllowsStudentAssignment('builtin:apply-yourself-to-the-ministry')).toBe(true);
    expect(slotAllowsStudentAssignment('builtin:living-as-christians')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { BUILTIN_PARTS, slotAllowsStudentAssignment } from './MidweekAuthoringControls';

describe('Midweek authoring part definitions', () => {
  it('ships deterministic operational part definitions', () => {
    expect(BUILTIN_PARTS.map(part => part.id)).toEqual([
      'builtin:opening-remarks',
      'midweek:treasures-talk',
      'midweek:spiritual-gems',
      'midweek:bible-reading',
      'midweek:initial-call',
      'midweek:return-visit',
      'midweek:make-disciples',
      'midweek:student-talk',
      'midweek:living-christians-part',
      'midweek:congregation-bible-study',
      'midweek:congregation-bible-study-reader',
    ]);
  });

  it('only exposes student assignment for student-capable parts and accepts legacy schedules', () => {
    expect(slotAllowsStudentAssignment(undefined)).toBe(false);
    expect(slotAllowsStudentAssignment('custom:e2e')).toBe(false);
    expect(slotAllowsStudentAssignment('builtin:opening-remarks')).toBe(false);
    expect(slotAllowsStudentAssignment('midweek:treasures-talk')).toBe(false);
    expect(slotAllowsStudentAssignment('midweek:bible-reading')).toBe(true);
    expect(slotAllowsStudentAssignment('midweek:initial-call')).toBe(true);
    expect(slotAllowsStudentAssignment('midweek:return-visit')).toBe(true);
    expect(slotAllowsStudentAssignment('midweek:make-disciples')).toBe(true);
    expect(slotAllowsStudentAssignment('midweek:student-talk')).toBe(true);
    expect(slotAllowsStudentAssignment('midweek:living-christians-part')).toBe(false);
    expect(slotAllowsStudentAssignment('builtin:apply-yourself-to-the-ministry')).toBe(true);
    expect(slotAllowsStudentAssignment('builtin:living-as-christians')).toBe(true);
  });
});

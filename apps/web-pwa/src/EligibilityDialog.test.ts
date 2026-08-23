import { describe, expect, it } from 'vitest';
import { isEligibilityDecisionSubmittable } from './EligibilityDialog';
import {
  CUSTOM_ASSIGNMENT_TYPE_CHOICE,
  ELIGIBILITY_ASSIGNMENT_TYPES,
  resolveAssignmentTypeChoice,
} from './lib/assignmentTypeCatalog';

describe('EligibilityDialog decision guard', () => {
  it('requires an explicit assignment type before a decision can enter confirmation', () => {
    expect(isEligibilityDecisionSubmittable('   ', false)).toBe(false);
    expect(isEligibilityDecisionSubmittable('builtin:apply-yourself-to-the-ministry', false)).toBe(true);
  });

  it('blocks an additional decision while an explicit decision is being saved', () => {
    expect(isEligibilityDecisionSubmittable('chairman', true)).toBe(false);
  });

  it('uses the exact student part definition ids consumed by scheduling', () => {
    const ids = ELIGIBILITY_ASSIGNMENT_TYPES.map(option => option.id);
    expect(ids).toContain('builtin:apply-yourself-to-the-ministry');
    expect(ids).toContain('builtin:living-as-christians');
    expect(ids).not.toContain('builtin:opening-remarks');
    expect(ids).not.toContain('builtin:treasures-from-gods-word');
  });

  it('keeps standard non-student roles controlled while allowing an explicit custom role', () => {
    const ids = ELIGIBILITY_ASSIGNMENT_TYPES.map(option => option.id);
    expect(ids).toEqual(expect.arrayContaining(['chairman', 'opening-prayer', 'closing-prayer', 'bible-reading']));
    expect(resolveAssignmentTypeChoice(CUSTOM_ASSIGNMENT_TYPE_CHOICE, '  custom-greeter  ')).toBe('custom-greeter');
    expect(resolveAssignmentTypeChoice('chairman', 'ignored')).toBe('chairman');
  });
});

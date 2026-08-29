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
    expect(isEligibilityDecisionSubmittable('hourglass:initcall', false)).toBe(true);
  });

  it('blocks an additional decision while an explicit decision is being saved', () => {
    expect(isEligibilityDecisionSubmittable('hourglass:mm_chairman', true)).toBe(false);
  });

  it('uses the canonical explicit privilege ids consumed by scheduling', () => {
    const ids = ELIGIBILITY_ASSIGNMENT_TYPES.map(option => option.id);
    expect(ids).toEqual(expect.arrayContaining([
      'hourglass:reading',
      'hourglass:initcall',
      'hourglass:rv',
      'hourglass:study',
      'hourglass:stutalk',
      'hourglass:hh',
      'hourglass:treasures',
      'hourglass:dfg',
      'hourglass:lac',
      'hourglass:cbs',
      'hourglass:cbs_reader',
    ]));
    expect(ids.some(id => id.startsWith('builtin:'))).toBe(false);
    expect(ids.some(id => id.startsWith('midweek:'))).toBe(false);
  });

  it('keeps standard role privileges controlled while allowing an explicit custom role', () => {
    const ids = ELIGIBILITY_ASSIGNMENT_TYPES.map(option => option.id);
    expect(ids).toEqual(expect.arrayContaining(['hourglass:mm_chairman', 'hourglass:openprayer', 'hourglass:closeprayer']));
    expect(resolveAssignmentTypeChoice(CUSTOM_ASSIGNMENT_TYPE_CHOICE, '  custom-greeter  ')).toBe('custom-greeter');
    expect(resolveAssignmentTypeChoice('chairman', 'ignored')).toBe('chairman');
  });
});

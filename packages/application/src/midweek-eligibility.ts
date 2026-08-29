import type { MidweekPartDefinition } from '@eutaktos/domain';

const STANDARD_ROLE_ELIGIBILITY: Readonly<Record<string, string>> = Object.freeze({
  chairman: 'hourglass:mm_chairman',
  'opening-prayer': 'hourglass:openprayer',
  'closing-prayer': 'hourglass:closeprayer',
  'bible-reading': 'hourglass:reading',
});

export function studentEligibilityTypeId(part: Readonly<MidweekPartDefinition>): string {
  return part.eligibilityTypeId ?? part.id;
}

export function assistantEligibilityTypeId(part: Readonly<MidweekPartDefinition>): string {
  return part.assistantEligibilityTypeId ?? part.eligibilityTypeId ?? part.id;
}

/**
 * Resolve the explicit eligibility category for a non-student assignment.
 * When the role is itself a part-definition id, that part's configured
 * eligibility category is authoritative. Standard operational roles use
 * explicit source privilege categories imported from Hourglass.
 */
export function nonStudentEligibilityTypeId(
  role: string,
  partDefinition?: Readonly<MidweekPartDefinition>,
): string {
  const normalized = role.trim();
  if (!normalized) throw new Error('role is required');
  if (partDefinition?.id === normalized && partDefinition.eligibilityTypeId) return partDefinition.eligibilityTypeId;
  return STANDARD_ROLE_ELIGIBILITY[normalized] ?? normalized;
}

import type { MidweekPartDefinition } from '@eutaktos/domain';

const STANDARD_ROLE_ELIGIBILITY: Readonly<Record<string, string>> = Object.freeze({
  chairman: 'hourglass:mm_chairman',
  'opening-prayer': 'hourglass:openprayer',
  'closing-prayer': 'hourglass:closeprayer',
  'bible-reading': 'hourglass:reading',
  'builtin:opening-remarks': 'hourglass:mm_chairman',
  'builtin:treasures-from-gods-word': 'hourglass:treasures',
});

export function studentEligibilityTypeId(part: Readonly<MidweekPartDefinition>): string {
  return part.eligibilityTypeId ?? part.id;
}

export function assistantEligibilityTypeId(part: Readonly<MidweekPartDefinition>): string {
  return part.assistantEligibilityTypeId ?? part.eligibilityTypeId ?? part.id;
}

export function nonStudentEligibilityTypeId(
  role: string,
  partDefinition?: Readonly<MidweekPartDefinition>,
): string {
  const normalized = role.trim();
  if (!normalized) throw new Error('role is required');
  if (partDefinition?.id === normalized && partDefinition.eligibilityTypeId) return partDefinition.eligibilityTypeId;
  return STANDARD_ROLE_ELIGIBILITY[normalized] ?? normalized;
}

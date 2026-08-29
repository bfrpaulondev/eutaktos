import type { AssignmentTypeId, TenantId } from './people';

export type MidweekPartId = string;

export type MidweekPartType =
  | 'opening-remarks'
  | 'treasures-from-gods-word'
  | 'apply-yourself-to-the-ministry'
  | 'living-as-christians';

export const MIDWEEK_PART_TYPES: readonly MidweekPartType[] = Object.freeze([
  'opening-remarks',
  'treasures-from-gods-word',
  'apply-yourself-to-the-ministry',
  'living-as-christians',
] as const);

export type AssistantRequirement = 'none' | 'required' | 'optional';

export const VALID_ASSISTANT_REQUIREMENTS: readonly AssistantRequirement[] = Object.freeze([
  'none', 'required', 'optional',
] as const);

export interface TenantDurationOverride {
  readonly tenantId: TenantId;
  readonly durationMinutes: number;
}

export interface MidweekPartDefinition {
  readonly id: MidweekPartId;
  readonly type: MidweekPartType;
  readonly titleKey: string;
  readonly durationMinutes: number;
  readonly position: number;
  readonly studentNeeded: boolean;
  readonly assistantRequirement: AssistantRequirement;
  readonly eligibilityTypeId?: AssignmentTypeId;
  readonly assistantEligibilityTypeId?: AssignmentTypeId;
  readonly tenantOverrides: readonly TenantDurationOverride[];
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function optionalId(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = required(value, field);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

function validateDuration(value: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${field} must be a number`);
  if (!Number.isInteger(value)) throw new Error(`${field} must be an integer`);
  if (value < 1) throw new Error(`${field} must be at least 1`);
  if (value > 999) throw new Error(`${field} must be at most 999`);
  return value;
}

function validatePosition(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('position must be a number');
  if (!Number.isInteger(value)) throw new Error('position must be an integer');
  if (value < 1) throw new Error('position must be at least 1');
  if (value > 100) throw new Error('position must be at most 100');
  return value;
}

function assertValidType(type: string): MidweekPartType {
  if (!MIDWEEK_PART_TYPES.includes(type as MidweekPartType)) throw new Error(`Unknown midweek part type: ${type}`);
  return type as MidweekPartType;
}

function assertValidAssistantRequirement(value: string): AssistantRequirement {
  if (!VALID_ASSISTANT_REQUIREMENTS.includes(value as AssistantRequirement)) throw new Error(`Invalid assistantRequirement: ${value}`);
  return value as AssistantRequirement;
}

function normalizeTenantOverrides(overrides: readonly TenantDurationOverride[]): readonly TenantDurationOverride[] {
  if (!Array.isArray(overrides)) throw new Error('tenantOverrides must be an array');
  const seen = new Set<string>();
  return Object.freeze(overrides.map((override, index) => {
    const tenantId = required(override.tenantId, `tenantOverrides[${index}].tenantId`);
    if (seen.has(tenantId)) throw new Error(`Duplicate tenant override at index ${index}: ${tenantId}`);
    seen.add(tenantId);
    return Object.freeze({ tenantId, durationMinutes: validateDuration(override.durationMinutes, `tenantOverrides[${index}].durationMinutes`) });
  }));
}

export function createMidweekPartDefinition(input: {
  id: MidweekPartId;
  type: MidweekPartType;
  titleKey: string;
  durationMinutes: number;
  position: number;
  studentNeeded: boolean;
  assistantRequirement: AssistantRequirement;
  eligibilityTypeId?: AssignmentTypeId;
  assistantEligibilityTypeId?: AssignmentTypeId;
  tenantOverrides?: readonly TenantDurationOverride[];
}): Readonly<MidweekPartDefinition> {
  const id = required(input.id, 'id');
  const type = assertValidType(input.type);
  const titleKey = required(input.titleKey, 'titleKey');
  if (titleKey.length > 200) throw new Error('titleKey is too long (max 200)');
  const durationMinutes = validateDuration(input.durationMinutes, 'durationMinutes');
  const position = validatePosition(input.position);
  if (typeof input.studentNeeded !== 'boolean') throw new Error('studentNeeded must be a boolean');
  const studentNeeded = input.studentNeeded;
  const assistantRequirement = assertValidAssistantRequirement(input.assistantRequirement);
  const eligibilityTypeId = optionalId(input.eligibilityTypeId, 'eligibilityTypeId');
  const assistantEligibilityTypeId = optionalId(input.assistantEligibilityTypeId, 'assistantEligibilityTypeId');
  if (assistantRequirement === 'none' && assistantEligibilityTypeId !== undefined) throw new Error('assistantEligibilityTypeId requires an assistant-capable part');
  const tenantOverrides = normalizeTenantOverrides(input.tenantOverrides ?? []);
  return Object.freeze({
    id, type, titleKey, durationMinutes, position, studentNeeded, assistantRequirement,
    ...(eligibilityTypeId ? { eligibilityTypeId } : {}),
    ...(assistantEligibilityTypeId ? { assistantEligibilityTypeId } : {}),
    tenantOverrides,
  });
}

export function normalizeMidweekPartDefinition(input: MidweekPartDefinition): Readonly<MidweekPartDefinition> {
  return createMidweekPartDefinition({
    id: input.id,
    type: input.type,
    titleKey: input.titleKey,
    durationMinutes: input.durationMinutes,
    position: input.position,
    studentNeeded: input.studentNeeded,
    assistantRequirement: input.assistantRequirement,
    ...(input.eligibilityTypeId ? { eligibilityTypeId: input.eligibilityTypeId } : {}),
    ...(input.assistantEligibilityTypeId ? { assistantEligibilityTypeId: input.assistantEligibilityTypeId } : {}),
    tenantOverrides: input.tenantOverrides,
  });
}

export function applyTenantOverride(
  part: Readonly<MidweekPartDefinition>,
  tenantId: TenantId,
  overrideDurationMinutes: number,
): Readonly<MidweekPartDefinition> {
  required(tenantId, 'tenantId');
  const durationMinutes = validateDuration(overrideDurationMinutes, 'overrideDurationMinutes');
  const existingIndex = part.tenantOverrides.findIndex(override => override.tenantId === tenantId);
  const next = Object.freeze({ tenantId, durationMinutes });
  const tenantOverrides = existingIndex >= 0
    ? Object.freeze([...part.tenantOverrides.slice(0, existingIndex), next, ...part.tenantOverrides.slice(existingIndex + 1)])
    : Object.freeze([...part.tenantOverrides, next]);
  return Object.freeze({ ...part, tenantOverrides });
}

export function resolveEffectiveDuration(part: Readonly<MidweekPartDefinition>, tenantId: TenantId): number {
  return part.tenantOverrides.find(override => override.tenantId === tenantId)?.durationMinutes ?? part.durationMinutes;
}

export function removeTenantOverride(part: Readonly<MidweekPartDefinition>, tenantId: TenantId): Readonly<MidweekPartDefinition> {
  required(tenantId, 'tenantId');
  const filtered = part.tenantOverrides.filter(override => override.tenantId !== tenantId);
  if (filtered.length === part.tenantOverrides.length) return part;
  return Object.freeze({ ...part, tenantOverrides: Object.freeze(filtered) });
}

export function assertMidweekPartTenantScope(part: Readonly<MidweekPartDefinition>, tenantId: TenantId): void {
  required(tenantId, 'tenantId');
  for (const override of part.tenantOverrides) if (override.tenantId !== tenantId) throw new Error('Cross-tenant midweek part override access denied');
}

export function sortByPosition(parts: readonly Readonly<MidweekPartDefinition>[]): readonly Readonly<MidweekPartDefinition>[] {
  return [...parts].sort((a, b) => a.position - b.position);
}

export function filterByType(parts: readonly Readonly<MidweekPartDefinition>[], type: MidweekPartType): readonly Readonly<MidweekPartDefinition>[] {
  assertValidType(type);
  return parts.filter(part => part.type === type);
}

/** Legacy section-level defaults remain the stable public built-in catalog. */
const LEGACY_MIDWEEK_PARTS: readonly Readonly<MidweekPartDefinition>[] = Object.freeze([
  createMidweekPartDefinition({ id: 'builtin:opening-remarks', type: 'opening-remarks', titleKey: 'midweek.parts.openingRemarks', durationMinutes: 5, position: 1, studentNeeded: false, assistantRequirement: 'none' }),
  createMidweekPartDefinition({ id: 'builtin:treasures-from-gods-word', type: 'treasures-from-gods-word', titleKey: 'midweek.parts.treasuresFromGodsWord', durationMinutes: 10, position: 2, studentNeeded: false, assistantRequirement: 'none' }),
  createMidweekPartDefinition({ id: 'builtin:apply-yourself-to-the-ministry', type: 'apply-yourself-to-the-ministry', titleKey: 'midweek.parts.applyYourselfToTheMinistry', durationMinutes: 30, position: 3, studentNeeded: true, assistantRequirement: 'optional' }),
  createMidweekPartDefinition({ id: 'builtin:living-as-christians', type: 'living-as-christians', titleKey: 'midweek.parts.livingAsChristians', durationMinutes: 30, position: 4, studentNeeded: true, assistantRequirement: 'required' }),
]);

/**
 * Detailed operational definitions aligned to explicit Hourglass privilege
 * categories. New Midweek scheduling uses this catalog directly; no spiritual
 * qualification is inferred from demographics or history.
 */
export const OPERATIONAL_MIDWEEK_PARTS: ReadonlyArray<Readonly<MidweekPartDefinition>> = Object.freeze([
  createMidweekPartDefinition({ id: 'midweek:treasures-talk', type: 'treasures-from-gods-word', titleKey: 'midweek.parts.treasuresTalk', durationMinutes: 10, position: 10, studentNeeded: false, assistantRequirement: 'none', eligibilityTypeId: 'hourglass:treasures' }),
  createMidweekPartDefinition({ id: 'midweek:spiritual-gems', type: 'treasures-from-gods-word', titleKey: 'midweek.parts.spiritualGems', durationMinutes: 10, position: 11, studentNeeded: false, assistantRequirement: 'none', eligibilityTypeId: 'hourglass:dfg' }),
  createMidweekPartDefinition({ id: 'midweek:bible-reading', type: 'treasures-from-gods-word', titleKey: 'midweek.parts.bibleReading', durationMinutes: 4, position: 12, studentNeeded: true, assistantRequirement: 'none', eligibilityTypeId: 'hourglass:reading' }),
  createMidweekPartDefinition({ id: 'midweek:initial-call', type: 'apply-yourself-to-the-ministry', titleKey: 'midweek.parts.initialCall', durationMinutes: 4, position: 20, studentNeeded: true, assistantRequirement: 'optional', eligibilityTypeId: 'hourglass:initcall', assistantEligibilityTypeId: 'hourglass:hh' }),
  createMidweekPartDefinition({ id: 'midweek:return-visit', type: 'apply-yourself-to-the-ministry', titleKey: 'midweek.parts.returnVisit', durationMinutes: 4, position: 21, studentNeeded: true, assistantRequirement: 'optional', eligibilityTypeId: 'hourglass:rv', assistantEligibilityTypeId: 'hourglass:hh' }),
  createMidweekPartDefinition({ id: 'midweek:make-disciples', type: 'apply-yourself-to-the-ministry', titleKey: 'midweek.parts.makeDisciples', durationMinutes: 5, position: 22, studentNeeded: true, assistantRequirement: 'optional', eligibilityTypeId: 'hourglass:study', assistantEligibilityTypeId: 'hourglass:hh' }),
  createMidweekPartDefinition({ id: 'midweek:student-talk', type: 'apply-yourself-to-the-ministry', titleKey: 'midweek.parts.studentTalk', durationMinutes: 5, position: 23, studentNeeded: true, assistantRequirement: 'none', eligibilityTypeId: 'hourglass:stutalk' }),
  createMidweekPartDefinition({ id: 'midweek:living-christians-part', type: 'living-as-christians', titleKey: 'midweek.parts.livingChristiansPart', durationMinutes: 15, position: 30, studentNeeded: false, assistantRequirement: 'none', eligibilityTypeId: 'hourglass:lac' }),
  createMidweekPartDefinition({ id: 'midweek:congregation-bible-study', type: 'living-as-christians', titleKey: 'midweek.parts.congregationBibleStudy', durationMinutes: 30, position: 31, studentNeeded: false, assistantRequirement: 'none', eligibilityTypeId: 'hourglass:cbs' }),
  createMidweekPartDefinition({ id: 'midweek:congregation-bible-study-reader', type: 'living-as-christians', titleKey: 'midweek.parts.congregationBibleStudyReader', durationMinutes: 30, position: 32, studentNeeded: false, assistantRequirement: 'none', eligibilityTypeId: 'hourglass:cbs_reader' }),
]);

export const BUILTIN_MIDWEEK_PARTS: ReadonlyArray<Readonly<MidweekPartDefinition>> = LEGACY_MIDWEEK_PARTS;

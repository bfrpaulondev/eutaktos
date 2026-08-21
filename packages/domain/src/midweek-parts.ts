import type { TenantId } from './people';

// ── Types ──────────────────────────────────────────────────────────────────

export type MidweekPartId = string;

/**
 * Canonical part types for the midweek meeting. Title keys only — never UI text.
 */
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

/**
 * Whether an assistant is needed for this part.
 * 'none'      — no assistant is applicable.
 * 'required'  — the part always requires an assistant.
 * 'optional'  — an assistant may optionally be assigned.
 */
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
  readonly tenantOverrides: readonly TenantDurationOverride[];
}

// ── Internal helpers ───────────────────────────────────────────────────────

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateDuration(value: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a number`);
  }
  if (!Number.isInteger(value)) throw new Error(`${field} must be an integer`);
  if (value < 1) throw new Error(`${field} must be at least 1`);
  if (value > 999) throw new Error(`${field} must be at most 999`);
  return value;
}

function validatePosition(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('position must be a number');
  }
  if (!Number.isInteger(value)) throw new Error('position must be an integer');
  if (value < 1) throw new Error('position must be at least 1');
  if (value > 100) throw new Error('position must be at most 100');
  return value;
}

function assertValidType(type: string): MidweekPartType {
  if (!MIDWEEK_PART_TYPES.includes(type as MidweekPartType)) {
    throw new Error(`Unknown midweek part type: ${type}`);
  }
  return type as MidweekPartType;
}

function assertValidAssistantRequirement(value: string): AssistantRequirement {
  if (!VALID_ASSISTANT_REQUIREMENTS.includes(value as AssistantRequirement)) {
    throw new Error(`Invalid assistantRequirement: ${value}`);
  }
  return value as AssistantRequirement;
}

function normalizeTenantOverrides(overrides: readonly TenantDurationOverride[]): readonly TenantDurationOverride[] {
  if (!Array.isArray(overrides)) throw new Error('tenantOverrides must be an array');
  const seen = new Set<string>();
  return Object.freeze(
    overrides.map((o, i) => {
      const tenantId = required(o.tenantId, `tenantOverrides[${i}].tenantId`);
      if (seen.has(tenantId)) throw new Error(`Duplicate tenant override at index ${i}: ${tenantId}`);
      seen.add(tenantId);
      const durationMinutes = validateDuration(o.durationMinutes, `tenantOverrides[${i}].durationMinutes`);
      return Object.freeze({ tenantId, durationMinutes } as const);
    }),
  );
}

// ── Construction ───────────────────────────────────────────────────────────

export function createMidweekPartDefinition(input: {
  id: MidweekPartId;
  type: MidweekPartType;
  titleKey: string;
  durationMinutes: number;
  position: number;
  studentNeeded: boolean;
  assistantRequirement: AssistantRequirement;
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
  const tenantOverrides = normalizeTenantOverrides(input.tenantOverrides ?? []);

  return Object.freeze({
    id, type, titleKey, durationMinutes, position,
    studentNeeded, assistantRequirement, tenantOverrides,
  });
}

// ── Normalization ──────────────────────────────────────────────────────────

export function normalizeMidweekPartDefinition(
  input: MidweekPartDefinition,
): Readonly<MidweekPartDefinition> {
  const id = required(input.id, 'id');
  const type = assertValidType(input.type);
  const titleKey = required(input.titleKey, 'titleKey');
  if (titleKey.length > 200) throw new Error('titleKey is too long (max 200)');
  const durationMinutes = validateDuration(input.durationMinutes, 'durationMinutes');
  const position = validatePosition(input.position);
  if (typeof input.studentNeeded !== 'boolean') throw new Error('studentNeeded must be a boolean');
  const studentNeeded = input.studentNeeded;
  const assistantRequirement = assertValidAssistantRequirement(input.assistantRequirement);
  const tenantOverrides = normalizeTenantOverrides(input.tenantOverrides);

  return Object.freeze({
    id, type, titleKey, durationMinutes, position,
    studentNeeded, assistantRequirement, tenantOverrides,
  });
}

// ── Tenant customization ───────────────────────────────────────────────────

/**
 * Applies a tenant-level duration override to a part definition.
 * Returns a new frozen MidweekPartDefinition with the overridden duration.
 */
export function applyTenantOverride(
  part: Readonly<MidweekPartDefinition>,
  tenantId: TenantId,
  overrideDurationMinutes: number,
): Readonly<MidweekPartDefinition> {
  required(tenantId, 'tenantId');
  const durationMinutes = validateDuration(overrideDurationMinutes, 'overrideDurationMinutes');

  const existingIndex = part.tenantOverrides.findIndex(o => o.tenantId === tenantId);
  const newOverride = Object.freeze({ tenantId, durationMinutes } as const);

  let newOverrides: readonly TenantDurationOverride[];
  if (existingIndex >= 0) {
    newOverrides = Object.freeze([
      ...part.tenantOverrides.slice(0, existingIndex),
      newOverride,
      ...part.tenantOverrides.slice(existingIndex + 1),
    ]);
  } else {
    newOverrides = Object.freeze([...part.tenantOverrides, newOverride]);
  }

  return Object.freeze({ ...part, tenantOverrides: newOverrides });
}

/**
 * Resolves the effective duration for a part, considering any tenant override.
 */
export function resolveEffectiveDuration(
  part: Readonly<MidweekPartDefinition>,
  tenantId: TenantId,
): number {
  const override = part.tenantOverrides.find(o => o.tenantId === tenantId);
  return override ? override.durationMinutes : part.durationMinutes;
}

/**
 * Removes a tenant-level duration override from a part definition.
 */
export function removeTenantOverride(
  part: Readonly<MidweekPartDefinition>,
  tenantId: TenantId,
): Readonly<MidweekPartDefinition> {
  required(tenantId, 'tenantId');
  const filtered = part.tenantOverrides.filter(o => o.tenantId !== tenantId);
  if (filtered.length === part.tenantOverrides.length) return part;
  return Object.freeze({ ...part, tenantOverrides: Object.freeze(filtered) });
}

// ── Tenant isolation ───────────────────────────────────────────────────────

/**
 * Asserts that the part definition's tenant overrides belong only to the given tenant.
 * This is used when a part is tenant-scoped and overrides must match.
 */
export function assertMidweekPartTenantScope(
  part: Readonly<MidweekPartDefinition>,
  tenantId: TenantId,
): void {
  required(tenantId, 'tenantId');
  for (const override of part.tenantOverrides) {
    if (override.tenantId !== tenantId) {
      throw new Error('Cross-tenant midweek part override access denied');
    }
  }
}

// ── Query helpers ──────────────────────────────────────────────────────────

/**
 * Returns parts sorted by position (deterministic ordering).
 */
export function sortByPosition(
  parts: readonly Readonly<MidweekPartDefinition>[],
): readonly Readonly<MidweekPartDefinition>[] {
  return [...parts].sort((a, b) => a.position - b.position);
}

/**
 * Filters parts by type.
 */
export function filterByType(
  parts: readonly Readonly<MidweekPartDefinition>[],
  type: MidweekPartType,
): readonly Readonly<MidweekPartDefinition>[] {
  assertValidType(type);
  return parts.filter(p => p.type === type);
}

// ── Built-in defaults ──────────────────────────────────────────────────────

/**
 * Built-in default part definitions for a standard midweek meeting.
 * Tenants can use these as a starting point and apply overrides as needed.
 * Title keys are localization-safe strings — never UI text.
 */
export const BUILTIN_MIDWEEK_PARTS: ReadonlyArray<Readonly<MidweekPartDefinition>> = Object.freeze([
  createMidweekPartDefinition({
    id: 'builtin:opening-remarks',
    type: 'opening-remarks',
    titleKey: 'midweek.parts.openingRemarks',
    durationMinutes: 5,
    position: 1,
    studentNeeded: false,
    assistantRequirement: 'none',
  }),
  createMidweekPartDefinition({
    id: 'builtin:treasures-from-gods-word',
    type: 'treasures-from-gods-word',
    titleKey: 'midweek.parts.treasuresFromGodsWord',
    durationMinutes: 10,
    position: 2,
    studentNeeded: false,
    assistantRequirement: 'none',
  }),
  createMidweekPartDefinition({
    id: 'builtin:apply-yourself-to-the-ministry',
    type: 'apply-yourself-to-the-ministry',
    titleKey: 'midweek.parts.applyYourselfToTheMinistry',
    durationMinutes: 30,
    position: 3,
    studentNeeded: true,
    assistantRequirement: 'optional',
  }),
  createMidweekPartDefinition({
    id: 'builtin:living-as-christians',
    type: 'living-as-christians',
    titleKey: 'midweek.parts.livingAsChristians',
    durationMinutes: 30,
    position: 4,
    studentNeeded: true,
    assistantRequirement: 'required',
  }),
]);

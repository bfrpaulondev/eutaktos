// ---- Talk Outline Domain Primitives ----
// K36: Public Talk Outline domain model

import type { TenantId } from './people';

export type TalkOutlineId = string;

// ---- BCP 47 Language Tag Validation ----

const BCP47_PATTERN = /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/;

/**
 * Normalizes a BCP 47 language tag: lowercase the primary subtag,
 * lowercase all subtags, trim whitespace.
 * Does NOT validate — use validateTalkOutline for full validation.
 */
export function normalizeLanguageTag(tag: string): string {
  if (typeof tag !== 'string') throw new Error('language must be a string');
  const trimmed = tag.trim();
  if (!trimmed) throw new Error('language is required');
  return trimmed.toLowerCase();
}

function validateLanguageTag(tag: string): string {
  const normalized = normalizeLanguageTag(tag);
  if (!BCP47_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid BCP 47 language tag: "${String(tag)}"`,
    );
  }
  return normalized;
}

// ---- Types ----

export interface TalkOutlineInput {
  id: TalkOutlineId;
  tenantId: TenantId;
  title: string;
  language: string;
  active?: boolean;
  number?: number;
  category?: string;
}

export interface TalkOutlineChanges {
  title?: string;
  language?: string;
  number?: number | undefined;
  category?: string | undefined;
}

export interface TalkOutline {
  readonly id: TalkOutlineId;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly language: string;
  readonly active: boolean;
  readonly number: number | undefined;
  readonly category: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---- Internal helpers ----

const MAX_TITLE_LENGTH = 300;
const MAX_OUTLINE_ID_LENGTH = 100;
const MAX_CATEGORY_LENGTH = 100;

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ISO date: ${String(value)}`);
  }
}

function validateTitle(title: string): string {
  const normalized = required(title, 'title');
  if (normalized.length > MAX_TITLE_LENGTH) {
    throw new Error(`title is too long (max ${MAX_TITLE_LENGTH})`);
  }
  return normalized;
}

function validateOutlineId(id: string): string {
  const normalized = required(id, 'id');
  if (normalized.length > MAX_OUTLINE_ID_LENGTH) {
    throw new Error(`id is too long (max ${MAX_OUTLINE_ID_LENGTH})`);
  }
  return normalized;
}

function validateOptionalCategory(
  value: string | undefined,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim().replace(/\s+/g, ' ');
  if (trimmed.length > MAX_CATEGORY_LENGTH) {
    throw new Error(`category is too long (max ${MAX_CATEGORY_LENGTH})`);
  }
  return trimmed || undefined;
}

function validateOptionalNumber(value: number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('number must be a finite number');
  }
  return value;
}

// ---- Public API ----

/**
 * Validates a TalkOutlineInput without creating an entity.
 */
export function validateTalkOutline(input: TalkOutlineInput): void {
  validateOutlineId(input.id);
  required(input.tenantId, 'tenantId');
  validateTitle(input.title);
  validateLanguageTag(input.language);
  if (input.active !== undefined && typeof input.active !== 'boolean') {
    throw new Error('active must be a boolean');
  }
  validateOptionalNumber(input.number);
  validateOptionalCategory(input.category);
}

/**
 * Factory: creates a frozen TalkOutline entity.
 */
export function createTalkOutline(
  input: TalkOutlineInput,
  now: string,
): Readonly<TalkOutline> {
  validateInstant(now);
  validateTalkOutline(input);

  const id = validateOutlineId(input.id);
  const tenantId = required(input.tenantId, 'tenantId');
  const title = validateTitle(input.title);
  const language = validateLanguageTag(input.language);
  const active = input.active !== undefined ? input.active : true;
  const number = validateOptionalNumber(input.number);
  const category = validateOptionalCategory(input.category);

  return Object.freeze({
    id,
    tenantId,
    title,
    language,
    active,
    number,
    category,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Updates a TalkOutline with the given changes. Returns a new frozen object.
 */
export function updateTalkOutline(
  outline: Readonly<TalkOutline>,
  changes: TalkOutlineChanges,
  now: string,
): Readonly<TalkOutline> {
  validateInstant(now);

  return Object.freeze({
    ...outline,
    ...(changes.title !== undefined
      ? { title: validateTitle(changes.title) }
      : {}),
    ...(changes.language !== undefined
      ? { language: validateLanguageTag(changes.language) }
      : {}),
    ...(changes.number !== undefined
      ? { number: validateOptionalNumber(changes.number) }
      : {}),
    ...(changes.category !== undefined
      ? { category: validateOptionalCategory(changes.category) }
      : {}),
    updatedAt: now,
  });
}

/**
 * Deactivates a TalkOutline (sets active=false). Idempotent.
 */
export function deactivateTalkOutline(
  outline: Readonly<TalkOutline>,
  now: string,
): Readonly<TalkOutline> {
  validateInstant(now);
  if (!outline.active) return outline;
  return Object.freeze({ ...outline, active: false, updatedAt: now });
}

/**
 * Activates a TalkOutline (sets active=true). Idempotent.
 */
export function activateTalkOutline(
  outline: Readonly<TalkOutline>,
  now: string,
): Readonly<TalkOutline> {
  validateInstant(now);
  if (outline.active) return outline;
  return Object.freeze({ ...outline, active: true, updatedAt: now });
}

/**
 * Guard: throws if outline does not belong to the given tenant.
 */
export function assertOutlineTenant(
  outline: Readonly<TalkOutline>,
  tenantId: TenantId,
): void {
  if (outline.tenantId !== tenantId) {
    throw new Error('Cross-tenant outline access denied');
  }
}

/**
 * Query: filters outlines by tenant.
 */
export function filterOutlinesByTenant(
  outlines: readonly Readonly<TalkOutline>[],
  tenantId: TenantId,
): readonly Readonly<TalkOutline>[] {
  return outlines.filter(o => o.tenantId === tenantId);
}

/**
 * Query: filters only active outlines.
 */
export function filterActiveOutlines(
  outlines: readonly Readonly<TalkOutline>[],
): readonly Readonly<TalkOutline>[] {
  return outlines.filter(o => o.active);
}

/**
 * Query: filters outlines by language (case-insensitive match on normalized tag).
 */
export function filterOutlinesByLanguage(
  outlines: readonly Readonly<TalkOutline>[],
  language: string,
): readonly Readonly<TalkOutline>[] {
  const normalized = language.trim().toLowerCase();
  return outlines.filter(o => o.language === normalized);
}

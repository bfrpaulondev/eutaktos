import type { TenantId } from './people';

// ── Types ──────────────────────────────────────────────────────────────────

export type NotificationTemplateId = string;
export type LocaleCode = string;

/**
 * A stable template key identifies the kind of notification independently of
 * locale. Examples: 'assignment.reminder', 'meeting.cancelled', 'notice.emergency'.
 */
export type TemplateKey = string;

/**
 * A single localized template variant. The body is a plain-text string with
 * placeholder holes delimited by double curly braces: {{variableName}}.
 */
export interface LocalizedTemplate {
  readonly locale: LocaleCode;
  readonly subject: string;
  readonly body: string;
  /**
 * The set of variable names that this template expects.
 * Must match exactly the {{…}} placeholders found in subject + body.
 */
 readonly allowedVariables: readonly string[];
}

/**
 * A notification template aggregate: one template key mapped to one or more
 * locale variants. Tenant-scoped so each congregation can customize templates.
 */
export interface NotificationTemplate {
  readonly id: NotificationTemplateId;
  readonly tenantId: TenantId;
  readonly key: TemplateKey;
  readonly locales: readonly LocalizedTemplate[];
  /**
 * The fallback locale used when no match is found for a requested locale.
 * Must be one of the locale codes present in the locales array.
 */
  readonly fallbackLocale: LocaleCode;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The result of rendering a template with concrete variable values.
 */
export interface RenderedTemplate {
  readonly locale: LocaleCode;
  readonly subject: string;
  readonly body: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
}

/**
 * Extracts all {{variableName}} placeholders from a string.
 * Returns deduplicated, sorted variable names.
 */
function extractPlaceholders(text: string): readonly string[] {
  const regex = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    found.add(match[1]);
  }
  return [...found].sort();
}

/**
 * Validates that a locale code is a reasonable BCP-47 tag.
 * We deliberately keep this permissive: two or three letter language code,
 * optionally followed by '-' and a region/variant subtag.
 */
function validateLocaleCode(locale: string): void {
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$/.test(locale)) {
    throw new Error(`Invalid locale code: ${locale}`);
  }
}

/**
 * Validates that a template key follows the expected format:
 * dot-separated segments, each starting with a letter, containing only
 * lowercase alphanumeric and hyphens. Example: 'assignment.reminder'.
 */
function validateTemplateKey(key: string): void {
  if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(key)) {
    throw new Error(`Invalid template key format: ${key}`);
  }
}

/**
 * Validates that a variable name is a safe identifier: starts with a letter,
 * followed by letters, digits, or underscores.
 */
function validateVariableName(name: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Invalid variable name: ${name}`);
  }
}

// ── Escaping ───────────────────────────────────────────────────────────────

/**
 * Escapes characters that could be dangerous in plain-text notification bodies.
 * This is a defensive measure — the template system outputs plain text,
 * but downstream renderers (HTML, markdown, push payload) must still escape
 * for their own context. This layer catches control characters and other
 * dangerous sequences that should never appear in a notification.
 *
 * Specifically strips/excapes:
 * - Null bytes
 * - Control characters (C0 except \t, \n, \r)
 * - Unicode bidi control characters (U+200E–U+200F, U+202A–U+202E, U+2066–U+2069)
 */
export function escapeTemplateValue(value: string): string {
  return value
    .replace(/\u0000/g, '')                          // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '') // C0 controls except tab/newline/CR
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, ''); // bidi controls
}

// ── Construction ───────────────────────────────────────────────────────────

/**
 * Creates a validated, immutable NotificationTemplate.
 * All validation is performed eagerly — invalid data is rejected immediately.
 */
export function createNotificationTemplate(input: {
  id: NotificationTemplateId;
  tenantId: TenantId;
  key: TemplateKey;
  locales: readonly LocalizedTemplate[];
  fallbackLocale: LocaleCode;
  now: string;
}): Readonly<NotificationTemplate> {
  const id = required(input.id, 'notificationTemplateId');
  const tenantId = required(input.tenantId, 'tenantId');
  const key = required(input.key, 'templateKey');
  validateTemplateKey(key);
  validateInstant(input.now);

  const fallbackLocale = required(input.fallbackLocale, 'fallbackLocale');
  validateLocaleCode(fallbackLocale);

  if (input.locales.length === 0) {
    throw new Error('At least one locale is required');
  }

  const locales = input.locales.map((loc, i) => validateLocalizedTemplate(loc, i));

  // Fallback locale must be present
  const localeCodes = locales.map(l => l.locale);
  if (!localeCodes.includes(fallbackLocale)) {
    throw new Error(
      `Fallback locale '${fallbackLocale}' is not present in the template locales`,
    );
  }

  // No duplicate locales
  const seen = new Set<string>();
  for (const loc of locales) {
    if (seen.has(loc.locale)) throw new Error(`Duplicate locale: ${loc.locale}`);
    seen.add(loc.locale);
  }

  return Object.freeze({
    id,
    tenantId,
    key,
    locales: Object.freeze(locales),
    fallbackLocale,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

/**
 * Validates and normalizes a single LocalizedTemplate.
 */
export function validateLocalizedTemplate(
  loc: LocalizedTemplate,
  index?: number,
): Readonly<LocalizedTemplate> {
  const ctx = index !== undefined ? ` at index ${index}` : '';
  const locale = required(loc.locale, `locale${ctx}`);
  validateLocaleCode(locale);

  const subject = loc.subject; // subject can be empty but not whitespace-only
  if (typeof subject !== 'string') throw new Error(`subject must be a string${ctx}`);
  if (subject.length > 500) throw new Error(`subject is too long${ctx}`);

  const body = loc.body;
  if (typeof body !== 'string') throw new Error(`body must be a string${ctx}`);
  if (!body.trim()) throw new Error(`body is required${ctx}`);
  if (body.length > 5000) throw new Error(`body is too long (max 5000 chars)${ctx}`);

  // Extract placeholders and validate variable names
  const placeholders = extractPlaceholders(subject + body);
  for (const ph of placeholders) {
    validateVariableName(ph);
  }

  // Validate allowedVariables
  const allowed = [...new Set((loc.allowedVariables ?? []).map(v => {
    validateVariableName(v);
    return v;
  }))].sort();

  // allowedVariables must match exactly the extracted placeholders
  const allowedSet = new Set(allowed);
  const placeholderSet = new Set(placeholders);

  // Check for variables in template not in allowlist
  for (const ph of placeholders) {
    if (!allowedSet.has(ph)) {
      throw new Error(
        `Template variable '{{${ph}}}' is not in the allowlist${ctx}`,
      );
    }
  }

  // Check for variables in allowlist not in template
  for (const av of allowed) {
    if (!placeholderSet.has(av)) {
      throw new Error(
        `Allowed variable '${av}' is not used in the template${ctx}`,
      );
    }
  }

  return Object.freeze({
    locale,
    subject,
    body,
    allowedVariables: Object.freeze(allowed),
  });
}

// ── Locale resolution ──────────────────────────────────────────────────────

/**
 * Finds the best matching locale using a deterministic fallback chain:
 * 1. Exact match
 * 2. Language-only prefix match (e.g. 'pt-BR' → 'pt')
 * 3. Fallback locale defined in the template
 *
 * Returns undefined only if the template has no locales (which construction prevents).
 */
export function resolveLocale(
  template: Readonly<NotificationTemplate>,
  requestedLocale: LocaleCode,
): Readonly<LocalizedTemplate> {
  const locales = template.locales;

  // 1. Exact match
  const exact = locales.find(l => l.locale === requestedLocale);
  if (exact) return exact;

  // 2. Language-only prefix match
  const langPrefix = requestedLocale.split('-')[0];
  const prefixMatch = locales.find(l => l.locale.split('-')[0] === langPrefix);
  if (prefixMatch) return prefixMatch;

  // 3. Fallback locale (guaranteed to exist by construction)
  const fallback = locales.find(l => l.locale === template.fallbackLocale);
  if (fallback) return fallback;

  // Should never reach here if template was constructed correctly
  throw new Error(`No locale found for template '${template.key}'`);
}

// ── Rendering ──────────────────────────────────────────────────────────────

/**
 * Renders a LocalizedTemplate by replacing {{variableName}} placeholders
 * with the corresponding values from the variables map.
 *
 * Security:
 * - Only variables in the allowlist are substituted.
 * - Unexpected keys in the variables map are silently ignored.
 * - All values are escaped via escapeTemplateValue before insertion.
 * - The rendering is deterministic: same inputs → same output.
 *
 * Throws if a required allowlisted variable is missing from the variables map.
 */
export function renderTemplate(
  localeTemplate: Readonly<LocalizedTemplate>,
  variables: Readonly<Record<string, string>>,
): RenderedTemplate {
  const allowSet = new Set(localeTemplate.allowedVariables);

  // Check all required variables are present
  for (const varName of localeTemplate.allowedVariables) {
    if (!(varName in variables)) {
      throw new Error(`Missing required variable: ${varName}`);
    }
  }

  // Build replacement map — only allowlisted variables
  const safeValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (allowSet.has(key)) {
      safeValues[key] = escapeTemplateValue(String(value));
    }
    // Unexpected keys are silently ignored — no information leakage
  }

  // Replace placeholders deterministically
  const replace = (text: string): string => {
    return text.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g, (_match, varName: string) => {
      return safeValues[varName] ?? `{{${varName}}}`;
    });
  };

  return Object.freeze({
    locale: localeTemplate.locale,
    subject: replace(localeTemplate.subject),
    body: replace(localeTemplate.body),
  });
}

/**
 * Convenience: resolve locale and render in one step.
 */
export function renderNotificationTemplate(
  template: Readonly<NotificationTemplate>,
  requestedLocale: LocaleCode,
  variables: Readonly<Record<string, string>>,
): RenderedTemplate {
  const localeTemplate = resolveLocale(template, requestedLocale);
  return renderTemplate(localeTemplate, variables);
}

// ── Normalization ──────────────────────────────────────────────────────────

/**
 * Validates and normalizes an existing NotificationTemplate (e.g. from storage).
 */
export function normalizeNotificationTemplate(
  input: NotificationTemplate,
): Readonly<NotificationTemplate> {
  const id = required(input.id, 'notificationTemplateId');
  const tenantId = required(input.tenantId, 'tenantId');
  const key = required(input.key, 'templateKey');
  validateTemplateKey(key);
  validateInstant(input.createdAt);
  validateInstant(input.updatedAt);

  const fallbackLocale = required(input.fallbackLocale, 'fallbackLocale');
  validateLocaleCode(fallbackLocale);

  if (input.locales.length === 0) {
    throw new Error('At least one locale is required');
  }

  const locales = input.locales.map((loc, i) => validateLocalizedTemplate(loc, i));

  const localeCodes = locales.map(l => l.locale);
  if (!localeCodes.includes(fallbackLocale)) {
    throw new Error(
      `Fallback locale '${fallbackLocale}' is not present in the template locales`,
    );
  }

  const seen = new Set<string>();
  for (const loc of locales) {
    if (seen.has(loc.locale)) throw new Error(`Duplicate locale: ${loc.locale}`);
    seen.add(loc.locale);
  }

  return Object.freeze({
    id,
    tenantId,
    key,
    locales: Object.freeze(locales),
    fallbackLocale,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

// ── Tenant isolation ───────────────────────────────────────────────────────

/**
 * Asserts that the template belongs to the given tenant.
 */
export function assertTemplateTenant(
  template: Readonly<NotificationTemplate>,
  tenantId: TenantId,
): void {
  if (template.tenantId !== tenantId) {
    throw new Error('Cross-tenant template access denied');
  }
}

/**
 * Filters a list of templates to only those belonging to the given tenant.
 */
export function filterTemplatesByTenant(
  templates: readonly Readonly<NotificationTemplate>[],
  tenantId: TenantId,
): readonly Readonly<NotificationTemplate>[] {
  return templates.filter(t => t.tenantId === tenantId);
}

/**
 * Finds a template by key within a tenant-scoped list.
 */
export function findTemplateByKey(
  templates: readonly Readonly<NotificationTemplate>[],
  tenantId: TenantId,
  key: TemplateKey,
): Readonly<NotificationTemplate> | undefined {
  return templates.find(t => t.tenantId === tenantId && t.key === key);
}

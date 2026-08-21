import type { TenantId } from './people';

export type NotificationTemplateId = string;
export type LocaleCode = string;
export type TemplateKey = string;

export interface LocalizedTemplate {
  readonly locale: LocaleCode;
  readonly subject: string;
  readonly body: string;
  readonly allowedVariables: readonly string[];
}

export interface NotificationTemplate {
  readonly id: NotificationTemplateId;
  readonly tenantId: TenantId;
  readonly key: TemplateKey;
  readonly locales: readonly LocalizedTemplate[];
  readonly fallbackLocale: LocaleCode;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RenderedTemplate {
  readonly locale: LocaleCode;
  readonly subject: string;
  readonly body: string;
}

const PLACEHOLDER = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
const TEMPLATE_KEY = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const VARIABLE_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const LOCALE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*$/;

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ISO date: ${String(value)}`);
  }
}

function validateLocale(locale: string): void {
  if (!LOCALE.test(locale)) throw new Error(`Invalid locale code: ${locale}`);
}

function validateKey(key: string): void {
  if (!TEMPLATE_KEY.test(key)) throw new Error(`Invalid template key format: ${key}`);
}

function variablesIn(text: string): readonly string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER)) found.add(match[1]);
  return [...found].sort();
}

export function escapeTemplateValue(value: string): string {
  return String(value)
    .replace(/\u0000/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');
}

export function validateLocalizedTemplate(
  input: LocalizedTemplate,
  index?: number,
): Readonly<LocalizedTemplate> {
  const suffix = index === undefined ? '' : ` at index ${index}`;
  const locale = required(input.locale, `locale${suffix}`);
  validateLocale(locale);
  if (typeof input.subject !== 'string') throw new Error(`subject must be a string${suffix}`);
  if (input.subject.length > 500) throw new Error(`subject is too long${suffix}`);
  if (typeof input.body !== 'string' || !input.body.trim()) throw new Error(`body is required${suffix}`);
  if (input.body.length > 5000) throw new Error(`body is too long${suffix}`);
  if (!Array.isArray(input.allowedVariables)) throw new Error(`allowedVariables must be an array${suffix}`);

  const allowed = [...new Set(input.allowedVariables.map((value) => {
    const name = required(value, `allowedVariable${suffix}`);
    if (!VARIABLE_NAME.test(name)) throw new Error(`Invalid variable name: ${name}`);
    return name;
  }))].sort();
  const placeholders = variablesIn(`${input.subject}\n${input.body}`);
  for (const name of placeholders) {
    if (!allowed.includes(name)) throw new Error(`Template variable '{{${name}}}' is not in the allowlist${suffix}`);
  }
  for (const name of allowed) {
    if (!placeholders.includes(name)) throw new Error(`Allowed variable '${name}' is not used in the template${suffix}`);
  }

  return Object.freeze({
    locale,
    subject: input.subject,
    body: input.body,
    allowedVariables: Object.freeze(allowed),
  });
}

function normalizeLocales(locales: readonly LocalizedTemplate[]): readonly Readonly<LocalizedTemplate>[] {
  if (!Array.isArray(locales) || locales.length === 0) throw new Error('At least one locale is required');
  if (locales.length > 50) throw new Error('Too many locales (max 50)');
  const normalized = locales.map((locale, index) => validateLocalizedTemplate(locale, index));
  const seen = new Set<string>();
  for (const locale of normalized) {
    const key = locale.locale.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate locale: ${locale.locale}`);
    seen.add(key);
  }
  return Object.freeze(normalized);
}

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
  validateKey(key);
  validateInstant(input.now);
  const fallbackLocale = required(input.fallbackLocale, 'fallbackLocale');
  validateLocale(fallbackLocale);
  const locales = normalizeLocales(input.locales);
  if (!locales.some((locale) => locale.locale.toLowerCase() === fallbackLocale.toLowerCase())) {
    throw new Error(`Fallback locale '${fallbackLocale}' is not present in the template locales`);
  }
  return Object.freeze({ id, tenantId, key, locales, fallbackLocale, createdAt: input.now, updatedAt: input.now });
}

export function normalizeNotificationTemplate(input: NotificationTemplate): Readonly<NotificationTemplate> {
  const id = required(input.id, 'notificationTemplateId');
  const tenantId = required(input.tenantId, 'tenantId');
  const key = required(input.key, 'templateKey');
  validateKey(key);
  validateInstant(input.createdAt);
  validateInstant(input.updatedAt);
  if (Date.parse(input.updatedAt) < Date.parse(input.createdAt)) throw new Error('updatedAt must not be before createdAt');
  const fallbackLocale = required(input.fallbackLocale, 'fallbackLocale');
  validateLocale(fallbackLocale);
  const locales = normalizeLocales(input.locales);
  if (!locales.some((locale) => locale.locale.toLowerCase() === fallbackLocale.toLowerCase())) {
    throw new Error(`Fallback locale '${fallbackLocale}' is not present in the template locales`);
  }
  return Object.freeze({ id, tenantId, key, locales, fallbackLocale, createdAt: input.createdAt, updatedAt: input.updatedAt });
}

export function resolveLocale(
  template: Readonly<NotificationTemplate>,
  requestedLocale: LocaleCode,
): Readonly<LocalizedTemplate> {
  const requested = required(requestedLocale, 'requestedLocale');
  validateLocale(requested);
  const exact = template.locales.find((locale) => locale.locale.toLowerCase() === requested.toLowerCase());
  if (exact) return exact;
  const language = requested.split('-')[0].toLowerCase();
  const languageMatch = template.locales.find((locale) => locale.locale.split('-')[0].toLowerCase() === language);
  if (languageMatch) return languageMatch;
  const fallback = template.locales.find((locale) => locale.locale.toLowerCase() === template.fallbackLocale.toLowerCase());
  if (!fallback) throw new Error(`No locale found for template '${template.key}'`);
  return fallback;
}

export function renderTemplate(
  template: Readonly<LocalizedTemplate>,
  variables: Readonly<Record<string, string>>,
): RenderedTemplate {
  const safeValues = Object.create(null) as Record<string, string>;
  for (const name of template.allowedVariables) {
    if (!Object.prototype.hasOwnProperty.call(variables, name)) throw new Error(`Missing required variable: ${name}`);
    safeValues[name] = escapeTemplateValue(variables[name]);
  }
  const replace = (text: string) => text.replace(PLACEHOLDER, (_match, name: string) => safeValues[name] ?? `{{${name}}}`);
  return Object.freeze({ locale: template.locale, subject: replace(template.subject), body: replace(template.body) });
}

export function renderNotificationTemplate(
  template: Readonly<NotificationTemplate>,
  requestedLocale: LocaleCode,
  variables: Readonly<Record<string, string>>,
): RenderedTemplate {
  return renderTemplate(resolveLocale(template, requestedLocale), variables);
}

export function assertTemplateTenant(template: Readonly<NotificationTemplate>, tenantId: TenantId): void {
  if (template.tenantId !== tenantId) throw new Error('Cross-tenant template access denied');
}

export function filterTemplatesByTenant(
  templates: readonly Readonly<NotificationTemplate>[],
  tenantId: TenantId,
): readonly Readonly<NotificationTemplate>[] {
  return templates.filter((template) => template.tenantId === tenantId);
}

export function findTemplateByKey(
  templates: readonly Readonly<NotificationTemplate>[],
  tenantId: TenantId,
  key: TemplateKey,
): Readonly<NotificationTemplate> | undefined {
  return templates.find((template) => template.tenantId === tenantId && template.key === key);
}

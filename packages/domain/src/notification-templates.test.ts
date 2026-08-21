import { describe, expect, it } from 'vitest';
import {
  createNotificationTemplate,
  normalizeNotificationTemplate,
  renderNotificationTemplate,
  renderTemplate,
  resolveLocale,
  validateLocalizedTemplate,
} from './notification-templates';

const NOW = '2026-08-21T12:00:00.000Z';
const en = {
  locale: 'en',
  subject: 'Assignment: {{name}}',
  body: 'Hello {{name}} on {{date}}',
  allowedVariables: ['date', 'name'],
} as const;
const pt = {
  locale: 'pt-PT',
  subject: 'Designação: {{name}}',
  body: 'Olá {{name}} em {{date}}',
  allowedVariables: ['date', 'name'],
} as const;

function make() {
  return createNotificationTemplate({
    id: 't1', tenantId: 'tenant-a', key: 'assignment.reminder',
    locales: [en, pt], fallbackLocale: 'en', now: NOW,
  });
}

describe('notification templates', () => {
  it('creates immutable localized templates and resolves locale deterministically', () => {
    const template = make();
    expect(Object.isFrozen(template)).toBe(true);
    expect(resolveLocale(template, 'pt-PT').locale).toBe('pt-PT');
    expect(resolveLocale(template, 'pt-BR').locale).toBe('pt-PT');
    expect(resolveLocale(template, 'es').locale).toBe('en');
  });

  it('requires allowlists to exactly match placeholders', () => {
    expect(() => validateLocalizedTemplate({ ...en, allowedVariables: ['name'] })).toThrow('not in the allowlist');
    expect(() => validateLocalizedTemplate({ ...en, allowedVariables: ['date', 'name', 'unused'] })).toThrow('not used');
  });

  it('does not let inherited properties satisfy required variables', () => {
    const variables = Object.create({ name: 'inherited' }) as Record<string, string>;
    variables.date = '2026-08-25';
    expect(() => renderTemplate(en, variables)).toThrow('Missing required variable: name');
  });

  it('strips control and bidi characters from rendered values without reparsing placeholders', () => {
    const rendered = renderNotificationTemplate(make(), 'en', {
      name: 'Jo\u202E{{date}}', date: '2026-08-25\u0000',
    });
    expect(rendered.subject).toContain('Jo{{date}}');
    expect(rendered.body).toContain('2026-08-25');
    expect(rendered.body).not.toContain('\u0000');
  });

  it('rejects invalid persisted timestamps and reversed update chronology', () => {
    const template = make();
    expect(() => normalizeNotificationTemplate({ ...template, updatedAt: '2026-08-20T00:00:00Z' })).toThrow('updatedAt');
  });
});

import { describe, it, expect } from 'vitest';
import {
  createNotificationTemplate,
  normalizeNotificationTemplate,
  validateLocalizedTemplate,
  resolveLocale,
  renderTemplate,
  renderNotificationTemplate,
  escapeTemplateValue,
  assertTemplateTenant,
  filterTemplatesByTenant,
  findTemplateByKey,
} from './notification-templates';
import type { NotificationTemplate, LocalizedTemplate } from './notification-templates';

const NOW = '2026-08-21T12:00:00.000Z';
const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';

const EN_TEMPLATE: LocalizedTemplate = {
  locale: 'en',
  subject: 'Assignment Reminder: {{meetingName}}',
  body: 'Hello, {{name}}. You have an assignment for {{meetingName}} on {{date}}.',
  allowedVariables: ['date', 'meetingName', 'name'],
};

const PT_TEMPLATE: LocalizedTemplate = {
  locale: 'pt-BR',
  subject: 'Lembrete: {{meetingName}}',
  body: 'Olá, {{name}}. Você tem uma designação para {{meetingName}} em {{date}}.',
  allowedVariables: ['date', 'meetingName', 'name'],
};

const ES_TEMPLATE: LocalizedTemplate = {
  locale: 'es',
  subject: 'Recordatorio: {{meetingName}}',
  body: 'Hola, {{name}}. Tienes una asignación para {{meetingName}} el {{date}}.',
  allowedVariables: ['date', 'meetingName', 'name'],
};

function makeTemplate(overrides?: Partial<Parameters<typeof createNotificationTemplate>[0]>): NotificationTemplate {
  return createNotificationTemplate({
    id: 'tmpl-1',
    tenantId: TENANT_A,
    key: 'assignment.reminder',
    locales: [EN_TEMPLATE, PT_TEMPLATE],
    fallbackLocale: 'en',
    now: NOW,
    ...overrides,
  });
}

// ── createNotificationTemplate ───────────────────────────────────────

describe('createNotificationTemplate', () => {
  it('creates a valid template', () => {
    const tmpl = makeTemplate();
    expect(tmpl.id).toBe('tmpl-1');
    expect(tmpl.tenantId).toBe(TENANT_A);
    expect(tmpl.key).toBe('assignment.reminder');
    expect(tmpl.fallbackLocale).toBe('en');
    expect(tmpl.locales).toHaveLength(2);
    expect(tmpl.createdAt).toBe(NOW);
    expect(tmpl.updatedAt).toBe(NOW);
    expect(Object.isFrozen(tmpl)).toBe(true);
  });

  it('freezes locales array and each locale', () => {
    const tmpl = makeTemplate();
    expect(Object.isFrozen(tmpl.locales)).toBe(true);
    for (const loc of tmpl.locales) {
      expect(Object.isFrozen(loc)).toBe(true);
      expect(Object.isFrozen(loc.allowedVariables)).toBe(true);
    }
  });

  it('throws on empty id', () => {
    expect(() => makeTemplate({ id: '  ' })).toThrow('notificationTemplateId is required');
  });

  it('throws on empty tenantId', () => {
    expect(() => makeTemplate({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws on empty key', () => {
    expect(() => makeTemplate({ key: '  ' })).toThrow('templateKey is required');
  });

  it('throws on invalid template key format', () => {
    expect(() => makeTemplate({ key: 'INVALID' })).toThrow('Invalid template key format');
    expect(() => makeTemplate({ key: '123.abc' })).toThrow('Invalid template key format');
    expect(() => makeTemplate({ key: 'single' })).toThrow('Invalid template key format');
    expect(() => makeTemplate({ key: '.starts-with-dot' })).toThrow('Invalid template key format');
  });

  it('throws on invalid date', () => {
    expect(() => makeTemplate({ now: 'not-a-date' })).toThrow('Invalid ISO date');
  });

  it('throws on empty locales', () => {
    expect(() => makeTemplate({ locales: [] })).toThrow('At least one locale is required');
  });

  it('throws on duplicate locales', () => {
    expect(() => makeTemplate({ locales: [EN_TEMPLATE, EN_TEMPLATE] })).toThrow('Duplicate locale');
  });

  it('throws if fallback locale not in locales', () => {
    expect(() => makeTemplate({ fallbackLocale: 'fr', locales: [EN_TEMPLATE] })).toThrow(
      "Fallback locale 'fr' is not present",
    );
  });

  it('throws on invalid locale code', () => {
    const badLocale = { ...EN_TEMPLATE, locale: '123' };
    expect(() => makeTemplate({ locales: [badLocale] })).toThrow('Invalid locale code');
  });
});

// ── validateLocalizedTemplate ────────────────────────────────────────

describe('validateLocalizedTemplate', () => {
  it('validates a correct template', () => {
    const result = validateLocalizedTemplate(EN_TEMPLATE);
    expect(result.locale).toBe('en');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('throws if body is empty', () => {
    expect(() => validateLocalizedTemplate({ ...EN_TEMPLATE, body: '   ' })).toThrow(
      'body is required',
    );
  });

  it('throws if body is too long', () => {
    expect(() => validateLocalizedTemplate({ ...EN_TEMPLATE, body: 'x'.repeat(5001) })).toThrow(
      'body is too long',
    );
  });

  it('throws if subject is too long', () => {
    expect(() => validateLocalizedTemplate({ ...EN_TEMPLATE, subject: 'x'.repeat(501) })).toThrow(
      'subject is too long',
    );
  });

  it('allows empty subject', () => {
    const result = validateLocalizedTemplate({ ...EN_TEMPLATE, subject: '' });
    expect(result.subject).toBe('');
  });

  it('throws on variable not in allowlist', () => {
    const bad = {
      locale: 'en' as const,
      subject: 'Hello {{name}}',
      body: 'Hello {{name}}, your {{secret}} is ready.',
      allowedVariables: ['name'],
    };
    expect(() => validateLocalizedTemplate(bad)).toThrow(
      "Template variable '{{secret}}' is not in the allowlist",
    );
  });

  it('throws on allowlist variable not in template', () => {
    const bad = {
      locale: 'en' as const,
      subject: 'Hello {{name}}',
      body: 'Hello {{name}}, welcome.',
      allowedVariables: ['name', 'unusedVar'],
    };
    expect(() => validateLocalizedTemplate(bad)).toThrow(
      "Allowed variable 'unusedVar' is not used in the template",
    );
  });

  it('sorts allowedVariables deterministically', () => {
    const result = validateLocalizedTemplate({
      ...EN_TEMPLATE,
      allowedVariables: ['name', 'date', 'meetingName'],
    });
    expect(result.allowedVariables).toEqual(['date', 'meetingName', 'name']);
  });

  it('deduplicates allowedVariables', () => {
    const result = validateLocalizedTemplate({
      ...EN_TEMPLATE,
      allowedVariables: ['name', 'name', 'date', 'meetingName'],
    });
    expect(result.allowedVariables).toEqual(['date', 'meetingName', 'name']);
    expect(result.allowedVariables).toHaveLength(3);
  });

  it('throws on invalid variable name with special chars', () => {
    const bad = {
      ...EN_TEMPLATE,
      allowedVariables: ['name', 'bad-var'],
    };
    expect(() => validateLocalizedTemplate(bad)).toThrow('Invalid variable name');
  });

  it('throws on variable name starting with number', () => {
    const bad = {
      ...EN_TEMPLATE,
      allowedVariables: ['name', '2bad'],
    };
    expect(() => validateLocalizedTemplate(bad)).toThrow('Invalid variable name');
  });

  it('detects variables in subject', () => {
    const tmpl = {
      locale: 'en' as const,
      subject: 'Hi {{name}}',
      body: 'Welcome.',
      allowedVariables: ['name'],
    };
    const result = validateLocalizedTemplate(tmpl);
    expect(result.allowedVariables).toEqual(['name']);
  });
});

// ── resolveLocale ────────────────────────────────────────────────────

describe('resolveLocale', () => {
  const tmpl = makeTemplate({
    locales: [EN_TEMPLATE, PT_TEMPLATE, ES_TEMPLATE],
    fallbackLocale: 'en',
  });

  it('exact match', () => {
    const resolved = resolveLocale(tmpl, 'pt-BR');
    expect(resolved.locale).toBe('pt-BR');
  });

  it('language-only prefix match (pt → pt-BR)', () => {
    const resolved = resolveLocale(tmpl, 'pt');
    expect(resolved.locale).toBe('pt-BR');
  });

  it('falls back to fallback locale', () => {
    const resolved = resolveLocale(tmpl, 'fr');
    expect(resolved.locale).toBe('en');
  });

  it('language prefix match prefers first match in list order', () => {
    const tmpl2 = makeTemplate({
      locales: [ES_TEMPLATE, PT_TEMPLATE],
      fallbackLocale: 'es',
    });
    // 'es' matches 'es' (exact) not 'pt-BR'
    const resolved = resolveLocale(tmpl2, 'es');
    expect(resolved.locale).toBe('es');
  });
});

// ── renderTemplate ───────────────────────────────────────────────────

describe('renderTemplate', () => {
  it('replaces all placeholders', () => {
    const result = renderTemplate(EN_TEMPLATE, {
      name: 'Alice',
      meetingName: 'Midweek Meeting',
      date: '2026-08-25',
    });
    expect(result.subject).toBe('Assignment Reminder: Midweek Meeting');
    expect(result.body).toBe(
      'Hello, Alice. You have an assignment for Midweek Meeting on 2026-08-25.',
    );
    expect(result.locale).toBe('en');
  });

  it('throws on missing required variable', () => {
    expect(() => renderTemplate(EN_TEMPLATE, { name: 'Alice' })).toThrow(
      'Missing required variable',
    );
  });

  it('ignores unexpected variables in the map', () => {
    const result = renderTemplate(EN_TEMPLATE, {
      name: 'Alice',
      meetingName: 'Meeting',
      date: '2026-08-25',
      attackerPayload: '<script>alert(1)</script>',
    });
    expect(result.body).not.toContain('attackerPayload');
    expect(result.body).not.toContain('script');
  });

  it('is deterministic: same inputs → same output', () => {
    const vars = { name: 'Bob', meetingName: 'Weekend', date: '2026-09-01' };
    const r1 = renderTemplate(EN_TEMPLATE, vars);
    const r2 = renderTemplate(EN_TEMPLATE, vars);
    expect(r1.subject).toBe(r2.subject);
    expect(r1.body).toBe(r2.body);
  });

  it('freezes the result', () => {
    const result = renderTemplate(EN_TEMPLATE, {
      name: 'A', meetingName: 'M', date: 'D',
    });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ── renderNotificationTemplate ───────────────────────────────────────

describe('renderNotificationTemplate', () => {
  const tmpl = makeTemplate({
    locales: [EN_TEMPLATE, PT_TEMPLATE],
    fallbackLocale: 'en',
  });

  it('resolves locale and renders', () => {
    const result = renderNotificationTemplate(tmpl, 'pt-BR', {
      name: 'João',
      meetingName: 'Reunião de Meio de Semana',
      date: '2026-08-25',
    });
    expect(result.locale).toBe('pt-BR');
    expect(result.subject).toBe('Lembrete: Reunião de Meio de Semana');
    expect(result.body).toContain('João');
  });

  it('falls back to en locale', () => {
    const result = renderNotificationTemplate(tmpl, 'de', {
      name: 'Hans',
      meetingName: 'Zwischenwoche',
      date: '2026-08-25',
    });
    expect(result.locale).toBe('en');
    expect(result.subject).toContain('Assignment Reminder');
  });
});

// ── escapeTemplateValue ──────────────────────────────────────────────

describe('escapeTemplateValue', () => {
  it('strips null bytes', () => {
    expect(escapeTemplateValue('hello\x00world')).toBe('helloworld');
  });

  it('strips C0 control characters except tab/newline/CR', () => {
    const input = 'hello\x01\x02\x03world\t\n\r';
    expect(escapeTemplateValue(input)).toBe('helloworld\t\n\r');
  });

  it('strips Unicode bidi control characters', () => {
    const input = 'start\u200E\u200F\u202A\u202E\u2066\u2069end';
    expect(escapeTemplateValue(input)).toBe('startend');
  });

  it('preserves normal text', () => {
    const input = 'Hello, World! 123 @#$%';
    expect(escapeTemplateValue(input)).toBe(input);
  });

  it('preserves Unicode letters', () => {
    const input = 'Olá João Ñoño 日本語';
    expect(escapeTemplateValue(input)).toBe(input);
  });

  it('handles empty string', () => {
    expect(escapeTemplateValue('')).toBe('');
  });
});

// ── Injection prevention ─────────────────────────────────────────────

describe('injection prevention', () => {
  it('template injection via variable value is neutralized by escaping', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'en',
      subject: 'Message for {{name}}',
      body: 'Dear {{name}}, your meeting is {{meetingName}}.',
      allowedVariables: ['meetingName', 'name'],
    });

    const result = renderTemplate(tmpl, {
      name: 'Alice{{otherVar}}extra',
      meetingName: 'Meeting',
    });

    // The value is escaped, but since we don't double-parse, the literal
    // {{}} in the value stays as-is (plain text). The important thing is
    // that otherVar from the template is NOT substituted.
    expect(result.body).toContain('Alice{{otherVar}}extra');
    expect(result.body).not.toContain('Aliceextra'); // not re-interpreted
  });

  it('unexpected keys in variables map are silently dropped', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'en',
      subject: 'Hi {{name}}',
      body: 'Your code: {{code}}',
      allowedVariables: ['code', 'name'],
    });

    const result = renderTemplate(tmpl, {
      name: 'Eve',
      code: '123',
      __proto__: 'polluted',
      constructor: 'polluted',
      toString: 'polluted',
    });
    expect(result.body).toContain('Your code: 123');
    expect(result.body).not.toContain('polluted');
  });

  it('bidi characters in variable values are stripped', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'en',
      subject: 'Notice',
      body: 'From: {{sender}}',
      allowedVariables: ['sender'],
    });

    const result = renderTemplate(tmpl, {
      sender: 'Admin\u202EReal sender: Attacker',
    });
    expect(result.body).not.toContain('\u202E');
    expect(result.body).toBe('From: AdminReal sender: Attacker');
  });

  it('null bytes in values are stripped', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'en',
      subject: 'Test',
      body: 'Data: {{data}}',
      allowedVariables: ['data'],
    });

    const result = renderTemplate(tmpl, { data: 'hello\x00world' });
    expect(result.body).toBe('Data: helloworld');
  });

  it('cannot inject new template variables via value', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'en',
      subject: 'Hello {{name}}',
      body: 'Your role: {{role}}',
      allowedVariables: ['name', 'role'],
    });

    const result = renderTemplate(tmpl, {
      name: '{{role}}',
      role: 'admin',
    });
    // The value '{{role}}' is inserted literally, not re-interpreted
    expect(result.subject).toBe('Hello {{role}}');
  });
});

// ── normalizeNotificationTemplate ────────────────────────────────────

describe('normalizeNotificationTemplate', () => {
  it('normalizes a valid template', () => {
    const tmpl = makeTemplate();
    const normalized = normalizeNotificationTemplate(tmpl);
    expect(normalized.id).toBe(tmpl.id);
    expect(normalized.key).toBe(tmpl.key);
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it('throws on invalid data', () => {
    const bad = {
      id: '  ',
      tenantId: TENANT_A,
      key: 'x',
      locales: [EN_TEMPLATE],
      fallbackLocale: 'en',
      createdAt: NOW,
      updatedAt: NOW,
    } as NotificationTemplate;
    expect(() => normalizeNotificationTemplate(bad)).toThrow('notificationTemplateId is required');
  });

  it('trims id/tenantId/key', () => {
    const tmpl = makeTemplate();
    const raw = {
      ...tmpl,
      id: '  tmpl-trim  ',
      tenantId: '  t-1  ',
      key: '  assignment.reminder  ',
    } as unknown as NotificationTemplate;
    const result = normalizeNotificationTemplate(raw);
    expect(result.id).toBe('tmpl-trim');
    expect(result.tenantId).toBe('t-1');
    expect(result.key).toBe('assignment.reminder');
  });
});

// ── Tenant isolation ─────────────────────────────────────────────────

describe('tenant isolation', () => {
  const tmplA = makeTemplate({ id: 'ta-1', tenantId: TENANT_A });
  const tmplB = makeTemplate({ id: 'tb-1', tenantId: TENANT_B });

  it('assertTemplateTenant passes for matching tenant', () => {
    expect(() => assertTemplateTenant(tmplA, TENANT_A)).not.toThrow();
  });

  it('assertTemplateTenant throws for different tenant', () => {
    expect(() => assertTemplateTenant(tmplA, TENANT_B)).toThrow(
      'Cross-tenant template access denied',
    );
  });

  it('filterTemplatesByTenant returns only matching', () => {
    const filtered = filterTemplatesByTenant([tmplA, tmplB], TENANT_A);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tenantId).toBe(TENANT_A);
  });

  it('findTemplateByKey finds within tenant', () => {
    const found = findTemplateByKey([tmplA, tmplB], TENANT_A, 'assignment.reminder');
    expect(found?.id).toBe('ta-1');
  });

  it('findTemplateByKey does not find in another tenant', () => {
    const found = findTemplateByKey([tmplA, tmplB], TENANT_B, 'assignment.reminder');
    expect(found?.id).toBe('tb-1');
  });

  it('findTemplateByKey returns undefined when not found', () => {
    const found = findTemplateByKey([tmplA], TENANT_A, 'nonexistent.key');
    expect(found).toBeUndefined();
  });
});

// ── Edge cases ───────────────────────────────────────────────────────

describe('edge cases', () => {
  it('template with no variables', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'en',
      subject: 'System Notice',
      body: 'The system will undergo maintenance.',
      allowedVariables: [],
    });
    expect(tmpl.allowedVariables).toEqual([]);
    const result = renderTemplate(tmpl, {});
    expect(result.body).toBe('The system will undergo maintenance.');
  });

  it('template with many variables', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'en',
      subject: 'Notification',
      body: 'A={{a}} B={{b}} C={{c}} D={{d}} E={{e}}',
      allowedVariables: ['a', 'b', 'c', 'd', 'e'],
    });
    const result = renderTemplate(tmpl, {
      a: '1', b: '2', c: '3', d: '4', e: '5',
    });
    expect(result.body).toBe('A=1 B=2 C=3 D=4 E=5');
  });

  it('variable appears multiple times', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'en',
      subject: '{{name}} {{name}}',
      body: 'Hi {{name}}, your name is {{name}}.',
      allowedVariables: ['name'],
    });
    const result = renderTemplate(tmpl, { name: 'Alice' });
    expect(result.subject).toBe('Alice Alice');
    expect(result.body).toBe('Hi Alice, your name is Alice.');
  });

  it('placeholder with underscore in name', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'en',
      subject: 'Test',
      body: 'Meeting: {{meeting_name}}',
      allowedVariables: ['meeting_name'],
    });
    const result = renderTemplate(tmpl, { meeting_name: 'Midweek' });
    expect(result.body).toBe('Meeting: Midweek');
  });

  it('locale with script subtag', () => {
    const tmpl = validateLocalizedTemplate({
      locale: 'zh-Hant',
      subject: '測試',
      body: '你好 {{name}}',
      allowedVariables: ['name'],
    });
    expect(tmpl.locale).toBe('zh-Hant');
  });
});

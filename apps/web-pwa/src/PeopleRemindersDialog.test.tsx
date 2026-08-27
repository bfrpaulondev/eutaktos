import { describe, expect, it } from 'vitest';
import { formatReminderInstant, peopleRemindersCopy } from './PeopleRemindersDialog';

describe('PeopleRemindersDialog product contract', () => {
  it('keeps reminder evidence server-owned and review-only in every locale', () => {
    const pt = peopleRemindersCopy('pt-PT');
    const en = peopleRemindersCopy('en');
    const es = peopleRemindersCopy('es');

    expect(pt.explanation).toContain('Nenhuma regra de frequência é calculada no navegador');
    expect(pt.reviewOnly).toContain('O envio de lembretes ainda não está disponível nesta vista');
    expect(en.explanation).toContain('No reminder-frequency rule is calculated in the browser');
    expect(en.reviewOnly).toContain('Sending reminders is not yet available in this view');
    expect(es.explanation).toContain('El navegador no calcula ninguna regla de frecuencia');
    expect(es.reviewOnly).toContain('El envío de recordatorios todavía no está disponible en esta vista');

    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      const serialized = JSON.stringify(peopleRemindersCopy(locale));
      expect(serialized).not.toMatch(/tenantId|actorId|capabilities|assignmentId|recipientId|responseId/);
      expect(peopleRemindersCopy(locale).loading).not.toBe(peopleRemindersCopy(locale).empty);
    }
  });

  it('fails safely when an invalid instant somehow reaches the formatter', () => {
    expect(formatReminderInstant('not-an-instant', 'en')).toBe('not-an-instant');
  });
});

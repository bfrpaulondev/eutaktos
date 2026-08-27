import { describe, expect, it } from 'vitest';
import { formatReminderInstant, peopleRemindersCopy } from './PeopleRemindersDialog';

describe('PeopleRemindersDialog product contract', () => {
  it('keeps reminder evidence server-owned and queued-state semantics explicit in every locale', () => {
    const pt = peopleRemindersCopy('pt-PT');
    const en = peopleRemindersCopy('en');
    const es = peopleRemindersCopy('es');

    expect(pt.explanation).toContain('Nenhuma regra de frequência é calculada no navegador');
    expect(pt.sendExplanation).toContain('“Em fila” não significa que um canal externo foi entregue');
    expect(en.explanation).toContain('No reminder-frequency rule is calculated in the browser');
    expect(en.sendExplanation).toContain('“Queued” does not mean an external channel was delivered');
    expect(es.explanation).toContain('El navegador no calcula ninguna regla de frecuencia');
    expect(es.sendExplanation).toContain('“En cola” no significa que un canal externo se haya entregado');

    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      const serialized = JSON.stringify(peopleRemindersCopy(locale));
      expect(serialized).not.toMatch(/tenantId|actorId|capabilities|assignmentId|recipientId|responseId/);
      expect(peopleRemindersCopy(locale).loading).not.toBe(peopleRemindersCopy(locale).empty);
      expect(peopleRemindersCopy(locale).queued.toLowerCase()).toMatch(/fila|queue|cola/);
    }
  });

  it('fails safely when an invalid instant somehow reaches the formatter', () => {
    expect(formatReminderInstant('not-an-instant', 'en')).toBe('not-an-instant');
  });
});

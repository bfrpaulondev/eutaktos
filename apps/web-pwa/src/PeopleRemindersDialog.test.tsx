import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PeopleRemindersDialog } from './PeopleRemindersDialog';

describe('PeopleRemindersDialog product contract', () => {
  it('keeps reminder evidence server-owned and review-only in every locale', () => {
    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      const markup = renderToStaticMarkup(<PeopleRemindersDialog open locale={locale} onClose={() => undefined} />);
      expect(markup).not.toMatch(/tenantId|actorId|capabilities|assignmentId|recipientId|responseId/);
      if (locale === 'pt-PT') {
        expect(markup).toContain('Nenhuma regra de frequência é calculada no navegador');
        expect(markup).toContain('O envio de lembretes ainda não está disponível nesta vista');
      }
      if (locale === 'en') {
        expect(markup).toContain('No reminder-frequency rule is calculated in the browser');
        expect(markup).toContain('Sending reminders is not yet available in this view');
      }
      if (locale === 'es') {
        expect(markup).toContain('El navegador no calcula ninguna regla de frecuencia');
        expect(markup).toContain('El envío de recordatorios todavía no está disponible en esta vista');
      }
    }
  });

  it('starts in an explicit loading state instead of inventing an empty reminder list', () => {
    const markup = renderToStaticMarkup(<PeopleRemindersDialog open locale="en" onClose={() => undefined} />);
    expect(markup).toContain('Checking pending responses');
    expect(markup).not.toContain('There are no pending responses that need review');
  });
});

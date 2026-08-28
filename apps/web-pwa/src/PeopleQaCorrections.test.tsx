import Form from 'antd/es/form';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { canMutateArchiveTarget, chooseArchivePersonId } from './PeopleArchiveDialog';
import { sanitizeHourglassFilename } from './HourglassImportInspector';
import { transferErrorMessage, transferRecoveryLabel } from './PeopleTransfersDialog';
import { PersonWizardIdentityStep } from './PersonWizardIdentityStep';
import { createPersonWizardDraft } from './PersonWizardModel';

const people = [{ id: 'person-a' }, { id: 'person-b' }] as const;

describe('real-user People QA corrections', () => {
  it('uses profile context as the archive target and never silently falls back to the first person', () => {
    expect(chooseArchivePersonId(people, undefined, 'person-b')).toBe('person-b');
    expect(chooseArchivePersonId(people, undefined, 'missing-person')).toBeUndefined();
    expect(chooseArchivePersonId(people, undefined, undefined)).toBeUndefined();
    expect(chooseArchivePersonId(people, 'person-a', 'person-b')).toBe('person-a');
  });

  it('blocks archive mutation when a confirmed target no longer matches the selected authoritative state', () => {
    expect(canMutateArchiveTarget(people, 'person-a', 'person-a', 'person-a')).toBe(true);
    expect(canMutateArchiveTarget(people, 'person-a', 'person-a', 'person-b')).toBe(false);
    expect(canMutateArchiveTarget(people, 'person-a', 'person-b', 'person-a')).toBe(false);
    expect(canMutateArchiveTarget(people, 'missing-person', 'missing-person', 'missing-person')).toBe(false);
  });

  it('keeps a selected Hourglass filename safe for live feedback without retaining control characters', () => {
    expect(sanitizeHourglassFilename('  qa\u0000 export\n.json  ')).toBe('qa export .json');
    expect(sanitizeHourglassFilename('x'.repeat(200))).toHaveLength(120);
  });

  it('uses a distinct localized error for each transfer operation', () => {
    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      const messages = ['load', 'send', 'cancel', 'preview', 'claim'].map(context => transferErrorMessage(locale, context as 'load' | 'send' | 'cancel' | 'preview' | 'claim'));
      expect(new Set(messages).size).toBe(messages.length);
    }
    expect(transferErrorMessage('pt-PT', 'load')).toBe('Não foi possível carregar as transferências.');
    expect(transferErrorMessage('pt-PT', 'preview')).toBe('Não foi possível pré-visualizar este código.');
  });

  it('uses retry for transfer load and preview recovery while ambiguous mutations require authoritative refresh', () => {
    const expected = {
      'pt-PT': { retry: 'Tentar novamente', refresh: 'Atualizar estado' },
      en: { retry: 'Try again', refresh: 'Refresh status' },
      es: { retry: 'Intentar de nuevo', refresh: 'Actualizar estado' },
    } as const;

    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      expect(transferRecoveryLabel(locale, 'load')).toBe(expected[locale].retry);
      expect(transferRecoveryLabel(locale, 'preview')).toBe(expected[locale].retry);
      expect(transferRecoveryLabel(locale, 'send')).toBe(expected[locale].refresh);
      expect(transferRecoveryLabel(locale, 'cancel')).toBe(expected[locale].refresh);
      expect(transferRecoveryLabel(locale, 'claim')).toBe(expected[locale].refresh);
    }
  });

  it('marks the wizard display name as required for browser and assistive technology semantics', () => {
    const draft = createPersonWizardDraft('pt-PT');
    const markup = renderToStaticMarkup(<Form layout="vertical" requiredMark="optional">
      <PersonWizardIdentityStep
        draft={draft}
        labels={{ name: 'Nome', nameRequired: 'Nome obrigatório', locale: 'Idioma', active: 'Perfil ativo', required: 'Nome obrigatório', optional: 'Opcional' }}
        onChange={() => undefined}
      />
    </Form>);
    expect(markup).toContain('aria-required="true"');
    expect(markup).toContain('required=""');
    expect(markup).toContain('ant-form-item-required');
  });
});

import Form from 'antd/es/form';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { chooseArchivePersonId } from './PeopleArchiveDialog';
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

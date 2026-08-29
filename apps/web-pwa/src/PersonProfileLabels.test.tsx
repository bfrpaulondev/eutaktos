import { describe, expect, it } from 'vitest';
import { personProfileLabelsCopy } from './PersonProfileLabels';

describe('PersonProfileLabels', () => {
  it('keeps the profile labels surface localized in every supported locale', () => {
    expect(personProfileLabelsCopy['pt-PT']).toMatchObject({ title: 'Etiquetas', edit: 'Editar etiquetas', empty: 'Sem etiquetas' });
    expect(personProfileLabelsCopy.en).toMatchObject({ title: 'Labels', edit: 'Edit labels', empty: 'No labels' });
    expect(personProfileLabelsCopy.es).toMatchObject({ title: 'Etiquetas', edit: 'Editar etiquetas', empty: 'Sin etiquetas' });
  });
});
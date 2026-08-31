import { describe, expect, it } from 'vitest';
import { isEligibilityDecisionSubmittable } from './EligibilityDialog';
import {
  assignmentTypeLabel,
  CUSTOM_ASSIGNMENT_TYPE_CHOICE,
  ELIGIBILITY_ASSIGNMENT_TYPES,
  KNOWN_ASSIGNMENT_TYPE_LABELS,
  resolveAssignmentTypeChoice,
} from './lib/assignmentTypeCatalog';

describe('EligibilityDialog decision guard', () => {
  it('requires an explicit assignment type before a decision can enter confirmation', () => {
    expect(isEligibilityDecisionSubmittable('   ', false)).toBe(false);
    expect(isEligibilityDecisionSubmittable('hourglass:initcall', false)).toBe(true);
  });
  it('blocks an additional decision while an explicit decision is being saved', () => {
    expect(isEligibilityDecisionSubmittable('hourglass:mm_chairman', true)).toBe(false);
  });
  it('uses canonical explicit privilege ids consumed by scheduling', () => {
    const ids = ELIGIBILITY_ASSIGNMENT_TYPES.map(option => option.id);
    expect(ids).toEqual(expect.arrayContaining(['hourglass:mm_chairman','hourglass:reading','hourglass:initcall','hourglass:rv','hourglass:study','hourglass:stutalk','hourglass:hh','hourglass:treasures','hourglass:dfg','hourglass:lac','hourglass:cbs','hourglass:cbs_reader','hourglass:openprayer','hourglass:closeprayer']));
    expect(ids.some(id => id.startsWith('builtin:'))).toBe(false);
    expect(ids.some(id => id.startsWith('midweek:'))).toBe(false);
  });
  it('allows an explicit custom role without changing the canonical catalog', () => {
    expect(resolveAssignmentTypeChoice(CUSTOM_ASSIGNMENT_TYPE_CHOICE, '  custom-greeter  ')).toBe('custom-greeter');
    expect(resolveAssignmentTypeChoice('hourglass:mm_chairman', 'ignored')).toBe('hourglass:mm_chairman');
  });
});

describe('assignmentTypeLabel mapping and humanization', () => {
  it('translates the imported Hourglass privileges using the export semantics', () => {
    expect(assignmentTypeLabel('hourglass:attendant', 'pt-PT')).toBe('Indicador');
    expect(assignmentTypeLabel('hourglass:cbs', 'pt-PT')).toBe('Estudo Bíblico de Congregação');
    expect(assignmentTypeLabel('hourglass:cbs_reader', 'pt-PT')).toBe('Leitor do Estudo Bíblico de Congregação');
    expect(assignmentTypeLabel('hourglass:aux_chairman', 'pt-PT')).toBe('Conselheiro da Sala Auxiliar (2ª Sala)');
    expect(assignmentTypeLabel('hourglass:dfg', 'pt-PT')).toBe('Pérolas espirituais');
    expect(assignmentTypeLabel('hourglass:hh', 'pt-PT')).toBe('Ajudante');
    expect(assignmentTypeLabel('hourglass:study', 'pt-PT')).toBe('Fazer discípulos');
    expect(assignmentTypeLabel('hourglass:lac', 'pt-PT')).toBe('Viver como Cristãos');
    expect(assignmentTypeLabel('hourglass:fm_discussion', 'pt-PT')).toBe('Contacto inicial (vídeo)');
    expect(assignmentTypeLabel('hourglass:security_attendant', 'pt-PT')).toBe('Indicador entrada');
    expect(assignmentTypeLabel('hourglass:host', 'pt-PT')).toBe('Hospitalidade');
    expect(assignmentTypeLabel('hourglass:wm_reader', 'pt-PT')).toBe('Leitor de A Sentinela');
    expect(assignmentTypeLabel('hourglass:mics', 'pt-PT')).toBe('Microfones');
    expect(assignmentTypeLabel('hourglass:conductFS', 'pt-PT')).toBe('Dirigente da Reunião de Serviço de Campo');
    expect(assignmentTypeLabel('hourglass:zoom_attendant', 'pt-PT')).toBe('Assistente Zoom');
    expect(assignmentTypeLabel('hourglass:cleaning', 'pt-PT')).toBe('Limpeza');
  });
  it('has an explicit localized entry for every Hourglass privilege key present in the export', () => {
    const importedKeys = ['attendant','aux_chairman','cbs','cbs_reader','chairman','chairman2','chairman3','cleaning','closeprayer','conductFS','console','dfg','fm_discussion','fs_assistant','hh','host','initcall','interpreter','lac','localneeds','mics','mm_chairman','none','openprayer','prayer','pt','pt_out','publicMinistry','reading','rv','security_attendant','stage','stream','study','stutalk','treasures','video','wm_chairman','wm_reader','wt_conductor','zoom_attendant'];
    for (const key of importedKeys) {
      const labels = KNOWN_ASSIGNMENT_TYPE_LABELS[`hourglass:${key}`];
      expect(labels, key).toBeDefined();
      expect(labels?.['pt-PT'].trim(), key).not.toBe('');
      expect(labels?.en.trim(), key).not.toBe('');
      expect(labels?.es.trim(), key).not.toBe('');
    }
  });
  it('translates operational, legacy and standard assignment types', () => {
    expect(assignmentTypeLabel('midweek:bible-reading', 'pt-PT')).toBe('Leitura da Bíblia');
    expect(assignmentTypeLabel('midweek:initial-call', 'pt-PT')).toBe('Iniciar conversas');
    expect(assignmentTypeLabel('builtin:apply-yourself-to-the-ministry', 'pt-PT')).toBe('Empenhe-se na leitura e no ensino');
    expect(assignmentTypeLabel('builtin:living-as-christians', 'pt-PT')).toBe('A nossa vida cristã');
    expect(assignmentTypeLabel('chairman', 'pt-PT')).toBe('Presidente');
    expect(assignmentTypeLabel('opening-prayer', 'pt-PT')).toBe('Oração inicial');
    expect(assignmentTypeLabel('closing-prayer', 'pt-PT')).toBe('Oração final');
  });
  it('humanizes unknown custom or imported identifiers by stripping technical prefixes', () => {
    expect(assignmentTypeLabel('hourglass:special_assignment', 'pt-PT')).toBe('Special Assignment');
    expect(assignmentTypeLabel('custom:sound_technician', 'en')).toBe('Sound Technician');
    expect(assignmentTypeLabel('local-usher', 'pt-PT')).toBe('Local Usher');
  });
});

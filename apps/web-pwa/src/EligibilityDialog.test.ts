import { describe, expect, it } from 'vitest';
import { isEligibilityDecisionSubmittable } from './EligibilityDialog';
import {
  assignmentTypeLabel,
  CUSTOM_ASSIGNMENT_TYPE_CHOICE,
  ELIGIBILITY_ASSIGNMENT_TYPES,
  resolveAssignmentTypeChoice,
} from './lib/assignmentTypeCatalog';

describe('EligibilityDialog decision guard', () => {
  it('requires an explicit assignment type before a decision can enter confirmation', () => {
    expect(isEligibilityDecisionSubmittable('   ', false)).toBe(false);
    expect(isEligibilityDecisionSubmittable('builtin:apply-yourself-to-the-ministry', false)).toBe(true);
  });

  it('blocks an additional decision while an explicit decision is being saved', () => {
    expect(isEligibilityDecisionSubmittable('chairman', true)).toBe(false);
  });

  it('uses the exact student part definition ids consumed by scheduling', () => {
    const ids = ELIGIBILITY_ASSIGNMENT_TYPES.map(option => option.id);
    expect(ids).toContain('builtin:apply-yourself-to-the-ministry');
    expect(ids).toContain('builtin:living-as-christians');
    expect(ids).not.toContain('builtin:opening-remarks');
    expect(ids).not.toContain('builtin:treasures-from-gods-word');
  });

  it('keeps standard non-student roles controlled while allowing an explicit custom role', () => {
    const ids = ELIGIBILITY_ASSIGNMENT_TYPES.map(option => option.id);
    expect(ids).toEqual(expect.arrayContaining(['chairman', 'opening-prayer', 'closing-prayer', 'bible-reading']));
    expect(resolveAssignmentTypeChoice(CUSTOM_ASSIGNMENT_TYPE_CHOICE, '  custom-greeter  ')).toBe('custom-greeter');
    expect(resolveAssignmentTypeChoice('chairman', 'ignored')).toBe('chairman');
  });
});

describe('assignmentTypeLabel mapping and humanization', () => {
  it('translates known Hourglass privilege identifiers into clear localized names', () => {
    expect(assignmentTypeLabel('hourglass:attendant', 'pt-PT')).toBe('Indicador');
    expect(assignmentTypeLabel('hourglass:attendant', 'en')).toBe('Attendant');
    expect(assignmentTypeLabel('hourglass:attendant', 'es')).toBe('Acomodador');

    expect(assignmentTypeLabel('hourglass:cbs_reader', 'pt-PT')).toBe('Leitor do Estudo Bíblico de Congregação');
    expect(assignmentTypeLabel('hourglass:aux_chairman', 'pt-PT')).toBe('Conselheiro da Sala Auxiliar (2ª Sala)');
    expect(assignmentTypeLabel('hourglass:wm_reader', 'pt-PT')).toBe('Leitor de A Sentinela');
    expect(assignmentTypeLabel('hourglass:mics', 'pt-PT')).toBe('Microfones');
    expect(assignmentTypeLabel('hourglass:conductFS', 'pt-PT')).toBe('Dirigente da Reunião de Serviço de Campo');
    expect(assignmentTypeLabel('hourglass:zoom_attendant', 'pt-PT')).toBe('Assistente de videoconferência (Zoom)');
    expect(assignmentTypeLabel('hourglass:cleaning', 'pt-PT')).toBe('Limpeza');
  });

  it('translates standard and builtin assignment types', () => {
    expect(assignmentTypeLabel('builtin:apply-yourself-to-the-ministry', 'pt-PT')).toBe('Empenhe-se na leitura e no ensino');
    expect(assignmentTypeLabel('builtin:living-as-christians', 'pt-PT')).toBe('A nossa vida cristã');
    expect(assignmentTypeLabel('chairman', 'pt-PT')).toBe('Presidente');
    expect(assignmentTypeLabel('opening-prayer', 'pt-PT')).toBe('Oração inicial');
    expect(assignmentTypeLabel('closing-prayer', 'pt-PT')).toBe('Oração final');
    expect(assignmentTypeLabel('bible-reading', 'pt-PT')).toBe('Leitura da Bíblia');
  });

  it('humanizes unknown custom or imported identifiers by stripping technical prefixes', () => {
    expect(assignmentTypeLabel('hourglass:special_assignment', 'pt-PT')).toBe('Special Assignment');
    expect(assignmentTypeLabel('custom:sound_technician', 'en')).toBe('Sound Technician');
    expect(assignmentTypeLabel('local-usher', 'pt-PT')).toBe('Local Usher');
  });
});

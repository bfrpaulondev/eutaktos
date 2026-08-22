import { describe, expect, it } from 'vitest';
import { getWorkspaceCopy } from './sectionData';

describe('getWorkspaceCopy', () => {
  it('keeps Agenda and Assignments localized without demonstration cards', () => {
    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      const agenda = getWorkspaceCopy(locale, 'agenda');
      const assignments = getWorkspaceCopy(locale, 'assignments');
      expect(agenda.title.length).toBeGreaterThan(0);
      expect(assignments.title.length).toBeGreaterThan(0);
      expect(agenda.subtitle.length).toBeGreaterThan(10);
      expect(assignments.subtitle.length).toBeGreaterThan(10);
      expect(agenda.cards).toEqual([]);
      expect(assignments.cards).toEqual([]);
    }
  });

  it('keeps the non-scheduling workspace copy available in every initial locale', () => {
    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      for (const section of ['people', 'preferences'] as const) {
        const content = getWorkspaceCopy(locale, section);
        expect(content.title.length).toBeGreaterThan(0);
        expect(content.subtitle.length).toBeGreaterThan(10);
      }
    }
  });
});

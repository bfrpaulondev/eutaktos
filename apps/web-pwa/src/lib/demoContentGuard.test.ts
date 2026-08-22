import { describe, expect, it } from 'vitest';
import { getWorkspaceCopy, type WorkspaceSection } from './sectionData';

const locales = ['pt-PT', 'en', 'es'] as const;
const sections: WorkspaceSection[] = ['agenda', 'assignments', 'people', 'preferences'];
const prohibitedFixtures = /Carlos Almeida|André Silva|Bruno Costa|Pérolas Espirituais|Spiritual Gems|Perlas espirituales|\b92%\b|\b75%\b/i;

describe('rendered-content guard', () => {
  it('does not expose removed demonstration people, meetings or metrics through workspace copy', () => {
    for (const locale of locales) {
      for (const section of sections) {
        const copy = getWorkspaceCopy(locale, section);
        expect(JSON.stringify(copy.cards), `${locale}/${section} must not reintroduce demonstration fixtures`).not.toMatch(prohibitedFixtures);
      }
    }
  });

  it('keeps agenda, assignments and people factual until their real data is available', () => {
    for (const locale of locales) {
      expect(getWorkspaceCopy(locale, 'agenda').cards).toEqual([]);
      expect(getWorkspaceCopy(locale, 'assignments').cards).toEqual([]);
      expect(getWorkspaceCopy(locale, 'people').cards).toEqual([]);
    }
  });
});

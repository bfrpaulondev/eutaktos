import { describe, expect, it } from 'vitest';
import { getWorkspaceCopy } from './sectionData';

describe('getWorkspaceCopy', () => {
  it('keeps Agenda localized without demonstration meetings', () => {
    expect(getWorkspaceCopy('pt-PT', 'agenda').title).toBe('Agenda');
    expect(getWorkspaceCopy('en', 'agenda').cards).toEqual([]);
    expect(getWorkspaceCopy('es', 'agenda').subtitle.length).toBeGreaterThan(10);
  });

  it('keeps the remaining preview workspaces populated in every initial locale', () => {
    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      for (const section of ['assignments', 'people', 'preferences'] as const) {
        const content = getWorkspaceCopy(locale, section);
        expect(content.title.length).toBeGreaterThan(0);
        expect(content.cards.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

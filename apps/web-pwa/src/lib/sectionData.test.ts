import { describe, expect, it } from 'vitest';
import { getWorkspaceCopy } from './sectionData';

describe('getWorkspaceCopy', () => {
  it('returns localized agenda content', () => {
    expect(getWorkspaceCopy('pt-PT', 'agenda').title).toBe('Agenda');
    expect(getWorkspaceCopy('en', 'agenda').cards).toHaveLength(3);
    expect(getWorkspaceCopy('es', 'agenda').subtitle.length).toBeGreaterThan(10);
  });

  it('keeps all primary workspaces populated in every initial locale', () => {
    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      for (const section of ['agenda', 'assignments', 'people', 'preferences'] as const) {
        const content = getWorkspaceCopy(locale, section);
        expect(content.title.length).toBeGreaterThan(0);
        expect(content.cards.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

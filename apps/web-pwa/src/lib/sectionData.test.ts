import { describe, expect, it } from 'vitest';
import { getWorkspaceCopy } from './sectionData';

describe('getWorkspaceCopy', () => {
  it('keeps Assignments localized without demonstration data', () => {
    expect(getWorkspaceCopy('pt-PT', 'assignments').title).toBe('Designações');
    expect(getWorkspaceCopy('en', 'assignments').cards).toEqual([]);
    expect(getWorkspaceCopy('es', 'assignments').subtitle.length).toBeGreaterThan(10);
  });

  it('keeps the remaining preview workspaces populated in every initial locale', () => {
    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      for (const section of ['agenda', 'people', 'preferences'] as const) {
        const content = getWorkspaceCopy(locale, section);
        expect(content.title.length).toBeGreaterThan(0);
        expect(content.cards.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

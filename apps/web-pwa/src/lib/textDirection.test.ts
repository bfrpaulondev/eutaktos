import { describe, expect, it } from 'vitest';
import { syncDocumentDirection, textDirectionForLocale } from './textDirection';

describe('text direction', () => {
  it('maps supported and future RTL locale tags deterministically', () => {
    expect(textDirectionForLocale('pt-PT')).toBe('ltr');
    expect(textDirectionForLocale('en')).toBe('ltr');
    expect(textDirectionForLocale('es')).toBe('ltr');
    expect(textDirectionForLocale('ar')).toBe('rtl');
    expect(textDirectionForLocale('ar-EG')).toBe('rtl');
    expect(textDirectionForLocale('he-IL')).toBe('rtl');
    expect(textDirectionForLocale('fa_IR')).toBe('rtl');
  });

  it('falls back safely for empty or malformed locale tags', () => {
    expect(textDirectionForLocale('')).toBe('ltr');
    expect(textDirectionForLocale('not a locale')).toBe('ltr');
  });

  it('synchronizes document direction from the active language', () => {
    const root = { lang: 'ar-SA', dir: 'ltr' };
    expect(syncDocumentDirection(root)).toBe('rtl');
    expect(root.dir).toBe('rtl');

    root.lang = 'pt-PT';
    expect(syncDocumentDirection(root)).toBe('ltr');
    expect(root.dir).toBe('ltr');
  });
});

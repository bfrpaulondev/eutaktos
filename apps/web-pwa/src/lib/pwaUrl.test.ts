import { describe, expect, it } from 'vitest';
import { resolvePwaScriptUrl } from './pwaUrl';

describe('resolvePwaScriptUrl', () => {
  it('constrói um URL absoluto quando Vite fornece a BASE_URL relativa de produção', () => {
    expect(resolvePwaScriptUrl('/', 'https://eutakes.netlify.app')).toBe('https://eutakes.netlify.app/sw.js');
  });

  it('preserva uma aplicação publicada em subdiretório', () => {
    expect(resolvePwaScriptUrl('/eutaktos/', 'https://example.test')).toBe('https://example.test/eutaktos/sw.js');
  });

  it('normaliza uma base sem barra final', () => {
    expect(resolvePwaScriptUrl('/app', 'https://example.test')).toBe('https://example.test/app/sw.js');
  });
});

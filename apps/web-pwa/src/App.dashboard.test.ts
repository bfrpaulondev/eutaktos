import { describe, expect, it } from 'vitest';
import { getDashboardAvailability } from './App';

describe('getDashboardAvailability', () => {
  it.each([
    ['pt-PT', 'O painel aguarda dados reais'],
    ['en', 'The dashboard is waiting for real data'],
    ['es', 'El panel espera datos reales'],
  ] as const)('returns a localized factual dashboard state for %s', (locale, title) => {
    const result = getDashboardAvailability(locale);

    expect(result.title).toBe(title);
    expect(result.detail).toMatch(/consultas de produção|production queries|consultas de producción/i);
    expect(result.detail).toMatch(/demonstrativ|demonstration|demostración/i);
  });
});

import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://eutakes.netlify.app';

describe('production dashboard deploy', () => {
  it('serves the real production dashboard instead of the old unavailable placeholder', async () => {
    const htmlResponse = await fetch(`${ORIGIN}/`, { headers: { 'cache-control': 'no-cache' } });
    expect(htmlResponse.ok).toBe(true);
    const html = await htmlResponse.text();
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]).filter((value): value is string => Boolean(value));
    expect(scripts.length).toBeGreaterThan(0);
    const bodies = await Promise.all(scripts.map(async src => {
      const url = new URL(src, ORIGIN).toString();
      const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
      expect(response.ok).toBe(true);
      return response.text();
    }));
    const bundle = bodies.join('\n');
    expect(bundle).toContain('Dados de produção ligados');
    expect(bundle).not.toContain('Dados de produção indisponíveis');
  }, 20_000);
});

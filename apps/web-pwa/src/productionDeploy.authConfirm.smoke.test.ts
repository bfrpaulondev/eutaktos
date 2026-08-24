import { describe, expect, it } from 'vitest';

describe('published auth confirmation deep link', () => {
  it('serves production assets from absolute /assets paths', async () => {
    const target = new URL('https://eutakes.netlify.app/auth/confirm?token_hash=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef&type=email');
    const response = await fetch(target, { headers: { 'Cache-Control': 'no-cache' } });
    expect(response.ok).toBe(true);
    const html = await response.text();

    const references = [
      ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
      ...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g),
    ].map(match => match[1]).filter((value): value is string => Boolean(value));

    expect(references.length).toBeGreaterThan(0);

    for (const reference of references) {
      const assetUrl = new URL(reference, target);
      expect(assetUrl.pathname.startsWith('/assets/')).toBe(true);
      const assetResponse = await fetch(assetUrl, { headers: { 'Cache-Control': 'no-cache' } });
      expect(assetResponse.ok).toBe(true);
      const contentType = (assetResponse.headers.get('content-type') ?? '').toLowerCase();
      if (assetUrl.pathname.endsWith('.js')) expect(contentType).toContain('javascript');
      if (assetUrl.pathname.endsWith('.css')) expect(contentType).toContain('text/css');
    }
  }, 20_000);
});

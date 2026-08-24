import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://eutakes.netlify.app';

async function json(path: string, init?: RequestInit): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(`${ORIGIN}${path}`, init);
  const contentType = response.headers.get('content-type') ?? '';
  expect(contentType.toLowerCase()).toContain('application/json');
  return { response, body: await response.json() };
}

const trustedMutationHeaders = Object.freeze({
  'content-type': 'application/json',
  origin: ORIGIN,
  'sec-fetch-site': 'same-origin',
});

describe('canonical Eutaktos pilot production smoke', () => {
  it('serves the PWA shell and a direct protected-route deep link', async () => {
    for (const path of ['/', '/pessoas']) {
      const response = await fetch(`${ORIGIN}${path}`, { redirect: 'manual' });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')?.toLowerCase()).toContain('text/html');
      const html = await response.text();
      expect(html).toContain('Eutaktos');
      expect(html).toMatch(/(?:src|href)="\/assets\//);
      expect(html).not.toMatch(/(?:src|href)="\.\/assets\//);
    }
  });

  it('reports factual API health and database readiness', async () => {
    const health = await json('/api/health');
    expect(health.response.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok', service: 'eutaktos-api' });

    const ready = await json('/api/ready');
    expect(ready.response.status).toBe(200);
    expect(ready.body).toEqual({ status: 'ready', database: 'reachable' });
  });

  it('fails closed on unauthenticated protected production reads', async () => {
    for (const path of ['/api/session', '/api/people', '/api/midweek', '/api/audit/history', '/api/access/grants']) {
      const result = await json(path);
      expect(result.response.status, path).toBe(401);
      expect(result.body, path).toEqual({ error: 'Unauthorized' });
      expect(result.response.headers.get('cache-control')?.toLowerCase(), path).toContain('no-store');
    }
  });

  it('keeps passwordless request account enumeration resistant', async () => {
    const unknown = `pilot-smoke-${Date.now()}@example.invalid`;
    const result = await json('/api/auth/otp', {
      method: 'POST',
      headers: trustedMutationHeaders,
      body: JSON.stringify({ email: unknown }),
    });
    expect(result.response.status).toBe(202);
    expect(result.body).toEqual({ status: 'check-email' });
    expect(result.response.headers.get('cache-control')?.toLowerCase()).toContain('no-store');
  });

  it('rejects missing CSRF provenance before passwordless mutation', async () => {
    const result = await json('/api/auth/otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'pilot-smoke@example.invalid' }),
    });
    expect(result.response.status).toBe(403);
    expect(result.body).toEqual({ error: 'Forbidden' });
  });

  it('maps an expired/used-shaped scanner-safe link to a generic unauthorized response', async () => {
    const bogusTokenHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const result = await json('/api/auth/verify', {
      method: 'POST',
      headers: trustedMutationHeaders,
      body: JSON.stringify({ tokenHash: bogusTokenHash }),
    });
    expect(result.response.status).toBe(401);
    expect(result.body).toEqual({ error: 'Unauthorized' });
    expect(result.response.headers.get('cache-control')?.toLowerCase()).toContain('no-store');
  });
});

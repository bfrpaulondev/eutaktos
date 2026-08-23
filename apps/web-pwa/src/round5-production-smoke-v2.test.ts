import { describe, expect, it } from 'vitest';

const BASE = 'https://eutakes.netlify.app';
const PERSON_ID = 'person-02219f44-ae34-4c53-8fe1-6e4f18a9a1ba';
const CURRENT_DEPLOYMENT_MARKER = 'Seleciona um tipo de atribuição';

async function fetchWithRetry(path: string, init: RequestInit = {}): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await fetch(`${BASE}${path}`, {
        ...init,
        headers: { 'cache-control': 'no-cache', ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(12_000),
      });
    } catch (error) {
      last = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw last;
}

function jsRefs(source: string): string[] {
  const refs = new Set<string>();
  for (const match of source.matchAll(/["'`](\/?assets\/[^"'`]+\.js)["'`]/g)) refs.add(match[1].startsWith('/') ? match[1] : `/${match[1]}`);
  for (const match of source.matchAll(/src=["']([^"']+\.js)["']/g)) refs.add(match[1].startsWith('/') ? match[1] : `/${match[1]}`);
  return [...refs];
}

async function publishedJavascript(): Promise<string> {
  const htmlResponse = await fetchWithRetry(`/?round5Smoke=${Date.now()}`);
  if (htmlResponse.status !== 200) return '';
  const html = await htmlResponse.text();
  const queue = jsRefs(html);
  const seen = new Set<string>();
  const bodies: string[] = [];
  while (queue.length && seen.size < 40) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const response = await fetchWithRetry(path);
    if (response.status !== 200) continue;
    const body = await response.text();
    bodies.push(body);
    for (const child of jsRefs(body)) if (!seen.has(child)) queue.push(child);
  }
  return bodies.join('\n');
}

async function waitForCurrentProductionBundle(): Promise<string> {
  let lastBundle = '';
  for (let attempt = 0; attempt < 15; attempt += 1) {
    lastBundle = await publishedJavascript();
    if (lastBundle.includes(CURRENT_DEPLOYMENT_MARKER)) return lastBundle;
    if (attempt < 14) await new Promise(resolve => setTimeout(resolve, 8_000));
  }
  return lastBundle;
}

describe('round 5 final production deployment', () => {
  it('serves the merged eligibility, away and agenda fixes from canonical Eutakes', async () => {
    const health = await fetchWithRetry('/api/health');
    expect(health.status).toBe(200);

    const eligibility = await fetchWithRetry(`/api/people/${PERSON_ID}/eligibility`, { method: 'GET' });
    expect(eligibility.status).toBe(401);
    const availability = await fetchWithRetry(`/api/people/${PERSON_ID}/availability`, { method: 'GET' });
    expect(availability.status).toBe(401);

    const javascript = await waitForCurrentProductionBundle();
    expect(javascript).toContain(CURRENT_DEPLOYMENT_MARKER);
    expect(javascript).toContain('builtin:apply-yourself-to-the-ministry');
    expect(javascript).toContain('Outra função personalizada');
    expect(javascript).toContain('Períodos de ausência');
    expect(javascript).toContain('Mês');
    expect(javascript).toContain('Ano');
  }, 180_000);
});

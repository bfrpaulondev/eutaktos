import { describe, expect, it } from 'vitest';

const BASE = 'https://eutakes.netlify.app';
const PERSON_ID = 'person-02219f44-ae34-4c53-8fe1-6e4f18a9a1ba';

async function fetchWithRetry(path: string, init: RequestInit = {}): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(12_000) });
    } catch (error) {
      last = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
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
  const htmlResponse = await fetchWithRetry('/');
  expect(htmlResponse.status).toBe(200);
  const html = await htmlResponse.text();
  const queue = jsRefs(html);
  const seen = new Set<string>();
  const bodies: string[] = [];
  while (queue.length && seen.size < 30) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const response = await fetchWithRetry(path);
    expect(response.status).toBe(200);
    const body = await response.text();
    bodies.push(body);
    for (const child of jsRefs(body)) if (!seen.has(child)) queue.push(child);
  }
  return bodies.join('\n');
}

describe('round 5 production deployment', () => {
  it('serves the final availability, eligibility and agenda fixes from Eutakes', async () => {
    const health = await fetchWithRetry('/api/health');
    expect(health.status).toBe(200);

    const eligibility = await fetchWithRetry(`/api/people/${PERSON_ID}/eligibility`, { method: 'GET' });
    expect(eligibility.status).toBe(401);
    const availability = await fetchWithRetry(`/api/people/${PERSON_ID}/availability`, { method: 'GET' });
    expect(availability.status).toBe(401);

    const javascript = await publishedJavascript();
    expect(javascript).toContain('Períodos de ausência');
    expect(javascript).toContain('Mês');
    expect(javascript).toContain('Ano');
    expect(javascript).toContain('Midweek API request timed out');
  }, 45_000);
});

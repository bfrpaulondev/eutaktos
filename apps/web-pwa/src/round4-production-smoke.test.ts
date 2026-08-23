import { describe, expect, it } from 'vitest';

const origin = 'https://eutakes.netlify.app';

async function productionFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetch(`${origin}${path}`, {
        ...init,
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function publishedJavaScript(html: string): Promise<string> {
  const queue = [...new Set([...html.matchAll(/\/assets\/[A-Za-z0-9._-]+\.js/g)].map(match => match[0]))];
  const visited = new Set<string>();
  const chunks: string[] = [];
  while (queue.length) {
    const asset = queue.shift();
    if (!asset || visited.has(asset)) continue;
    visited.add(asset);
    const response = await productionFetch(asset);
    expect(response.status, `production asset ${asset}`).toBe(200);
    const text = await response.text();
    chunks.push(text);
    for (const match of text.matchAll(/(?:\/assets\/|\.\/)([A-Za-z0-9._-]+\.js)/g)) {
      const candidate = `/assets/${match[1]}`;
      if (!visited.has(candidate)) queue.push(candidate);
    }
    if (visited.size > 60) throw new Error('Unexpected production JS chunk graph');
  }
  expect(visited.size).toBeGreaterThan(0);
  return chunks.join('\n');
}

describe('Eutakes round 4 production smoke', () => {
  it('serves the round 4 fixes from production', async () => {
    const health = await productionFetch('/api/health');
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok', service: 'eutaktos-api' });

    const availability = await productionFetch('/api/people/production-smoke-person/availability');
    expect(availability.status).toBe(401);

    const index = await productionFetch(`/?round4-smoke=${Date.now()}`);
    expect(index.status).toBe(200);
    const bundleText = await publishedJavaScript(await index.text());

    expect(bundleText).toContain('builtin:apply-yourself-to-the-ministry');
    expect(bundleText).toContain('Parte personalizada / função');
    expect(bundleText).toContain('Tipo de parte');
    expect(bundleText).toContain('Adicionar ausência');
  }, 45_000);
});

import { describe, expect, it } from 'vitest';

const origin = 'https://eutakes.netlify.app';

async function productionFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${origin}${path}`, {
    ...init,
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(init.headers ?? {}),
    },
  });
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
    if (visited.size > 50) throw new Error('Unexpected production JS chunk graph');
  }
  expect(visited.size).toBeGreaterThan(0);
  return chunks.join('\n');
}

describe('Eutakes round 3 production smoke', () => {
  it('serves the final runtime and UI fixes from production', async () => {
    const health = await productionFetch('/api/health');
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok', service: 'eutaktos-api' });

    const settings = await productionFetch('/api/congregation/settings');
    expect(settings.status).toBe(401);

    const eligibility = await productionFetch('/api/people/production-smoke-person/eligibility');
    expect(eligibility.status).toBe(401);

    const index = await productionFetch(`/?round3-smoke=${Date.now()}`);
    expect(index.status).toBe(200);
    const bundleText = await publishedJavaScript(await index.text());

    expect(bundleText).toContain('Nova reunião');
    expect(bundleText).toContain('Configurações da congregação');
    expect(bundleText).toContain('O código ou link pode estar incorreto, expirado ou já ter sido utilizado.');
    expect(bundleText).toContain('Sair');
  }, 30_000);
});

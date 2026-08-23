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
    const html = await index.text();
    const assets = [...html.matchAll(/src=["'](\/assets\/[^"']+\.js)["']/g)].map(match => match[1]);
    expect(assets.length).toBeGreaterThan(0);

    const bundleText = (await Promise.all(assets.map(async asset => {
      const response = await productionFetch(asset);
      expect(response.status).toBe(200);
      return response.text();
    }))).join('\n');

    expect(bundleText).toContain('Nova reunião');
    expect(bundleText).toContain('Configurações da congregação');
    expect(bundleText).toContain('O código ou link pode estar incorreto, expirado ou já ter sido utilizado.');
    expect(bundleText).toContain('Sair');
  }, 30_000);
});

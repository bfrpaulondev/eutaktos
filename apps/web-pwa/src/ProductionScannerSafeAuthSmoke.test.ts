import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://eutakes.netlify.app';
const FAKE_TOKEN_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

async function waitFor(path: string, init?: RequestInit, accept: (response: Response) => boolean = response => response.ok): Promise<Response> {
  let last: Response | undefined;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}${path}`, { ...init, cache: 'no-store' });
      last = response;
      if (accept(response)) return response;
    } catch {
      // Netlify/DNS propagation can be transient on CI runners; retry within a bounded window.
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (last) return last;
  throw new Error(`Production request did not complete: ${path}`);
}

async function publishedJavascript(): Promise<string> {
  const root = await waitFor(`/?scanner-safe-smoke=${Date.now()}`);
  const html = await root.text();
  const initial = [...html.matchAll(/(?:src|href)=["']([^"']+\.js(?:\?[^"']*)?)["']/g)].map(match => new URL(match[1]!, ORIGIN).toString());
  expect(initial.length).toBeGreaterThan(0);

  const visited = new Set<string>();
  const queue = [...initial];
  const chunks: string[] = [];
  while (queue.length && visited.size < 100) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    let response: Response;
    try { response = await fetch(url, { cache: 'no-store' }); }
    catch { continue; }
    if (!response.ok) continue;
    const source = await response.text();
    chunks.push(source);
    for (const match of source.matchAll(/["']([^"']+\.js)["']/g)) {
      try {
        const discovered = new URL(match[1]!, url).toString();
        if (discovered.startsWith(`${ORIGIN}/`) && !visited.has(discovered)) queue.push(discovered);
      } catch {
        // Ignore non-URL literals.
      }
    }
  }
  return chunks.join('\n');
}

describe('scanner-safe Magic Link production deployment', () => {
  it('publishes the confirmation UI and token-hash client path', async () => {
    const javascript = await publishedJavascript();
    expect(javascript).toContain('Confirmar entrada');
    expect(javascript).toContain('token_hash');
    expect(javascript).toContain('/auth/confirm');
  }, 150_000);

  it('mounts the confirmation route without consuming a token on GET', async () => {
    const response = await waitFor(`/auth/confirm?token_hash=${FAKE_TOKEN_HASH}&type=email&smoke=${Date.now()}`);
    expect(response.status).toBe(200);
    expect((response.headers.get('content-type') ?? '').toLowerCase()).toContain('text/html');
  }, 120_000);

  it('recognizes token-hash verification in the deployed API', async () => {
    const response = await waitFor('/api/auth/verify', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        Referer: `${ORIGIN}/auth/confirm`,
        'Sec-Fetch-Site': 'same-origin',
      },
      body: JSON.stringify({ tokenHash: FAKE_TOKEN_HASH }),
    }, response => response.status === 401);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  }, 120_000);
});

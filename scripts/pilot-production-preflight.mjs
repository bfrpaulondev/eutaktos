const baseUrl = (process.env.EUTAKTOS_PILOT_BASE_URL ?? 'https://eutakes.netlify.app').replace(/\/$/, '');
const timeoutMs = Number(process.env.EUTAKTOS_PILOT_PREFLIGHT_TIMEOUT_MS ?? 15000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl}${path}`, {
      redirect: 'manual',
      cache: 'no-store',
      ...init,
      headers: {
        accept: '*/*',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function htmlRoute(path) {
  const response = await request(path);
  const body = await response.text();
  assert(response.status === 200, `${path}: expected 200, got ${response.status}`);
  assert((response.headers.get('content-type') ?? '').includes('text/html'), `${path}: expected text/html`);
  assert(body.includes('/assets/'), `${path}: production HTML must reference absolute /assets/ resources`);
  assert(!body.includes('/auth/assets/'), `${path}: regressed to relative /auth/assets/ resources`);
  return { path, status: response.status };
}

async function jsonRoute(path, expectedStatus, predicate) {
  const response = await request(path, { headers: { accept: 'application/json' } });
  const body = await response.text();
  assert(response.status === expectedStatus, `${path}: expected ${expectedStatus}, got ${response.status}: ${body.slice(0, 200)}`);
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    throw new Error(`${path}: expected JSON response`);
  }
  if (predicate) assert(predicate(parsed), `${path}: unexpected response ${body.slice(0, 200)}`);
  return { path, status: response.status };
}

const dummyTokenHash = 'a'.repeat(64);

const results = [];
results.push(await htmlRoute('/'));
results.push(await htmlRoute('/pessoas'));
results.push(await htmlRoute(`/auth/confirm?token_hash=${dummyTokenHash}&type=email`));
results.push(await jsonRoute('/api/health', 200, value => value?.status === 'ok' && value?.service === 'eutaktos-api'));
results.push(await jsonRoute('/api/ready', 200, value => value?.status === 'ready' && value?.database === 'reachable'));

for (const path of [
  '/api/people',
  '/api/midweek',
  '/api/audit/history',
  '/api/access/subjects/pilot-admin/grants',
]) {
  results.push(await jsonRoute(path, 401, value => value?.error === 'Unauthorized'));
}

console.log(`Eutaktos pilot production preflight PASS — ${baseUrl}`);
for (const result of results) console.log(`${result.status} ${result.path}`);

const baseUrl = (process.env.EUTAKTOS_PILOT_BASE_URL ?? 'https://eutakes.netlify.app').replace(/\/$/, '');
const timeoutMs = Number(process.env.EUTAKTOS_PILOT_PREFLIGHT_TIMEOUT_MS ?? 15000);
const networkAttempts = Math.max(1, Number(process.env.EUTAKTOS_PILOT_PREFLIGHT_NETWORK_ATTEMPTS ?? 3));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function networkErrorMessage(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
  return `${error.name}: ${error.message}${cause}`;
}

async function request(path, init = {}) {
  let lastError;

  for (let attempt = 1; attempt <= networkAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        redirect: 'manual',
        cache: 'no-store',
        ...init,
        headers: {
          accept: '*/*',
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === networkAttempts) break;
      console.warn(`NETWORK RETRY ${attempt}/${networkAttempts - 1} ${path} — ${networkErrorMessage(error)}`);
      await sleep(250 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`${path}: network request failed after ${networkAttempts} attempt(s): ${networkErrorMessage(lastError)}`);
}

function record(result) {
  console.log(`PASS ${result.status} ${result.path}`);
  return result;
}

async function htmlRoute(path) {
  const response = await request(path);
  const body = await response.text();
  assert(response.status === 200, `${path}: expected 200, got ${response.status}`);
  assert((response.headers.get('content-type') ?? '').includes('text/html'), `${path}: expected text/html`);
  assert(body.includes('/assets/'), `${path}: production HTML must reference absolute /assets/ resources`);
  assert(!body.includes('/auth/assets/'), `${path}: regressed to relative /auth/assets/ resources`);
  return record({ path, status: response.status });
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
  return record({ path, status: response.status });
}

const dummyTokenHash = 'a'.repeat(64);

await htmlRoute('/');
await htmlRoute('/pessoas');
await htmlRoute(`/auth/confirm?token_hash=${dummyTokenHash}&type=email`);
await jsonRoute('/api/health', 200, value => value?.status === 'ok' && value?.service === 'eutaktos-api');
await jsonRoute('/api/ready', 200, value => value?.status === 'ready' && value?.database === 'reachable');

for (const path of [
  '/api/people',
  '/api/midweek',
  '/api/audit/history',
  '/api/access/subjects/pilot-admin/grants',
]) {
  await jsonRoute(path, 401, value => value?.error === 'Unauthorized');
}

console.log(`Eutaktos pilot production preflight PASS — ${baseUrl}`);

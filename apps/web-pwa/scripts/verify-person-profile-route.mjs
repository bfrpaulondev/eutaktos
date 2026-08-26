import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5196';
const debugPort = '9238';
const appUrl = `http://127.0.0.1:${appPort}/`;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function poll(operation, label, attempts = 80) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await operation();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await wait(150);
  }
  throw new Error(`${label}: ${String(lastError ?? 'timed out')}`);
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    const resolver = pending.get(message.id);
    if (resolver) {
      pending.delete(message.id);
      resolver(message);
    }
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const id = nextId++;
        socket.send(JSON.stringify({ id, method, params }));
        return new Promise((done, fail) => {
          pending.set(id, response => response.error ? fail(new Error(response.error.message)) : done(response.result));
        });
      },
      close() { socket.close(); },
    }));
    socket.addEventListener('error', reject, { once: true });
  });
}

const devServer = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', appPort, '--strictPort'], { stdio: 'ignore' });
let browser;
let cdp;

async function evaluate(expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}

async function clickExactButton(label) {
  return await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)});
    button?.click();
    return Boolean(button);
  })()`);
}

async function locationState() {
  return await evaluate(`({ path: location.pathname, search: location.search, href: location.href, main: document.querySelector('#main')?.textContent ?? '' })`);
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-profile-route-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'Chromium did not open the app');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = init?.method ?? 'GET';
      if (url.pathname === '/api/people' && method === 'GET') return json([{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true }]);
      if (url.pathname === '/api/people/directory' && method === 'GET') return json({
        contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z',
        capabilities: { writePeople: true, availability: false, eligibility: false, responsibilities: false, schedule: false },
        filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [] },
        people: [{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true, groups: [], availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } }],
      });
      if (url.pathname === '/api/session' && method === 'GET') return json({ actorId: 'actor-runtime', capabilities: ['people.read'] });
      return new Response(JSON.stringify({ error: 'Not available in route harness' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    };
  })();` });

  const directoryUrl = new URL('/pessoas?view=directory&status=active', appUrl).toString();
  await cdp.send('Page.navigate', { url: directoryUrl });
  await poll(async () => {
    const state = await locationState();
    return state.path === '/pessoas' && state.search.includes('view=directory') && state.main.includes('Diretório') && state.main.includes('Runtime person') && state.main.includes('Ver perfil');
  }, 'Directory did not become ready');

  if (!await clickExactButton('Ver perfil')) throw new Error('View profile action was not found');
  await poll(async () => {
    const state = await locationState();
    return state.search.includes('view=profile') && state.search.includes('status=active') && state.search.includes('person=person-runtime') && state.main.includes('Runtime person') && state.main.includes('Resumo') && state.main.includes('Contactos');
  }, 'Profile did not open from Directory');

  let state = await locationState();
  if (state.href.includes('Runtime%20person') || state.href.includes('Runtime person') || state.href.includes('@')) throw new Error(`Human-readable PII leaked into profile URL: ${state.href}`);

  await cdp.send('Page.reload', { ignoreCache: true });
  await poll(async () => {
    const current = await locationState();
    return current.search.includes('view=profile') && current.search.includes('person=person-runtime') && current.main.includes('Runtime person') && current.main.includes('Resumo');
  }, 'Profile deep link did not survive refresh');

  await evaluate('history.back(); true');
  await poll(async () => {
    const current = await locationState();
    return current.search.includes('view=directory') && current.search.includes('status=active') && !current.search.includes('person=') && current.main.includes('Diretório');
  }, 'Back did not restore Directory with filters');

  await evaluate('history.forward(); true');
  await poll(async () => {
    const current = await locationState();
    return current.search.includes('view=profile') && current.search.includes('person=person-runtime') && current.main.includes('Runtime person');
  }, 'Forward did not restore profile');

  if (!await clickExactButton('Voltar')) throw new Error('Profile back action was not found');
  await poll(async () => {
    const current = await locationState();
    return current.search.includes('view=directory') && current.search.includes('status=active') && !current.search.includes('person=') && current.main.includes('Diretório');
  }, 'Profile back action did not return to filtered Directory');

  state = await locationState();
  if (state.href.includes('Runtime%20person') || state.href.includes('Runtime person')) throw new Error(`PII remained in URL after returning to Directory: ${state.href}`);

  process.stdout.write('Person profile route regression passed: Directory → Profile, refresh, Back/Forward and privacy-safe return.\n');
} finally {
  try { cdp?.close(); } catch {}
  browser?.kill('SIGTERM');
  devServer.kill('SIGTERM');
}

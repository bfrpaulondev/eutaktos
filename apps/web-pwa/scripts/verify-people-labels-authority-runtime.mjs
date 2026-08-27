import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5198';
const debugPort = '9241';
const appUrl = `http://127.0.0.1:${appPort}/`;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const wait = milliseconds => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds));

async function poll(operation, label, attempts = 100) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await operation();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await wait(120);
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
  return new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', () => resolvePromise({
      send(method, params = {}) {
        const id = nextId++;
        socket.send(JSON.stringify({ id, method, params }));
        return new Promise((done, fail) => pending.set(id, response => response.error ? fail(new Error(response.error.message)) : done(response.result)));
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

async function clickButton(label) {
  return await poll(async () => await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled && node.getClientRects().length > 0);
    if (!button) return false;
    button.click();
    return true;
  })()`), `Button ${label} was not available`);
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-labels-authority-${process.pid}`, 'about:blank'], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url === 'about:blank');
  }, 'Chromium did not open');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    window.__labelPatchAttempts = 0;
    const response = (status, value) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = init?.method ?? 'GET';
      if (url.pathname === '/api/session' && method === 'GET') return response(200, { actorId: 'actor-runtime', capabilities: ['people.read', 'people.write'] });
      if (url.pathname === '/api/people/directory' && method === 'GET') return response(200, {
        contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z',
        capabilities: { writePeople: true, availability: false, eligibility: false, responsibilities: false, schedule: false },
        filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [], labels: [] },
        people: [{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true, groups: [], availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } }],
      });
      if (url.pathname === '/api/people' && method === 'GET') return response(200, [{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true }]);
      if (url.pathname === '/api/people/person-runtime' && method === 'PATCH') {
        window.__labelPatchAttempts += 1;
        return response(403, { error: 'Forbidden' });
      }
      return response(503, { error: 'Not available in labels authority harness' });
    };
  })();` });

  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=directory', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Runtime person'))`), 'Directory did not load');
  await clickButton('Etiquetas');
  await clickButton('Editar etiquetas');
  await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Etiquetas — Runtime person'));
    const input = dialog?.querySelector('input[role="combobox"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'Visita');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    return true;
  })()`), 'Label draft input was unavailable');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Visita')))`), 'Label draft was not created');
  await clickButton('Guardar');
  const blocked = await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Etiquetas — Runtime person'));
    if (!dialog?.textContent?.includes('Já não tem permissão para alterar estas etiquetas.')) return null;
    return { attempts: window.__labelPatchAttempts, hasRetry: [...dialog.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Tentar novamente') };
  })()`), '403 label mutation state was not rendered');
  if (blocked.attempts !== 1) throw new Error(`403 mutation was attempted ${blocked.attempts} times`);
  if (blocked.hasRetry) throw new Error('403 mutation incorrectly exposed retry');
  process.stdout.write('PX9.3 labels authority runtime passed: write capability revocation renders distinct 403 without retry or duplicate mutation.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (!devServer.killed) devServer.kill('SIGTERM');
}

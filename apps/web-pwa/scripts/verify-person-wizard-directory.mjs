import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5197';
const debugPort = '9239';
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

async function visibleDialog(title) {
  return await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes(${JSON.stringify(title)}) && getComputedStyle(node).visibility !== 'hidden'))`);
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-person-wizard-${process.pid}`, appUrl], { stdio: 'ignore' });
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
      const readOnly = localStorage.getItem('eutaktos-test-readonly') === '1';
      if (url.pathname === '/api/session' && method === 'GET') return json({ actorId: 'actor-runtime', capabilities: readOnly ? ['people.read'] : ['people.read', 'people.write'] });
      if (url.pathname === '/api/people' && method === 'GET') return json([{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true }]);
      if (url.pathname === '/api/people/directory' && method === 'GET') return json({
        contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z',
        capabilities: { writePeople: true, availability: false, eligibility: false, responsibilities: false, schedule: false },
        filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [] },
        people: [{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true, groups: [], availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } }],
      });
      if (url.pathname === '/api/households' && method === 'GET') return json([]);
      if (url.pathname === '/api/service-groups' && method === 'GET') return json([]);
      return new Response(JSON.stringify({ error: 'Not available in wizard harness' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    };
  })();` });

  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=directory', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Runtime person')) && [...document.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Adicionar pessoa')`), 'Writable Directory did not become ready');

  if (!await clickExactButton('Adicionar pessoa')) throw new Error('Add person action was not found');
  await poll(async () => await visibleDialog('Adicionar pessoa'), 'Guided create wizard did not open');
  const createState = await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Adicionar pessoa'));
    return {
      wizardClass: Boolean(dialog?.closest('.person-wizard') || dialog?.querySelector('.person-wizard')),
      text: dialog?.textContent ?? '',
      url: location.href,
      stored: Object.entries(localStorage),
    };
  })()`);
  for (const step of ['Identidade', 'Contacto', 'Organização', 'Participação', 'Rever']) if (!createState.text.includes(step)) throw new Error(`Create wizard is missing step ${step}`);
  if (createState.text.includes('Nova pessoa')) throw new Error('Legacy basic create form is still reachable');
  if (createState.url.includes('Runtime%20person') || createState.url.includes('Runtime person')) throw new Error('Person PII leaked into URL while opening create wizard');
  if (createState.stored.some(([key, value]) => key !== 'eutaktos.preferences.v4' && (String(value).includes('Runtime person') || String(value).includes('person-runtime')))) throw new Error('Person PII leaked into localStorage');
  if (!await clickExactButton('Cancelar')) throw new Error('Create wizard cancel action was not found');
  await poll(async () => !(await visibleDialog('Adicionar pessoa')), 'Create wizard did not close');

  if (!await clickExactButton('Editar')) throw new Error('Edit action was not found');
  await poll(async () => await visibleDialog('Editar pessoa'), 'Guided edit wizard did not open');
  const editState = await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Editar pessoa'));
    const input = dialog?.querySelector('input');
    return { value: input?.value ?? '', text: dialog?.textContent ?? '', url: location.href };
  })()`);
  if (editState.value !== 'Runtime person') throw new Error(`Edit wizard did not receive the approved core person projection: ${JSON.stringify(editState)}`);
  if (!editState.text.includes('Identidade') || !editState.text.includes('Rever')) throw new Error('Edit wizard is not using the shared guided flow');
  if (editState.url.includes('Runtime%20person') || editState.url.includes('Runtime person')) throw new Error('Person PII leaked into URL while opening edit wizard');
  if (!await clickExactButton('Cancelar')) throw new Error('Edit wizard cancel action was not found');
  await poll(async () => !(await visibleDialog('Editar pessoa')), 'Edit wizard did not close');

  await evaluate(`localStorage.setItem('eutaktos-test-readonly', '1'); true`);
  await cdp.send('Page.reload', { ignoreCache: true });
  await poll(async () => await evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('#main')?.textContent?.includes('Runtime person')) && [...document.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Ver perfil')`), 'Read-only Directory actions did not become ready');
  const readOnlyState = await evaluate(`(() => {
    const labels = [...document.querySelectorAll('button')].map(node => (node.innerText || node.textContent || '').trim());
    return { hasAdd: labels.includes('Adicionar pessoa'), hasEdit: labels.includes('Editar'), hasProfile: labels.includes('Ver perfil') };
  })()`);
  if (readOnlyState.hasAdd || readOnlyState.hasEdit || !readOnlyState.hasProfile) throw new Error(`Write controls did not fail closed while read access remained usable: ${JSON.stringify(readOnlyState)}`);

  process.stdout.write('Person wizard Directory regression passed: guided Add/Edit, no legacy form, privacy-safe state and fail-closed write permissions.\n');
} finally {
  try { cdp?.close(); } catch {}
  browser?.kill('SIGTERM');
  devServer.kill('SIGTERM');
}

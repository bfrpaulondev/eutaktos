import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5197';
const debugPort = '9240';
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

async function clickExactButton(label) {
  return await poll(async () => await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => {
      const rect = node.getBoundingClientRect();
      const text = (node.innerText || node.textContent || '').trim();
      return text === ${JSON.stringify(label)} && rect.width > 0 && rect.height > 0 && !node.disabled && getComputedStyle(node).visibility !== 'hidden';
    });
    if (!button) return false;
    button.click();
    return true;
  })()`), `Button ${label} did not become available`);
}

async function setTagsInput(value) {
  return await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Etiquetas'));
    const input = dialog?.querySelector('input[role="combobox"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    return true;
  })()`), 'Labels tags input did not become available');
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-labels-${process.pid}`, 'about:blank'], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url === 'about:blank');
  }, 'Chromium did not open the harness page');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    window.__labelsHarness = { labels: [], patchCount: 0, mode: localStorage.getItem('eutaktos-labels-test-mode') ?? 'write' };
    const ok = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const failure = (status, message) => new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = init?.method ?? 'GET';
      const harness = window.__labelsHarness;
      if (url.pathname === '/api/session' && method === 'GET') {
        if (harness.mode === 'unauthorized') return failure(401, 'Unauthorized');
        return ok({ actorId: 'actor-runtime', capabilities: harness.mode === 'readonly' ? ['people.read'] : ['people.read', 'people.write'] });
      }
      if (url.pathname === '/api/people/directory' && method === 'GET') {
        if (harness.mode === 'unauthorized') return failure(401, 'Unauthorized');
        return ok({
          contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z',
          capabilities: { writePeople: harness.mode !== 'readonly', availability: false, eligibility: false, responsibilities: false, schedule: false },
          filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [], labels: [...harness.labels] },
          people: [{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true, labels: [...harness.labels], groups: [], availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } }],
        });
      }
      if (url.pathname === '/api/people' && method === 'GET') return ok([{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true, ...(harness.labels.length ? { labels: [...harness.labels] } : {}) }]);
      if (url.pathname === '/api/people/person-runtime' && method === 'PATCH') {
        harness.patchCount += 1;
        const body = JSON.parse(String(init?.body ?? '{}'));
        harness.labels = Array.isArray(body.labels) ? [...body.labels] : [];
        await new Promise(resolvePromise => setTimeout(resolvePromise, 80));
        return ok({ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true, ...(harness.labels.length ? { labels: [...harness.labels] } : {}) });
      }
      return failure(503, 'Not available in labels harness');
    };
  })();` });

  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=directory', appUrl).toString() });
  await poll(async () => await evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('#main')?.textContent?.includes('Runtime person'))`), 'Writable People Directory did not load');
  if (!await clickExactButton('Etiquetas')) throw new Error('Labels viewer did not open');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Etiquetas — Runtime person') && node.textContent?.includes('Sem etiquetas')))`), 'Labels dialog did not show the empty state');
  if (!await clickExactButton('Editar etiquetas')) throw new Error('Labels edit action is missing');
  await setTagsInput('Visita');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Visita')))`), 'Draft label was not created');

  await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('button')].filter(node => (node.innerText || node.textContent || '').trim() === 'Guardar' && !node.disabled);
    buttons[0]?.click();
    buttons[0]?.click();
    return true;
  })()`);
  await poll(async () => await evaluate(`window.__labelsHarness.patchCount === 1 && ![...document.querySelectorAll('[role="dialog"]')].some(node => node.textContent?.includes('Etiquetas — Runtime person'))`), 'Label save/refetch did not complete or duplicated PATCH');
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Visita'))`), 'Authoritative Directory refetch did not show the saved label');
  const postSave = await evaluate(`({ patchCount: window.__labelsHarness.patchCount, href: location.href, stored: Object.entries(localStorage) })`);
  if (postSave.patchCount !== 1) throw new Error(`Double-submit guard failed: PATCH count=${postSave.patchCount}`);
  if (postSave.href.includes('Visita')) throw new Error('Label value leaked into the URL after save');
  if (postSave.stored.some(([key, value]) => !['eutaktos.preferences.v4', 'eutaktos-labels-test-mode'].includes(key) && String(value).includes('Visita'))) throw new Error('Label value leaked into localStorage');

  if (!await clickExactButton('Mais filtros')) throw new Error('Advanced filters did not open');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('.ant-select')].find(node => node.textContent?.includes('Todas as etiquetas')))`), 'Label filter was not rendered');
  const selected = await evaluate(`(() => {
    const containers = [...document.querySelectorAll('.ant-select')];
    const select = containers.find(node => node.textContent?.includes('Todas as etiquetas'));
    if (!select) return false;
    select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    select.click();
    return true;
  })()`);
  if (!selected) throw new Error('Label filter select could not be opened');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="option"]')].find(node => node.textContent?.trim() === 'Visita'))`), 'Saved label was not available as a filter option');
  await evaluate(`(() => { const option = [...document.querySelectorAll('[role="option"]')].find(node => node.textContent?.trim() === 'Visita'); option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); option?.click(); return Boolean(option); })()`);
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('1 resultado'))`), 'Local label filter did not keep the matching person');
  if (await evaluate(`location.href.includes('Visita')`)) throw new Error('Local label filter serialized the label into the URL');

  await evaluate(`localStorage.setItem('eutaktos-labels-test-mode', 'readonly'); true`);
  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=directory', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Runtime person'))`), 'Read-only Directory did not load');
  if (!await clickExactButton('Etiquetas')) throw new Error('Read-only labels viewer did not open');
  const readonlyDialog = await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Etiquetas — Runtime person'));
    if (!dialog) return null;
    return { text: dialog.textContent ?? '', hasEdit: [...dialog.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Editar etiquetas') };
  })()`), 'Read-only labels dialog did not open');
  if (readonlyDialog.hasEdit || !readonlyDialog.text.includes('não tem permissão para as alterar')) throw new Error(`Read-only label authority was not enforced: ${JSON.stringify(readonlyDialog)}`);

  await evaluate(`localStorage.setItem('eutaktos-labels-test-mode', 'unauthorized'); true`);
  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=directory', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('É necessário iniciar sessão para consultar Pessoas.'))`), 'Directory 401 state was not rendered distinctly');

  process.stdout.write('PX9.3 labels runtime passed: edit/refetch/filter, URL/storage privacy, read-only authority, 401 and double-submit protection.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (!devServer.killed) devServer.kill('SIGTERM');
}

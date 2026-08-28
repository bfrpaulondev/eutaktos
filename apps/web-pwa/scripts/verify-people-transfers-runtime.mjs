import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5209';
const debugPort = '9251';
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
      return (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && rect.width > 0 && rect.height > 0 && !node.disabled && getComputedStyle(node).visibility !== 'hidden';
    });
    if (!button) return false;
    button.click();
    return true;
  })()`), `Button ${label} did not become available`);
}

async function clickExactMenuItem(label) {
  return await poll(async () => await evaluate(`(() => {
    const item = [...document.querySelectorAll('[role="menuitem"]')].find(node => {
      const rect = node.getBoundingClientRect();
      return (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden';
    });
    if (!item) return false;
    item.click();
    return true;
  })()`), `Menu item ${label} did not become available`);
}

async function clickDialogButton(label) {
  return await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Transferências') && node.getBoundingClientRect().width > 0);
    const button = dialog && [...dialog.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`), `Transfer dialog button ${label} did not become available`);
}

async function selectReceiveMode() {
  return await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Transferências') && node.getBoundingClientRect().width > 0);
    const item = dialog && [...dialog.querySelectorAll('.ant-segmented-item')].find(node => (node.innerText || node.textContent || '').trim() === 'Receber');
    if (!item) return false;
    item.click();
    return true;
  })()`), 'Receive mode did not become available');
}

async function setTransferCode(value) {
  return await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Transferências') && node.getBoundingClientRect().width > 0);
    const input = dialog?.querySelector('input[aria-label="Código"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`), 'Transfer code input did not become available');
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-transfers-${process.pid}`, 'about:blank'], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url === 'about:blank');
  }, 'Chromium did not open the harness page');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    window.__transfersHarness = { listCount: 0, previewCount: 0 };
    const ok = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const failure = (status, message) => new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = init?.method ?? 'GET';
      const harness = window.__transfersHarness;
      if (url.pathname === '/api/session' && method === 'GET') return ok({ actorId: 'actor-runtime', capabilities: ['people.read', 'people.write'] });
      if (url.pathname === '/api/people/directory' && method === 'GET') return ok({
        contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z',
        capabilities: { writePeople: true, availability: false, eligibility: false, responsibilities: false, schedule: false },
        filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [] },
        people: [{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true, groups: [], availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } }],
      });
      if (url.pathname === '/api/people/transfers' && method === 'GET') {
        harness.listCount += 1;
        if (harness.listCount === 1) return failure(503, 'Load failed');
        return ok({ contractVersion: 'people-transfers-v1', transfers: [] });
      }
      if (url.pathname === '/api/people/transfers/preview' && method === 'POST') {
        harness.previewCount += 1;
        if (harness.previewCount === 1) return failure(503, 'Preview failed');
        return ok({ contractVersion: 'people-transfer-preview-v1', transferId: 'transfer-runtime', expiresAt: '2032-06-13T12:00:00.000Z', people: [{ displayName: 'Pessoa da pré-visualização' }] });
      }
      return failure(503, 'Not available in transfers harness');
    };
  })();` });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=directory', appUrl).toString() });
  await poll(async () => await evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('#main')?.textContent?.includes('Runtime person'))`), 'People Directory did not load');

  await clickExactButton('Ferramentas');
  await clickExactMenuItem('Transferências');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Não foi possível carregar as transferências.')))`), 'Transfer load failure was not rendered');

  const loadFailure = await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Transferências') && node.getBoundingClientRect().width > 0);
    const labels = dialog ? [...dialog.querySelectorAll('button')].map(node => (node.innerText || node.textContent || '').trim()) : [];
    return { labels, listCount: window.__transfersHarness.listCount };
  })()`);
  if (!loadFailure.labels.includes('Tentar novamente') || loadFailure.labels.includes('Atualizar estado')) throw new Error(`Load recovery used the wrong CTA: ${JSON.stringify(loadFailure)}`);

  await clickDialogButton('Tentar novamente');
  await poll(async () => await evaluate(`window.__transfersHarness.listCount === 2 && Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Histórico de envios')))`), 'Transfer load retry did not restore the ready state');
  await selectReceiveMode();

  const code = 'A'.repeat(43);
  await setTransferCode(code);
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"] button')].find(node => (node.innerText || node.textContent || '').trim() === 'Pré-visualizar' && !node.disabled))`), 'Valid transfer code did not enable preview');
  await clickDialogButton('Pré-visualizar');
  await poll(async () => await evaluate(`window.__transfersHarness.previewCount === 1 && Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Não foi possível pré-visualizar este código.')))`), 'First transfer preview failure was not rendered');

  const previewFailure = await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Transferências') && node.getBoundingClientRect().width > 0);
    const labels = dialog ? [...dialog.querySelectorAll('button')].map(node => (node.innerText || node.textContent || '').trim()) : [];
    return { labels, text: dialog?.textContent ?? '' };
  })()`);
  if (!previewFailure.text.includes('Não foi possível pré-visualizar este código.') || !previewFailure.labels.includes('Tentar novamente') || previewFailure.labels.includes('Atualizar estado')) throw new Error(`Preview recovery was not specific and retryable: ${JSON.stringify(previewFailure)}`);

  await clickDialogButton('Tentar novamente');
  await poll(async () => await evaluate(`window.__transfersHarness.previewCount === 2 && Boolean([...document.querySelectorAll('[role="dialog"] .ant-card')].find(node => node.textContent?.includes('Pessoa da pré-visualização')))`), 'Successful preview retry did not render its card');

  const recovered = await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Transferências') && node.getBoundingClientRect().width > 0);
    const text = dialog?.textContent ?? '';
    const selectedReceive = Boolean(dialog && [...dialog.querySelectorAll('.ant-segmented-item-selected')].find(node => node.textContent?.trim() === 'Receber'));
    const hasPreviewCard = Boolean(dialog && [...dialog.querySelectorAll('.ant-card')].find(node => node.textContent?.includes('Pessoa da pré-visualização')));
    return {
      text,
      selectedReceive,
      hasPreviewCard,
      hasCodeInput: Boolean(dialog?.querySelector('input[aria-label="Código"]')),
      hasErrorAlert: Boolean(dialog?.querySelector('.ant-alert-error')),
      previewCount: window.__transfersHarness.previewCount,
      stored: Object.values(localStorage),
      href: location.href,
    };
  })()`);
  if (recovered.previewCount !== 2) throw new Error(`Preview request count was not exactly two: ${JSON.stringify(recovered)}`);
  if (recovered.hasErrorAlert || recovered.text.includes('Não foi possível pré-visualizar este código.')) throw new Error(`Preview error remained after successful retry: ${JSON.stringify(recovered)}`);
  if (!recovered.hasPreviewCard || !recovered.text.includes('Pessoa da pré-visualização')) throw new Error(`Preview card or person was not visible after retry: ${JSON.stringify(recovered)}`);
  if (!recovered.selectedReceive || !recovered.hasCodeInput) throw new Error(`Successful retry did not return to the Receive flow: ${JSON.stringify(recovered)}`);
  if (recovered.stored.some(value => String(value).includes(code)) || recovered.href.includes(code)) throw new Error('Transfer code was persisted in browser storage or URL');

  process.stdout.write('People Transfers runtime passed: load retry label and preview error-to-success retry restored Receive with exactly two preview calls.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (!devServer.killed) devServer.kill('SIGTERM');
}

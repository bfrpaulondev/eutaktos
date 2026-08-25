import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5192';
const debugPort = '9235';
const appUrl = `http://127.0.0.1:${appPort}/`;
const appOrigin = new URL(appUrl).origin;
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
    const done = pending.get(message.id);
    if (done) {
      pending.delete(message.id);
      done(message);
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

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}

let server;
let browser;
let cdp;
try {
  server = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', appPort, '--strictPort'], { stdio: 'ignore' });
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');

  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-system-theme-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'Chromium did not open the application');

  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('DOMStorage.enable');
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  await poll(async () => await evaluate(cdp, "document.readyState === 'complete'"), 'Initial page did not load');
  const preferences = { paletteId: 'classic', colorMode: 'system', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false };
  await poll(async () => {
    try {
      await cdp.send('DOMStorage.setDOMStorageItem', {
        storageId: { securityOrigin: appOrigin, isLocalStorage: true },
        key: 'eutaktos.preferences.v4',
        value: JSON.stringify(preferences),
      });
      return true;
    } catch (error) {
      if (String(error).includes('Frame not found') || String(error).includes('Inspected target navigated or closed')) return false;
      throw error;
    }
  }, 'Preference storage did not become available');

  await cdp.send('Page.reload', { ignoreCache: true });
  await poll(async () => await evaluate(cdp, `document.readyState === 'complete' && document.documentElement.dataset.colorMode === 'system' && document.documentElement.dataset.palette === 'classic' && !matchMedia('(prefers-color-scheme: dark)').matches && getComputedStyle(document.documentElement).colorScheme.includes('light')`), 'System mode did not resolve to light');

  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await poll(async () => await evaluate(cdp, `matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.colorMode === 'system' && document.documentElement.dataset.palette === 'dark' && getComputedStyle(document.documentElement).colorScheme.includes('dark')`), 'System mode did not react to dark preference without reload');

  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await poll(async () => await evaluate(cdp, `!matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.colorMode === 'system' && document.documentElement.dataset.palette === 'classic' && getComputedStyle(document.documentElement).colorScheme.includes('light')`), 'System mode did not react back to light without reload');

  process.stdout.write('System theme runtime passed: System follows light/dark preference changes without reload and keeps root color-scheme synchronized.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (server && !server.killed) server.kill('SIGTERM');
}

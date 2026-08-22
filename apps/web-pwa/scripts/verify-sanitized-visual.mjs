import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5190';
const debugPort = '9233';
const appUrl = `http://127.0.0.1:${appPort}/`;
const appOrigin = new URL(appUrl).origin;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const wait = ms => new Promise(done => setTimeout(done, ms));

async function poll(operation, label, attempts = 60) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
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
  const socket = new WebSocket(url); const pending = new Map(); let nextId = 1;
  socket.addEventListener('message', event => { const message = JSON.parse(String(event.data)); const done = pending.get(message.id); if (done) { pending.delete(message.id); done(message); } });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({ send(method, params = {}) { const id = nextId++; socket.send(JSON.stringify({ id, method, params })); return new Promise((done, fail) => pending.set(id, result => result.error ? fail(new Error(result.error.message)) : done(result.result))); }, close() { socket.close(); } }));
    socket.addEventListener('error', reject, { once: true });
  });
}

let server; let browser; let cdp;
try {
  server = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', appPort, '--strictPort'], { stdio: 'ignore' });
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, [`--remote-debugging-port=${debugPort}`, '--headless=new', '--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/eutaktos-visual-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'Chromium did not open the application');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('DOMStorage.enable');
  const storageId = { securityOrigin: appOrigin, isLocalStorage: true };
  const cases = [
    ['pt-PT', 320, '/', 'Tudo em boa ordem.'],
    ['en', 390, '/people', 'People and organization'],
    ['es', 1440, '/preferencias', 'Tus elecciones'],
  ];
  for (const [locale, width, path, expected] of cases) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width <= 390 });
    await cdp.send('Page.navigate', { url: new URL(path, appUrl).toString() });
    await poll(async () => (await cdp.send('Runtime.evaluate', { expression: "document.readyState === 'complete'", returnByValue: true })).result.value === true, `Page did not load for ${locale}`);
    const preferences = { paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale, textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false };
    await cdp.send('DOMStorage.setDOMStorageItem', { storageId, key: 'eutaktos.preferences.v4', value: JSON.stringify(preferences) });
    await cdp.send('Page.reload', { ignoreCache: true });
    await poll(async () => {
      const result = await cdp.send('Runtime.evaluate', { expression: `document.readyState === 'complete' && document.documentElement.lang === ${JSON.stringify(locale)} && document.body.innerText.includes(${JSON.stringify(expected)})`, returnByValue: true });
      return result.result.value === true;
    }, `Sanitized ${locale} visual state did not render at ${width}px`, 80);
    const visual = await cdp.send('Runtime.evaluate', { expression: "(() => { const main = document.querySelector('#main'); const nav = document.querySelector('nav'); const title = document.querySelector('h1, h2'); const box = main?.getBoundingClientRect(); return { width: innerWidth, mainWidth: Math.round(box?.width ?? 0), navVisible: Boolean(nav && getComputedStyle(nav).display !== 'none'), headingVisible: Boolean(title && getComputedStyle(title).visibility !== 'hidden'), overflow: document.documentElement.scrollWidth > innerWidth }; })()", returnByValue: true });
    const snapshot = visual.result.value;
    if (snapshot.width !== width || snapshot.mainWidth <= 0 || !snapshot.navVisible || !snapshot.headingVisible || snapshot.overflow) throw new Error(`Visual layout regression at ${width}px: ${JSON.stringify(snapshot)}`);
  }
  process.stdout.write('Sanitized visual regression checks passed: ephemeral rendered-layout baselines verified at 320pt-PT, 390en and 1440es using public no-data states only; no screenshots are retained or committed.\n');
} finally {
  cdp?.close(); if (browser && !browser.killed) browser.kill('SIGTERM'); if (server && !server.killed) server.kill('SIGTERM');
}

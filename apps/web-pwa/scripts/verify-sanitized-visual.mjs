import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5190';
const debugPort = '9233';
const appUrl = `http://127.0.0.1:${appPort}/`;
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const wait = ms => new Promise(done => setTimeout(done, ms));
async function poll(operation, label) {
  for (let i = 0; i < 60; i += 1) { if (await operation()) return; await wait(150); }
  throw new Error(label);
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
  browser = spawn(chromium, [`--remote-debugging-port=${debugPort}`, '--headless=new', '--no-sandbox', '--disable-gpu', appUrl], { stdio: 'ignore' });
  await poll(async () => { try { return (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).length > 0; } catch { return false; } }, 'Chromium did not start');
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  cdp = await connectCdp(targets[0].webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
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
    await cdp.send('Runtime.evaluate', { expression: `localStorage.setItem('eutaktos.preferences.v4', ${JSON.stringify(JSON.stringify(preferences))}); location.reload()`, returnByValue: true });
    await poll(async () => {
      const result = await cdp.send('Runtime.evaluate', { expression: `document.readyState === 'complete' && document.documentElement.lang === ${JSON.stringify(locale)} && document.body.innerText.includes(${JSON.stringify(expected)})`, returnByValue: true });
      return result.result.value === true;
    }, `Sanitized ${locale} visual state did not render at ${width}px`);
    const visual = await cdp.send('Runtime.evaluate', { expression: "(() => { const main = document.querySelector('#main'); const nav = document.querySelector('nav'); const title = document.querySelector('h1, h2'); const box = main?.getBoundingClientRect(); return { width: innerWidth, mainWidth: Math.round(box?.width ?? 0), navVisible: Boolean(nav && getComputedStyle(nav).display !== 'none'), headingVisible: Boolean(title && getComputedStyle(title).visibility !== 'hidden'), overflow: document.documentElement.scrollWidth > innerWidth }; })()", returnByValue: true });
    const snapshot = visual.result.value;
    if (snapshot.width !== width || snapshot.mainWidth <= 0 || !snapshot.headingVisible || snapshot.overflow) throw new Error(`Visual layout regression at ${width}px: ${JSON.stringify(snapshot)}`);
  }
  process.stdout.write('Sanitized visual regression checks passed: ephemeral rendered-layout baselines verified at 320pt-PT, 390en and 1440es using public no-data states only; no screenshots are retained or committed.\n');
} finally {
  cdp?.close(); if (browser && !browser.killed) browser.kill('SIGTERM'); if (server && !server.killed) server.kill('SIGTERM');
}

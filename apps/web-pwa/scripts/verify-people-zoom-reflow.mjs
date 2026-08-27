import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5207';
const debugPort = '9249';
const appUrl = `http://127.0.0.1:${appPort}/`;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function poll(operation, label, attempts = 100) {
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
    if (!resolver) return;
    pending.delete(message.id);
    resolver(message);
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({
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

let server;
let browser;
let cdp;

async function evaluate(expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}

async function navigate(path, cssWidth) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: cssWidth, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: new URL(path, appUrl).toString() });
  await poll(async () => await evaluate("document.readyState === 'complete'"), `${path} did not load at ${cssWidth}px`);
}

async function clickExactButton(label) {
  return await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled);
    button?.click();
    return Boolean(button);
  })()`);
}

async function assertReflow(label, expectedWidth) {
  const snapshot = await evaluate(`(() => {
    const visibleDialog = [...document.querySelectorAll('[role="dialog"]')].find(node => getComputedStyle(node).visibility !== 'hidden');
    const dialogRect = visibleDialog?.getBoundingClientRect();
    const main = document.querySelector('#main');
    const mainRect = main?.getBoundingClientRect();
    const visibleButtons = [...document.querySelectorAll('button')]
      .filter(node => getComputedStyle(node).visibility !== 'hidden' && node.getBoundingClientRect().width > 0)
      .map(node => ({ text: (node.innerText || node.textContent || '').trim(), rect: node.getBoundingClientRect() }))
      .filter(item => item.text)
      .map(item => ({ text: item.text, left: Math.round(item.rect.left), right: Math.round(item.rect.right) }));
    return {
      innerWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      main: mainRect ? { left: Math.round(mainRect.left), right: Math.round(mainRect.right), scrollWidth: main.scrollWidth } : null,
      dialog: dialogRect ? { left: Math.round(dialogRect.left), right: Math.round(dialogRect.right) } : null,
      visibleButtons,
    };
  })()`);

  if (snapshot.innerWidth !== expectedWidth || snapshot.rootScrollWidth > snapshot.innerWidth || snapshot.bodyScrollWidth > snapshot.innerWidth) {
    throw new Error(`${label} did not reflow into ${expectedWidth}px: ${JSON.stringify(snapshot)}`);
  }
  if (snapshot.dialog && (snapshot.dialog.left < -1 || snapshot.dialog.right > snapshot.innerWidth + 1)) {
    throw new Error(`${label} dialog escaped the zoom-equivalent viewport: ${JSON.stringify(snapshot)}`);
  }
  const escapedButton = snapshot.visibleButtons.find(button => button.left < -1 || button.right > snapshot.innerWidth + 1);
  if (escapedButton) throw new Error(`${label} action escaped the zoom-equivalent viewport: ${JSON.stringify(escapedButton)}`);
}

try {
  server = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', appPort, '--strictPort'], { stdio: 'ignore' });
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-px10-zoom-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'Chromium did not open the app');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: true, reducedTransparency: false, highContrast: false }));
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    const people = [
      { id: 'person-zoom-1', displayName: 'Ana Martins', preferredLocale: 'pt-PT', active: true },
      { id: 'person-zoom-2', displayName: 'Bruno Costa', preferredLocale: 'pt-PT', active: true },
    ];
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = init?.method ?? 'GET';
      if (url.pathname === '/api/session' && method === 'GET') return json({ actorId: 'actor-zoom', capabilities: ['people.read', 'people.write', 'eligibility.read', 'eligibility.write', 'availability.read', 'availability.write', 'responsibilities.read', 'responsibilities.write', 'schedule.read'] });
      if (url.pathname === '/api/people' && method === 'GET') return json(people);
      if (url.pathname === '/api/people/directory' && method === 'GET') return json({
        contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z',
        capabilities: { writePeople: true, availability: true, eligibility: true, responsibilities: true, schedule: true },
        filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [] },
        people: people.map(person => ({ ...person, groups: [], availability: { status: 'ready', current: 'available', currentReasonCodes: [] }, eligibility: { status: 'ready', enabledAssignmentTypeIds: [] }, responsibilities: { status: 'ready', keys: [] }, assignmentHistory: { status: 'ready' } })),
      });
      if (url.pathname.startsWith('/api/people/') && url.pathname.endsWith('/contact') && method === 'GET') return json({ email: 'ana@example.test' });
      if (url.pathname === '/api/households' && method === 'GET') return json([]);
      if (url.pathname === '/api/service-groups' && method === 'GET') return json([]);
      if (url.pathname === '/api/responsibilities' && method === 'GET') return json([]);
      if (url.pathname.includes('/eligibility') && method === 'GET') return json([]);
      if (url.pathname.includes('/availability') && method === 'GET') return json([]);
      if (url.pathname === '/api/midweek' && method === 'GET') return json({ meetings: [], studentAssignments: [], nonStudentAssignments: [] });
      return json({ error: 'Not available in PX10 zoom harness' }, 503);
    };
  })();` });

  // WCAG reflow equivalence: a 1280 CSS px desktop at 200% exposes roughly 640 CSS px;
  // at 400% it exposes roughly 320 CSS px. Keep desktop emulation: browser zoom changes
  // the effective CSS viewport, not the user agent/device mode.
  for (const scenario of [
    { label: '200% zoom equivalent', width: 640 },
    { label: '400% zoom equivalent', width: 320 },
  ]) {
    await navigate('/pessoas?view=directory', scenario.width);
    await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Ana Martins'))`), `People Directory did not become ready for ${scenario.label}`);
    await assertReflow(`People Directory ${scenario.label}`, scenario.width);
    if (!await clickExactButton('Adicionar pessoa')) throw new Error(`Add person action missing for ${scenario.label}`);
    await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Adicionar pessoa') && getComputedStyle(node).visibility !== 'hidden'))`), `Person Wizard did not open for ${scenario.label}`);
    await assertReflow(`Person Wizard ${scenario.label}`, scenario.width);
    if (!await clickExactButton('Cancelar')) throw new Error(`Person Wizard cancel missing for ${scenario.label}`);
  }

  process.stdout.write('PX10 zoom-equivalent reflow regression passed at 200% (640 CSS px) and 400% (320 CSS px) for People Directory and Person Wizard, with no horizontal document overflow or escaped primary actions.\n');
} finally {
  try { cdp?.close(); } catch {}
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (server && !server.killed) server.kill('SIGTERM');
}

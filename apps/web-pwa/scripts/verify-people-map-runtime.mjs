import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5205';
const debugPort = '9245';
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
    } catch (error) { lastError = error; }
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
    if (resolver) { pending.delete(message.id); resolver(message); }
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
      return text === ${JSON.stringify(label)} && rect.width > 0 && rect.height > 0 && !node.disabled;
    });
    if (!button) return false;
    button.click();
    return true;
  })()`), `Button ${label} did not become available`);
}

async function setNumberInput(label, value) {
  return await poll(async () => await evaluate(`(() => {
    const input = document.querySelector('input[aria-label=${JSON.stringify(label)}]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  })()`), `Input ${label} did not become available`);
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-map-${process.pid}`, 'about:blank'], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url === 'about:blank');
  }, 'Chromium did not open the map harness page');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    const point = (personId, displayName, latitude, longitude) => ({ personId, displayName, latitude, longitude });
    window.__mapHarness = { mode: localStorage.getItem('eutaktos-map-test-mode') ?? 'write', points: [point('person-ana', 'Ana Runtime', 38.72, -9.14), point('person-bruno', 'Bruno Runtime', 40.21, -8.41)], putCount: 0, deleteCount: 0, listCount: 0, tileRequests: [] };
    const ok = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const failure = (status, message) => new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
    const caps = mode => mode === 'write' ? ['people.read', 'map.read', 'map.write'] : mode === 'readonly' ? ['people.read', 'map.read'] : mode === 'no-map' ? ['people.read'] : [];
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = init?.method ?? 'GET';
      const harness = window.__mapHarness;
      const mode = localStorage.getItem('eutaktos-map-test-mode') ?? harness.mode;
      harness.mode = mode;
      if (url.origin !== window.location.origin) { harness.tileRequests.push(rawUrl); return failure(503, 'external request blocked'); }
      if (url.pathname === '/api/session' && method === 'GET') {
        if (mode === 'unauthenticated') return failure(401, 'Unauthorized');
        return ok({ actorId: 'actor-runtime', capabilities: caps(mode) });
      }
      if (url.pathname === '/api/people/map' && method === 'GET') {
        harness.listCount += 1;
        if (mode === 'unauthenticated') return failure(401, 'Unauthorized');
        if (mode === 'forbidden' || mode === 'no-map') return failure(403, 'Forbidden');
        if (mode === 'error') return failure(503, 'Unavailable');
        return ok({ contractVersion: 'people-map-v1', points: harness.points });
      }
      if (url.pathname === '/api/people' && method === 'GET') return ok([
        { id: 'person-ana', displayName: 'Ana Runtime', active: true },
        { id: 'person-bruno', displayName: 'Bruno Runtime', active: true },
      ]);
      const mapLocation = /^\\/api\\/people\\/([^/]+)\\/map-location$/.exec(url.pathname);
      if (mapLocation && method === 'PUT') {
        harness.putCount += 1;
        const body = JSON.parse(String(init?.body ?? '{}'));
        await new Promise(done => setTimeout(done, 60));
        const personId = decodeURIComponent(mapLocation[1]);
        const latitude = Math.round(body.latitude * 100) / 100;
        const longitude = Math.round(body.longitude * 100) / 100;
        const existing = harness.points.findIndex(point => point.personId === personId);
        const displayName = personId === 'person-bruno' ? 'Bruno Runtime' : 'Ana Runtime';
        const next = point(personId, displayName, latitude, longitude);
        if (existing >= 0) harness.points.splice(existing, 1, next); else harness.points.push(next);
        return ok({ contractVersion: 'people-map-location-v1', changed: true, location: { latitude, longitude } });
      }
      if (mapLocation && method === 'DELETE') {
        harness.deleteCount += 1;
        const personId = decodeURIComponent(mapLocation[1]);
        harness.points = harness.points.filter(point => point.personId !== personId);
        return ok({ contractVersion: 'people-map-location-v1', changed: true, location: null });
      }
      if (url.pathname === '/api/people/directory' && method === 'GET') return ok({ contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z', capabilities: { writePeople: false, availability: false, eligibility: false, responsibilities: false, schedule: false }, filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [], labels: [] }, people: [] });
      return failure(503, 'Not available in map harness');
    };
  })();` });

  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=map', appUrl).toString() });
  await poll(async () => await evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('#people-map-title')?.textContent?.includes('Mapa de pessoas'))`), 'Map view did not load');
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Ana Runtime') && document.querySelector('#main')?.textContent?.includes('Lista de localizações aproximadas'))`), 'Map fallback list did not render the authorized point');
  await poll(async () => await evaluate(`Boolean(document.querySelector('.leaflet-container'))`), 'Graphical Leaflet map did not render');
  const graphicalMarker = await poll(async () => await evaluate(`(() => { const marker = [...document.querySelectorAll('.leaflet-marker-icon')].find(node => node.getAttribute('title') === 'Bruno Runtime'); if (!marker) return false; marker.focus(); return true; })()`), 'Keyboard-focusable graphical marker did not render');
  if (!graphicalMarker) throw new Error('Keyboard-focusable graphical marker did not render');
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Bruno Runtime' && node.getAttribute('aria-pressed') === 'true'))`), 'Keyboard marker selection did not update the equivalent list');
  const responsive = await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`);
  if (!responsive) throw new Error('People Map created horizontal overflow at mobile viewport width');
  const initial = await evaluate(`({ href: location.href, stored: Object.entries(localStorage), tiles: window.__mapHarness.tileRequests, mapText: document.querySelector('#main')?.textContent ?? '' })`);
  if (initial.href.includes('38.72') || initial.href.includes('-9.14')) throw new Error('Map coordinates leaked into URL');
  if (initial.stored.some(([, value]) => String(value).includes('Ana Runtime') || String(value).includes('38.72'))) throw new Error('Map person data leaked into localStorage');
  if (initial.tiles.some(url => String(url).includes('Ana Runtime') || String(url).includes('person-ana'))) throw new Error('A third-party map request received Person identity');

  if (!await clickExactButton('Adicionar localização aproximada')) throw new Error('Map write entry point is missing for map.write');
  if (!await clickExactButton('Cancelar')) throw new Error('Map editor did not allow cancellation without a write');
  if (!await clickExactButton('Editar localização')) throw new Error('Map edit action is missing for an existing point');
  await setNumberInput('Latitude', '38.520123');
  await setNumberInput('Longitude', '-8.890456');
  await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Guardar localização'); button?.click(); button?.click(); return true; })()`);
  await poll(async () => await evaluate(`window.__mapHarness.putCount === 1 && window.__mapHarness.points.some(point => point.personId === 'person-ana' && point.latitude === 38.52 && point.longitude === -8.89)`), 'Map save did not normalize/refetch or double-submit guard failed');
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Ana Runtime') && document.querySelector('#main')?.textContent?.includes('38.52, -8.89'))`), 'Authoritative map refetch did not render normalized location');
  const afterSave = await evaluate(`({ href: location.href, stored: Object.entries(localStorage), putCount: window.__mapHarness.putCount })`);
  if (afterSave.putCount !== 1) throw new Error(`Map double-submit guard failed: PUT count=${afterSave.putCount}`);
  if (afterSave.href.includes('38.520123') || afterSave.stored.some(([, value]) => String(value).includes('38.520123'))) throw new Error('Map mutation data leaked into URL or localStorage');

  if (!await clickExactButton('Editar localização')) throw new Error('Map edit action did not return after authoritative refetch');
  if (!await clickExactButton('Remover localização')) throw new Error('Map remove action is missing for an existing point');
  await poll(async () => await evaluate(`window.__mapHarness.deleteCount === 1 && !window.__mapHarness.points.some(point => point.personId === 'person-ana')`), 'Map removal did not complete');
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Bruno Runtime') && !document.querySelector('#main')?.textContent?.includes('38.52, -8.89'))`), 'Map removal did not refresh the semantic list');

  await evaluate(`localStorage.setItem('eutaktos-map-test-mode', 'readonly'); true`);
  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=map', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Tem acesso de consulta.'))`), 'Read-only Map state did not render');
  if (await evaluate(`Boolean([...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Adicionar localização aproximada'))`)) throw new Error('Map write action rendered without map.write');

  await evaluate(`localStorage.setItem('eutaktos-map-test-mode', 'no-map'); true`);
  await cdp.send('Page.navigate', { url: new URL('/pessoas', appUrl).toString() });
  await poll(async () => await evaluate(`document.readyState === 'complete'`), 'People overview did not reload');
  if (await evaluate(`Boolean([...document.querySelectorAll('nav button')].find(node => (node.innerText || node.textContent || '').trim() === 'Mapa'))`)) throw new Error('Map entry point rendered without map.read');

  await evaluate(`localStorage.setItem('eutaktos-map-test-mode', 'unauthenticated'); true`);
  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=map', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('A sessão terminou antes de carregar o mapa.'))`), 'Map 401 state was not rendered distinctly');

  await evaluate(`localStorage.setItem('eutaktos-map-test-mode', 'forbidden'); true`);
  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=map', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Não tem permissão para consultar o mapa de pessoas.'))`), 'Map 403 state was not rendered distinctly');

  await evaluate(`localStorage.setItem('eutaktos-map-test-mode', 'error'); true`);
  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=map', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Não foi possível carregar o mapa de pessoas.'))`), 'Map error state was not rendered distinctly');
  await evaluate(`localStorage.setItem('eutaktos-map-test-mode', 'write'); true`);
  if (!await clickExactButton('Tentar novamente')) throw new Error('Map error retry was not available');
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Ana Runtime'))`), 'Map retry did not recover');

  process.stdout.write('PX9.10/PX9.11 map runtime passed: capability gate, visual map/list equivalence, normalized edit/refetch, 401/403/error retry, double-submit and URL/storage/tile privacy.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (!devServer.killed) devServer.kill('SIGTERM');
}

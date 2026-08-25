import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5191';
const debugPort = '9234';
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
  return new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', () => resolvePromise({
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

async function visibleCenter(selector, label) {
  return await evaluate(`(() => {
    const node = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => {
      const rect = item.getBoundingClientRect();
      const style = getComputedStyle(item);
      return (item.innerText || item.textContent || '').trim() === ${JSON.stringify(label)} && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
}

async function mouseClick(point) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
}

async function pressKey(key, code, virtualKeyCode) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode });
}

async function clickVisibleButton(label) {
  const point = await visibleCenter('button', label);
  if (!point) return false;
  await mouseClick(point);
  return true;
}

async function selectionModeReady() {
  return await evaluate(`Boolean([...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Concluir'))`);
}

async function activateBulkSelection() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await selectionModeReady()) return;

    const exportPoint = await visibleCenter('button', 'Exportar');
    if (!exportPoint) throw new Error('Export button is not visible');
    await mouseClick(exportPoint);

    try {
      await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="menuitem"]')].find(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return (node.innerText || node.textContent || '').trim() === 'Selecionar pessoas para exportar' && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && node.getAttribute('aria-disabled') !== 'true';
      }))`), 'Export menu did not become keyboard-ready', 20);
    } catch {
      continue;
    }

    const focused = await evaluate(`(() => {
      const menu = [...document.querySelectorAll('[role="menu"]')].find(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });
      if (!menu) return false;
      menu.focus();
      return document.activeElement === menu || menu.contains(document.activeElement);
    })()`);

    if (focused) {
      await pressKey('ArrowDown', 'ArrowDown', 40);
      await pressKey('ArrowDown', 'ArrowDown', 40);
      await pressKey('Enter', 'Enter', 13);
      await wait(350);
      if (await selectionModeReady()) return;
    }

    const targetFocused = await evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitem"]')].find(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return (node.innerText || node.textContent || '').trim() === 'Selecionar pessoas para exportar' && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && node.getAttribute('aria-disabled') !== 'true';
      });
      if (!item) return false;
      item.setAttribute('tabindex', '0');
      item.focus();
      return document.activeElement === item;
    })()`);
    if (targetFocused) {
      await pressKey('Enter', 'Enter', 13);
      await wait(350);
      if (await selectionModeReady()) return;
    }
  }

  const diagnostic = await evaluate(`({
    active: document.activeElement ? { role: document.activeElement.getAttribute('role'), text: (document.activeElement.innerText || document.activeElement.textContent || '').trim() } : null,
    menus: [...document.querySelectorAll('[role="menu"]')].map(node => ({ text: (node.innerText || node.textContent || '').trim(), display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility, rect: node.getBoundingClientRect().toJSON() })),
    items: [...document.querySelectorAll('[role="menuitem"]')].map(node => ({ text: (node.innerText || node.textContent || '').trim(), disabled: node.getAttribute('aria-disabled'), display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility, rect: node.getBoundingClientRect().toJSON() }))
  })`);
  throw new Error(`Bulk selection mode could not be activated; observed=${JSON.stringify(diagnostic)}`);
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-px4-11-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'Chromium did not open the application');

  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    const originalFetch = window.fetch.bind(window);
    const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const pathname = new URL(rawUrl, window.location.origin).pathname;
      if (pathname === '/api/people' && (!init?.method || init.method === 'GET')) return json([{ id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true }]);
      if (pathname === '/api/people/directory' && (!init?.method || init.method === 'GET')) return json({
        contractVersion: 'people-directory-v1',
        generatedAt: '2026-08-25T12:00:00.000Z',
        capabilities: { writePeople: true, availability: true, eligibility: true, responsibilities: true, schedule: true },
        filters: { groups: [{ id: 'group-runtime', name: 'Runtime group' }], responsibilityKeys: ['service-group-overseer'], assignmentTypeIds: ['builtin:reading'] },
        people: [{
          id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true,
          groups: [{ id: 'group-runtime', name: 'Runtime group' }],
          availability: { status: 'ready', current: 'available', currentReasonCodes: [] },
          eligibility: { status: 'ready', enabledAssignmentTypeIds: ['builtin:reading'] },
          responsibilities: { status: 'ready', keys: ['service-group-overseer'] },
          assignmentHistory: { status: 'ready', lastCompletedMeetingDate: '2026-07-22' },
        }],
      });
      if (pathname === '/api/service-groups' && (!init?.method || init.method === 'GET')) return json([{ id: 'group-runtime', name: 'Runtime group', memberIds: ['person-runtime'] }]);
      if (pathname === '/api/midweek' && (!init?.method || init.method === 'GET')) return json({ meetings: [], studentAssignments: [], nonStudentAssignments: [] });
      return originalFetch(input, init);
    };
  })();` });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: new URL('/pessoas?view=directory', appUrl).toString() });

  await poll(async () => await evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('#people-directory-title')) && Boolean(document.querySelector('#main')?.textContent?.includes('Runtime person'))`), 'People Directory did not load');

  const initial = await evaluate(`({
    path: location.pathname + location.search,
    visibleCheckboxes: [...document.querySelectorAll('input[type="checkbox"]')].filter(node => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }).length,
    hasExport: [...document.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Exportar')
  })`);
  if (!initial.hasExport) throw new Error('PX4.11 export entry point is missing');
  if (initial.visibleCheckboxes !== 0) throw new Error(`Default directory browsing exposed ${initial.visibleCheckboxes} selection checkboxes`);

  await activateBulkSelection();
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Concluir')) && Boolean(document.querySelector('#main')?.textContent?.includes('A exportação em lote inclui apenas os campos autorizados pelas suas permissões atuais.'))`), 'Bulk selection mode did not open');

  const bulkState = await evaluate(`({
    url: location.pathname + location.search + location.hash,
    visibleCheckboxes: [...document.querySelectorAll('input[type="checkbox"]')].filter(node => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }).length,
    exportSelectedDisabled: [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Exportar selecionadas')?.disabled ?? null
  })`);
  if (bulkState.visibleCheckboxes < 1) throw new Error('Bulk selection mode did not expose row selection on desktop');
  if (bulkState.exportSelectedDisabled !== true) throw new Error('Export selected must start disabled with no selected people');
  if (bulkState.url.includes('person-runtime')) throw new Error('Selection identifiers leaked into the URL');

  if (!await clickVisibleButton('Selecionar resultados')) throw new Error('Select current results action is missing');
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('1 pessoa selecionada')) && [...document.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Exportar selecionadas' && !node.disabled)`), 'Selecting current results did not update the bulk state');

  if (!await clickVisibleButton('Limpar seleção')) throw new Error('Clear selection action is missing');
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('0 pessoas selecionadas')) && [...document.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Exportar selecionadas' && node.disabled)`), 'Clearing selection did not restore the safe state');

  if (!await clickVisibleButton('Concluir')) throw new Error('Done action is missing');
  await poll(async () => await evaluate(`![...document.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Concluir') && !document.querySelector('#main')?.textContent?.includes('A exportação em lote inclui apenas os campos autorizados pelas suas permissões atuais.')`), 'Bulk selection mode did not close cleanly');

  const finalState = await evaluate(`({
    url: location.pathname + location.search + location.hash,
    visibleCheckboxes: [...document.querySelectorAll('input[type="checkbox"]')].filter(node => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }).length
  })`);
  if (finalState.visibleCheckboxes !== 0) throw new Error('Selection controls remained visible after leaving bulk mode');
  if (finalState.url !== initial.path) throw new Error(`Bulk selection changed the route: ${initial.path} -> ${finalState.url}`);

  process.stdout.write('PX4.11 runtime passed: export menu, keyboard-activatable bulk selection, safe default browsing, select/clear/done state and URL privacy.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (!devServer.killed) devServer.kill('SIGTERM');
}

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

async function pageState() {
  return evaluate(`({
    href: location.href,
    main: document.querySelector('#main')?.textContent ?? '',
    storage: JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    requests: window.__px5ContactRequests ?? []
  })`);
}

async function clickText(label) {
  return poll(async () => evaluate(`(() => {
    const nodes = [...document.querySelectorAll('button,[role="tab"],[role="option"]')];
    const node = nodes.find(value => {
      const rect = value.getBoundingClientRect();
      return (value.innerText || value.textContent || '').trim() === ${JSON.stringify(label)}
        && rect.width > 0
        && rect.height > 0
        && getComputedStyle(value).visibility !== 'hidden';
    });
    if (!node) return false;
    node.click();
    return true;
  })()`), `Control ${label} did not become available after the authoritative render`, 40);
}

async function setInput(label, value) {
  return evaluate(`(() => {
    const node = document.querySelector('[aria-label=${JSON.stringify(label)}]');
    if (!node) return false;
    const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, ${JSON.stringify(value)});
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function selectOption(label, option) {
  const opened = await evaluate(`(() => {
    const node = document.querySelector('[aria-label=${JSON.stringify(label)}]');
    const target = node?.closest('.ant-select') ?? node;
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    target.click();
    return true;
  })()`);
  if (!opened) return false;
  return poll(async () => evaluate(`(() => {
    const node = [...document.querySelectorAll('.ant-select-item-option')]
      .find(value => (value.innerText || value.textContent || '').trim() === ${JSON.stringify(option)});
    node?.click();
    return Boolean(node);
  })()`), `Option ${option} was not offered`, 20);
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-px5-profile-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'Chromium did not open the app');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    window.__px5ContactMode = 'unavailable';
    window.__px5OrdinaryContact = {};
    window.__px5ContactRequests = [];
    const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const error = (status, message) => new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
    const meeting = { id: 'meeting-px5', date: '2032-06-12', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'published', slots: [] };
    const overview = {
      meetings: [meeting],
      studentAssignments: [
        { id: 'completed-px5', meetingId: meeting.id, slotId: 'slot-a', studentId: 'person-px5', studentDisplayName: 'Sanitized profile', assistantId: null, assistantDisplayName: null, state: 'completed' },
        { id: 'assistant-px5', meetingId: meeting.id, slotId: 'slot-b', studentId: 'other-person', studentDisplayName: 'Other', assistantId: 'person-px5', assistantDisplayName: 'Sanitized profile', state: 'assigned' }
      ],
      nonStudentAssignments: [
        { id: 'cancelled-px5', meetingId: meeting.id, slotId: 'slot-c', personId: 'person-px5', personDisplayName: 'Sanitized profile', role: 'chairman', state: 'cancelled' }
      ]
    };
    window.fetch = async (input, init = {}) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = init.method ?? 'GET';
      const pathname = url.pathname;
      if (pathname === '/api/session' && method === 'GET') return json({ actorId: 'actor-px5', capabilities: ['people.read', 'people.write', 'audit.read'] });
      if (pathname === '/api/people' && method === 'GET') return json([{ id: 'person-px5', displayName: 'Sanitized profile', preferredLocale: 'pt-PT', active: true }]);
      if (pathname === '/api/people/directory' && method === 'GET') return json({
        contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z',
        capabilities: { writePeople: true, availability: false, eligibility: false, responsibilities: false, schedule: false },
        filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [] },
        people: [{ id: 'person-px5', displayName: 'Sanitized profile', preferredLocale: 'pt-PT', active: true, groups: [], availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } }]
      });
      if (pathname === '/api/people/person-px5/availability' && method === 'GET') return json([]);
      if (pathname === '/api/people/person-px5/eligibility' && method === 'GET') return json([{ assignmentTypeId: 'builtin:apply-yourself-to-the-ministry', enabled: true, decidedAt: '2032-06-01T10:00:00.000Z' }]);
      if (pathname === '/api/people/person-px5/emergency-contacts' && method === 'GET') return json([]);
      if (pathname === '/api/people/person-px5/contact') {
        window.__px5ContactRequests.push({ method, body: init.body ?? null, url: url.pathname });
        if (window.__px5ContactMode === 'unavailable') return error(503, 'Temporarily unavailable');
        if (window.__px5ContactMode === 'forbidden') return error(403, 'Forbidden');
        if (method === 'GET') return json(window.__px5OrdinaryContact);
        if (method === 'PUT') {
          window.__px5OrdinaryContact = JSON.parse(init.body ?? '{}');
          return json(window.__px5OrdinaryContact);
        }
      }
      if (pathname === '/api/service-groups' && method === 'GET') return json([]);
      if (pathname === '/api/households' && method === 'GET') return json([]);
      if (pathname === '/api/responsibilities' && method === 'GET') return json([]);
      if (pathname === '/api/midweek' && method === 'GET') return json(overview);
      if (pathname === '/api/audit/history' && method === 'GET') return json([]);
      return error(503, 'Route not available in sanitized PX5 harness');
    };
  })();` });

  const directoryUrl = new URL('/pessoas?view=directory&status=active', appUrl).toString();
  await cdp.send('Page.navigate', { url: directoryUrl });
  await poll(async () => {
    const state = await pageState();
    return state.main.includes('Diretório') && state.main.includes('Sanitized profile') && state.main.includes('Ver perfil');
  }, 'Directory did not become ready');

  if (!await clickText('Ver perfil')) throw new Error('View profile action was not found');
  await poll(async () => {
    const state = await pageState();
    return state.href.includes('view=profile') && state.href.includes('person=person-px5') && state.main.includes('Resumo') && state.main.includes('Contactos');
  }, 'Profile did not become ready');
  if (!await clickText('Contactos')) throw new Error('Contacts tab was not found');
  await poll(async () => (await pageState()).main.includes('Esta secção não está disponível neste momento.') && (await pageState()).main.includes('Tentar novamente'), 'Contacts unavailable/retry state did not render');

  await evaluate('window.__px5ContactMode = "ready"; true');
  if (!await clickText('Tentar novamente')) throw new Error('Contacts retry action was not found');
  await poll(async () => (await pageState()).main.includes('Resumo'), 'Authoritative retry refetch did not finish');
  if (!await clickText('Contactos')) throw new Error('Contacts tab was not available after retry');
  await poll(async () => (await pageState()).main.includes('Não existem contactos de perfil registados.'), 'Contacts empty state did not render after retry');

  if (!await clickText('Editar contactos')) throw new Error('Contacts edit action was not found');
  if (!await setInput('Telefone', '+351 900 000 002')) throw new Error('Phone input was not found');
  if (!await setInput('E-mail', 'invalid')) throw new Error('Email input was not found for local validation');
  if (!await evaluate(`(() => { const save = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Guardar'); save?.click(); return Boolean(save); })()`)) throw new Error('Contacts save action was not found for invalid-email validation');
  await poll(async () => {
    const state = await pageState();
    return state.main.includes('Introduza um e-mail válido.') && state.requests.filter(request => request.method === 'PUT').length === 0;
  }, 'Invalid email did not render a field error or incorrectly sent a PUT');
  if (!await setInput('E-mail', 'contact@example.test')) throw new Error('Email input was not found for address validation');
  if (!await setInput('Morada', 'x'.repeat(501))) throw new Error('Address input was not found for local validation');
  if (!await evaluate(`(() => { const save = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Guardar'); save?.click(); return Boolean(save); })()`)) throw new Error('Contacts save action was not found for oversized-address validation');
  await poll(async () => {
    const state = await pageState();
    return state.main.includes('A morada não pode exceder 500 caracteres.') && state.requests.filter(request => request.method === 'PUT').length === 0;
  }, 'Oversized address did not render a field error or incorrectly sent a PUT');
  if (!await setInput('Morada', 'Rua de teste')) throw new Error('Address input was not found for valid save');
  await evaluate(`(() => {
    const save = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Guardar');
    save?.click(); save?.click();
    return Boolean(save);
  })()`);
  await poll(async () => (await pageState()).requests.filter(request => request.method === 'PUT').length === 1, 'Double-click caused more than one contact PUT');
  await poll(async () => {
    const state = await pageState();
    return state.main.includes('Resumo') && state.requests.filter(request => request.method === 'GET').length >= 3;
  }, 'Authoritative profile refetch did not finish after contact save');
  if (!await clickText('Contactos')) throw new Error('Contacts tab was not available after authoritative refetch');
  await poll(async () => {
    const state = await pageState();
    return state.main.includes('+351 900 000 002') && state.main.includes('contact@example.test') && state.main.includes('Rua de teste');
  }, 'Saved authoritative contact values did not render');

  if (!await clickText('Designações')) throw new Error('Assignments tab was not found');
  await poll(async () => (await pageState()).main.includes('Futuros') && (await pageState()).main.includes('Concluída') && (await pageState()).main.includes('Cancelada'), 'Assignment history/upcoming evidence did not render');
  if (!await selectOption('Estado', 'Concluída')) throw new Error('Assignment state filter was not interactive');
  await poll(async () => !(await pageState()).main.includes('Cancelada'), 'Assignment state filter did not remove non-matching evidence');

  await evaluate('window.__px5ContactMode = "forbidden"; true');
  if (!await clickText('Voltar')) throw new Error('Profile back action was not found before the 403 re-entry check');
  await poll(async () => {
    const state = await pageState();
    return state.href.includes('view=directory') && !state.href.includes('person=') && state.main.includes('Diretório');
  }, 'Back did not restore the directory before the 403 re-entry check');
  if (!await clickText('Ver perfil')) throw new Error('View profile action was not found for the 403 re-entry check');
  await poll(async () => {
    const state = await pageState();
    return state.href.includes('view=profile') && state.href.includes('person=person-px5') && state.main.includes('Resumo') && state.main.includes('Contactos');
  }, 'Profile did not reload for the 403 re-entry check');
  if (!await clickText('Contactos')) throw new Error('Contacts tab was not available after the 403 re-entry check');
  await poll(async () => {
    const state = await pageState();
    return state.main.includes('Não tem permissão para consultar esta secção.')
      && !state.main.includes('Editar contactos')
      && !state.main.includes('Tentar novamente');
  }, 'Contacts 403 state was not rendered as a blocked, non-retryable section');

  const beforeNavigation = await pageState();
  if (beforeNavigation.href.includes('contact%40example.test') || beforeNavigation.href.includes('+351')) throw new Error('Contact PII leaked into the URL');
  if (beforeNavigation.storage.includes('contact@example.test') || beforeNavigation.storage.includes('+351 900 000 002')) throw new Error('Contact PII leaked into browser storage');

  await evaluate('history.back(); true');
  await poll(async () => {
    const state = await pageState();
    return state.href.includes('view=directory') && !state.href.includes('person=') && state.main.includes('Diretório');
  }, 'Back did not restore the directory');
  await evaluate('history.forward(); true');
  await poll(async () => {
    const state = await pageState();
    return state.href.includes('view=profile') && state.href.includes('person=person-px5') && state.main.includes('Resumo');
  }, 'Forward did not restore the profile');

  process.stdout.write('PX5 browser regression passed: sanitized Directory → Profile → Contacts retry/empty/local-validation/edit/save/refetch/403, duplicate-save guard, PII boundary, Back/Forward, localized assignment evidence and state filter.\n');
} finally {
  try { cdp?.close(); } catch {}
  browser?.kill('SIGTERM');
  devServer.kill('SIGTERM');
}

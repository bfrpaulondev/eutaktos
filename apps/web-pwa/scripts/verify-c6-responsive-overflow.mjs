import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5201';
const debugPort = '9243';
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

async function navigate(path, width, mobile) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile });
  await cdp.send('Page.navigate', { url: new URL(path, appUrl).toString() });
  await poll(async () => await evaluate("document.readyState === 'complete'"), `${path} did not load at ${width}px`);
}

async function clickExactButton(label) {
  return await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled);
    button?.click();
    return Boolean(button);
  })()`);
}

async function assertNoDocumentOverflow(label, expectedWidth) {
  const snapshot = await evaluate(`(() => ({
    innerWidth,
    rootScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    main: (() => { const node = document.querySelector('#main'); const rect = node?.getBoundingClientRect(); return rect ? { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), scrollWidth: node.scrollWidth } : null; })(),
    dialog: (() => { const node = [...document.querySelectorAll('[role="dialog"]')].find(item => getComputedStyle(item).visibility !== 'hidden'); const rect = node?.getBoundingClientRect(); return rect ? { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) } : null; })(),
  }))()`);
  if (snapshot.innerWidth !== expectedWidth || snapshot.rootScrollWidth > snapshot.innerWidth || snapshot.bodyScrollWidth > snapshot.innerWidth) {
    throw new Error(`${label} overflowed the viewport: ${JSON.stringify(snapshot)}`);
  }
  if (snapshot.dialog && (snapshot.dialog.left < -1 || snapshot.dialog.right > snapshot.innerWidth + 1)) {
    throw new Error(`${label} dialog escaped the viewport: ${JSON.stringify(snapshot)}`);
  }
}

try {
  server = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', appPort, '--strictPort'], { stdio: 'ignore' });
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-c6-responsive-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'Chromium did not open the app');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    const meeting = { id: 'meeting-responsive', date: '2032-06-10', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'draft', slots: [{ id: 'slot-responsive', position: 0, durationMinutes: 5, titleKey: 'midweek.parts.applyYourselfToTheMinistry', partDefinitionId: 'builtin:apply-yourself-to-the-ministry' }] };
    const people = [
      { id: 'person-1', displayName: 'Ana Martins', preferredLocale: 'pt-PT', active: true },
      { id: 'person-2', displayName: 'Bruno Costa', preferredLocale: 'pt-PT', active: true },
      { id: 'person-3', displayName: 'Carla Dias', preferredLocale: 'pt-PT', active: true },
      { id: 'person-4', displayName: 'Diana Lopes', preferredLocale: 'pt-PT', active: true },
    ];
    const recommendation = {
      contractVersion: 'people-recommendation-v1', evidenceContractVersion: 'px7-evidence-v1', inputContractVersion: 'px7-recommendation-input-v1',
      target: { meetingId: meeting.id, slotId: 'slot-responsive', assignmentTypeId: 'builtin:apply-yourself-to-the-ministry', meetingDate: meeting.date, startsAt: '2032-06-10T18:30:00.000Z', endsAt: '2032-06-10T18:35:00.000Z' },
      candidates: [
        { personId: 'person-1', displayName: 'Ana Martins', status: 'candidate', rank: 1, reasons: [{ code: 'ELIGIBLE' }, { code: 'AVAILABLE' }, { code: 'NO_MEETING_CONFLICT' }, { code: 'LONGER_SINCE_LAST_ASSIGNMENT' }], warnings: [], history: { kind: 'completed-history', lastCompletedMeetingDate: '2032-04-01', daysSinceLastCompletedAssignment: 70 }, sameWeekAssignmentCount: 0 },
        { personId: 'person-2', displayName: 'Bruno Costa', status: 'candidate', rank: 2, reasons: [{ code: 'ELIGIBLE' }, { code: 'AVAILABLE' }, { code: 'NO_MEETING_CONFLICT' }], warnings: [{ code: 'HAS_WEEKLY_ASSIGNMENT' }], history: { kind: 'completed-history', lastCompletedMeetingDate: '2032-05-01', daysSinceLastCompletedAssignment: 40 }, sameWeekAssignmentCount: 1 },
        { personId: 'person-3', displayName: 'Carla Dias', status: 'candidate', rank: 3, reasons: [{ code: 'ELIGIBLE' }, { code: 'AVAILABLE' }, { code: 'NO_MEETING_CONFLICT' }], warnings: [{ code: 'NO_COMPLETED_ASSIGNMENT_HISTORY' }], history: { kind: 'no-completed-history' }, sameWeekAssignmentCount: 0 },
        { personId: 'person-4', displayName: 'Diana Lopes', status: 'candidate', rank: 4, reasons: [{ code: 'ELIGIBLE' }, { code: 'AVAILABLE' }, { code: 'NO_MEETING_CONFLICT' }], warnings: [], history: { kind: 'completed-history', lastCompletedMeetingDate: '2032-05-15', daysSinceLastCompletedAssignment: 26 }, sameWeekAssignmentCount: 0 },
      ], excluded: [],
    };
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = init?.method ?? 'GET';
      if (url.pathname === '/api/session' && method === 'GET') return json({ actorId: 'actor-responsive', capabilities: ['people.read', 'people.write', 'eligibility.read', 'availability.read', 'schedule.read', 'schedule.write'] });
      if (url.pathname === '/api/people' && method === 'GET') return json(people);
      if (url.pathname === '/api/people/directory' && method === 'GET') return json({
        contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z',
        capabilities: { writePeople: true, availability: false, eligibility: false, responsibilities: false, schedule: false },
        filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [] },
        people: people.map(person => ({ ...person, groups: [], availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } })),
      });
      if (url.pathname === '/api/households' && method === 'GET') return json([]);
      if (url.pathname === '/api/service-groups' && method === 'GET') return json([]);
      if (url.pathname === '/api/midweek' && method === 'GET') return json({ meetings: [meeting], studentAssignments: [], nonStudentAssignments: [] });
      if (url.pathname === '/api/people/recommendations' && method === 'GET') return json(recommendation);
      return json({ error: 'Not available in C6 responsive harness' }, 503);
    };
  })();` });

  await navigate('/pessoas?view=directory', 1024, false);
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Ana Martins')) && Boolean(document.querySelector('.people-directory-desktop .ant-table'))`), 'People Directory did not become ready at 1024px');
  await assertNoDocumentOverflow('People Directory at 1024px', 1024);
  if (!await clickExactButton('Adicionar pessoa')) throw new Error('Add person action was not found at 1024px');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Adicionar pessoa') && getComputedStyle(node).visibility !== 'hidden'))`), 'Person Wizard did not open at 1024px');
  await assertNoDocumentOverflow('Person Wizard at 1024px', 1024);
  if (!await clickExactButton('Cancelar')) throw new Error('Person Wizard cancel action was not found');

  for (const width of [320, 375, 390, 430]) {
    await navigate('/agenda', width, true);
    await poll(async () => await evaluate(`[...document.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Designar estudante')`), `Agenda did not become ready at ${width}px`);
    if (!await clickExactButton('Designar estudante')) throw new Error(`Assign student action was not found at ${width}px`);
    await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Ana Martins') && getComputedStyle(node).visibility !== 'hidden'))`), `Recommendation Picker did not load at ${width}px`);
    await assertNoDocumentOverflow(`Recommendation Picker at ${width}px`, width);
    const actionState = await evaluate(`(() => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Ana Martins') && getComputedStyle(node).visibility !== 'hidden');
      return { selectCount: [...(dialog?.querySelectorAll('button') ?? [])].filter(node => (node.innerText || node.textContent || '').trim() === 'Selecionar').length, allEligible: Boolean([...dialog.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Ver todos os elegíveis (4)')), cancel: Boolean([...dialog.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Cancelar')) };
    })()`);
    if (actionState.selectCount !== 3 || !actionState.allEligible || !actionState.cancel) throw new Error(`Picker actions were clipped or missing at ${width}px: ${JSON.stringify(actionState)}`);
    if (!await clickExactButton('Cancelar')) throw new Error(`Picker cancel action was not found at ${width}px`);
  }

  process.stdout.write('C6 responsive overflow regression passed: People Directory + Wizard at 1024px and Recommendation Picker at 320/375/390/430px stay within the document viewport without clipping primary actions.\n');
} finally {
  try { cdp?.close(); } catch {}
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (server && !server.killed) server.kill('SIGTERM');
}

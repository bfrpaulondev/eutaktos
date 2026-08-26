import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5198';
const debugPort = '9240';
const appUrl = `http://127.0.0.1:${appPort}/`;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const expectedRecommendationSearch = '?meetingId=meeting-runtime&slotId=slot-runtime';

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

function assertIdentityOnlyRequests(requests, label) {
  if (!requests.length || requests.some(request => request.search !== expectedRecommendationSearch || request.method !== 'GET' || request.body !== null)) {
    throw new Error(`${label} did not preserve the C5.3 identity-only contract: ${JSON.stringify(requests)}`);
  }
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
  return await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled);
    button?.click();
    return Boolean(button);
  })()`);
}

async function clickDialogButton(dialogTitle, label, occurrence = 0) {
  return await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes(${JSON.stringify(dialogTitle)}) && getComputedStyle(node).visibility !== 'hidden');
    const buttons = [...(dialog?.querySelectorAll('button') ?? [])].filter(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled);
    buttons[${occurrence}]?.click();
    return Boolean(buttons[${occurrence}]);
  })()`);
}

async function visibleDialog(title) {
  return await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes(${JSON.stringify(title)}) && getComputedStyle(node).visibility !== 'hidden'))`);
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-recommendation-picker-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'Chromium did not open the app');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    window.__recommendationRequests = [];
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    const meeting = { id: 'meeting-runtime', date: '2032-06-10', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'draft', slots: [{ id: 'slot-runtime', position: 0, durationMinutes: 5, titleKey: 'midweek.parts.applyYourselfToTheMinistry', partDefinitionId: 'builtin:apply-yourself-to-the-ministry' }] };
    const people = [
      { id: 'person-1', displayName: 'Ana Martins', preferredLocale: 'pt-PT', active: true },
      { id: 'person-2', displayName: 'Bruno Costa', preferredLocale: 'pt-PT', active: true },
      { id: 'person-3', displayName: 'Carla Dias', preferredLocale: 'pt-PT', active: true },
      { id: 'person-4', displayName: 'Diana Lopes', preferredLocale: 'pt-PT', active: true },
    ];
    const recommendation = {
      contractVersion: 'people-recommendation-v1', evidenceContractVersion: 'px7-evidence-v1', inputContractVersion: 'px7-recommendation-input-v1',
      target: { meetingId: meeting.id, slotId: 'slot-runtime', assignmentTypeId: 'builtin:apply-yourself-to-the-ministry', meetingDate: meeting.date, startsAt: '2032-06-10T18:30:00.000Z', endsAt: '2032-06-10T18:35:00.000Z' },
      candidates: [
        { personId: 'person-1', displayName: 'Ana Martins', status: 'candidate', rank: 1, reasons: [{ code: 'ELIGIBLE' }, { code: 'AVAILABLE' }, { code: 'NO_MEETING_CONFLICT' }, { code: 'LONGER_SINCE_LAST_ASSIGNMENT' }], warnings: [], history: { kind: 'completed-history', lastCompletedMeetingDate: '2032-04-01', daysSinceLastCompletedAssignment: 70 }, sameWeekAssignmentCount: 0 },
        { personId: 'person-2', displayName: 'Bruno Costa', status: 'candidate', rank: 2, reasons: [{ code: 'ELIGIBLE' }, { code: 'AVAILABLE' }, { code: 'NO_MEETING_CONFLICT' }], warnings: [{ code: 'HAS_WEEKLY_ASSIGNMENT' }], history: { kind: 'completed-history', lastCompletedMeetingDate: '2032-05-01', daysSinceLastCompletedAssignment: 40 }, sameWeekAssignmentCount: 1 },
        { personId: 'person-3', displayName: 'Carla Dias', status: 'candidate', rank: 3, reasons: [{ code: 'ELIGIBLE' }, { code: 'AVAILABLE' }, { code: 'NO_MEETING_CONFLICT' }], warnings: [{ code: 'NO_COMPLETED_ASSIGNMENT_HISTORY' }], history: { kind: 'no-completed-history' }, sameWeekAssignmentCount: 0 },
        { personId: 'person-4', displayName: 'Diana Lopes', status: 'candidate', rank: 4, reasons: [{ code: 'ELIGIBLE' }, { code: 'AVAILABLE' }, { code: 'NO_MEETING_CONFLICT' }], warnings: [], history: { kind: 'completed-history', lastCompletedMeetingDate: '2032-05-15', daysSinceLastCompletedAssignment: 26 }, sameWeekAssignmentCount: 0 },
      ],
      excluded: [],
    };
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, window.location.origin);
      const method = init?.method ?? 'GET';
      if (url.pathname === '/api/session' && method === 'GET') return json({ actorId: 'actor-runtime', capabilities: ['people.read', 'eligibility.read', 'availability.read', 'schedule.read', 'schedule.write'] });
      if (url.pathname === '/api/people' && method === 'GET') return json(people);
      if (url.pathname === '/api/midweek' && method === 'GET') return json({ meetings: [meeting], studentAssignments: [{ id: 'student-assignment-runtime', meetingId: meeting.id, slotId: 'slot-runtime', studentId: 'person-4', studentDisplayName: 'Diana Lopes', assistantId: null, assistantDisplayName: null, state: 'assigned' }], nonStudentAssignments: [] });
      if (url.pathname === '/api/people/recommendations' && method === 'GET') {
        window.__recommendationRequests.push({ search: url.search, method, body: init?.body ?? null });
        return json(recommendation);
      }
      return json({ error: 'Not available in recommendation picker harness' }, 503);
    };
  })();` });

  await cdp.send('Page.navigate', { url: new URL('/agenda', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('2032')) && [...document.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Designar estudante')`), 'Agenda did not become ready');

  if (!await clickExactButton('Designar estudante')) throw new Error('Assign student action was not found');
  await poll(async () => await visibleDialog('Designar estudante'), 'Assign student dialog did not open');
  const recommendationState = await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Designar estudante'));
    if (!dialog?.textContent?.includes('Ana Martins')) return null;
    return {
      text: dialog.textContent ?? '',
      comboboxes: dialog.querySelectorAll('[role="combobox"]').length,
      saveDisabled: [...dialog.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === 'Guardar')?.disabled ?? true,
      buttons: [...dialog.querySelectorAll('button')].map(node => (node.innerText || node.textContent || '').trim()),
      requests: window.__recommendationRequests,
      url: location.href,
    };
  })()`), 'Recommendations did not load in assign flow');
  for (const expected of ['Recomendados', 'Ana Martins', 'Bruno Costa', 'Carla Dias', 'Elegível para este tipo de designação.', 'Disponível no horário desta designação.']) if (!recommendationState.text.includes(expected)) throw new Error(`Assign picker is missing ${expected}`);
  if (recommendationState.text.includes('Diana Lopes') && recommendationState.text.indexOf('Diana Lopes') > recommendationState.text.indexOf('Recomendados')) throw new Error('Rank 4 candidate leaked into the top-three recommendation surface before C5.6 reveal');
  if (!recommendationState.buttons.includes('Ver todos os elegíveis (4)')) throw new Error('C5.6 all-eligible escape hatch is missing');
  if (!recommendationState.buttons.includes('Selecionar manualmente')) throw new Error('Explicit manual override is missing');
  for (const rawCode of ['ELIGIBLE', 'AVAILABLE', 'NO_MEETING_CONFLICT', 'LONGER_SINCE_LAST_ASSIGNMENT']) if (recommendationState.text.includes(rawCode)) throw new Error(`Raw PX7 code leaked into UI: ${rawCode}`);
  if (recommendationState.comboboxes !== 1) throw new Error(`Manual student selector should be hidden by default; expected only assistant combobox, got ${recommendationState.comboboxes}`);
  if (!recommendationState.saveDisabled) throw new Error('Save should remain disabled before a person is selected');
  assertIdentityOnlyRequests(recommendationState.requests, 'Assign recommendation request');
  if (recommendationState.url.includes('person-') || recommendationState.url.includes('Ana%20Martins') || recommendationState.url.includes('Ana Martins')) throw new Error('Person recommendation data leaked into browser URL');

  if (!await clickDialogButton('Designar estudante', 'Ver todos os elegíveis (4)')) throw new Error('All-eligible reveal action was not found');
  const allEligibleState = await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Designar estudante'));
    if (!dialog?.textContent?.includes('Diana Lopes')) return null;
    return { text: dialog.textContent ?? '', buttons: [...dialog.querySelectorAll('button')].map(node => (node.innerText || node.textContent || '').trim()) };
  })()`), 'All-eligible list did not reveal rank 4 candidate');
  if (!allEligibleState.text.includes('Outros elegíveis') || !allEligibleState.buttons.includes('Ocultar lista completa')) throw new Error('Expanded all-eligible state is incomplete');
  if (!await clickDialogButton('Designar estudante', 'Selecionar', 3)) throw new Error('Rank 4 eligible candidate could not be selected');
  const selectedState = await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Designar estudante'));
    const selected = [...(dialog?.querySelectorAll('button') ?? [])].find(node => node.getAttribute('aria-pressed') === 'true');
    const save = [...(dialog?.querySelectorAll('button') ?? [])].find(node => (node.innerText || node.textContent || '').trim() === 'Guardar');
    return selected ? { selected: (selected.innerText || selected.textContent || '').trim(), selectedContext: selected.closest('.ant-card')?.textContent ?? '', saveDisabled: save?.disabled ?? true } : null;
  })()`), 'All-eligible selection did not bind to assignment state');
  if (selectedState.selected !== 'Selecionado' || !selectedState.selectedContext.includes('Diana Lopes') || selectedState.saveDisabled) throw new Error(`Rank 4 eligible selection did not populate the assignment form: ${JSON.stringify(selectedState)}`);

  if (!await clickDialogButton('Designar estudante', 'Selecionar manualmente')) throw new Error('Manual override reveal action was not found');
  const manualState = await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Designar estudante'));
    if (!dialog?.textContent?.includes('A seleção manual mostra pessoas ativas.')) return null;
    return { text: dialog.textContent ?? '', comboboxes: dialog.querySelectorAll('[role="combobox"]').length, buttons: [...dialog.querySelectorAll('button')].map(node => (node.innerText || node.textContent || '').trim()) };
  })()`), 'Manual override did not reveal');
  if (manualState.comboboxes !== 2 || !manualState.buttons.includes('Ocultar seleção manual')) throw new Error(`Manual override did not stay explicitly disclosed: ${JSON.stringify(manualState)}`);
  if (!manualState.text.includes('Não afirma que estejam elegíveis, disponíveis ou sem conflitos')) throw new Error('Manual override incorrectly implies PX7 eligibility evidence');

  if (!await clickDialogButton('Designar estudante', 'Cancelar')) throw new Error('Assign dialog cancel action was not found');
  await poll(async () => !(await visibleDialog('Designar estudante')), 'Assign dialog did not close');

  const beforeRoleRequests = await evaluate(`window.__recommendationRequests.length`);
  if (!await clickExactButton('Designar função')) throw new Error('Assign role action was not found');
  await poll(async () => await visibleDialog('Designar função'), 'Assign role dialog did not open');
  await wait(300);
  const afterRoleRequests = await evaluate(`window.__recommendationRequests.length`);
  if (afterRoleRequests !== beforeRoleRequests) throw new Error('Role flow called the student-slot recommendation contract without a canonical role target');
  if (!await clickDialogButton('Designar função', 'Cancelar')) throw new Error('Role dialog cancel action was not found');

  await cdp.send('Page.navigate', { url: new URL('/designacoes', appUrl).toString() });
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes('Diana Lopes')) && [...document.querySelectorAll('button')].some(node => (node.innerText || node.textContent || '').trim() === 'Substituir')`), 'Assignments workspace did not become ready');
  const beforeReplacementRequests = await evaluate(`window.__recommendationRequests.length`);
  if (!await clickExactButton('Substituir')) throw new Error('Replace student action was not found');
  await poll(async () => await visibleDialog('Substituir'), 'Replace student dialog did not open');
  const replaceState = await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Substituir'));
    if (!dialog?.textContent?.includes('Ana Martins')) return null;
    return {
      text: dialog.textContent ?? '',
      comboboxes: dialog.querySelectorAll('[role="combobox"]').length,
      buttons: [...dialog.querySelectorAll('button')].map(node => (node.innerText || node.textContent || '').trim()),
      newRequests: window.__recommendationRequests.slice(${beforeReplacementRequests}),
    };
  })()`), 'Recommendations did not load in replacement flow');
  if (!replaceState.text.includes('Recomendados') || !replaceState.buttons.includes('Ver todos os elegíveis (4)') || !replaceState.buttons.includes('Selecionar manualmente')) throw new Error('Replacement flow did not reuse both C5.6 escape hatches');
  if (replaceState.comboboxes !== 1) throw new Error('Replacement manual student selector should be hidden by default');
  assertIdentityOnlyRequests(replaceState.newRequests, 'Replacement recommendation request');
  if (!await clickDialogButton('Substituir', 'Ver todos os elegíveis (4)')) throw new Error('Replacement all-eligible reveal action was not found');
  const replacementAllState = await poll(async () => await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Substituir'));
    if (!dialog?.textContent?.includes('Diana Lopes')) return null;
    const selected = [...dialog.querySelectorAll('button')].find(node => node.getAttribute('aria-pressed') === 'true');
    return { selectedContext: selected?.closest('.ant-card')?.textContent ?? '' };
  })()`), 'Replacement all-eligible list did not reveal current rank 4 person');
  if (!replacementAllState.selectedContext.includes('Diana Lopes')) throw new Error('Replacement all-eligible list did not preserve current human selection');

  process.stdout.write('C5.6 recommendation picker regression passed: top-three default, explicit all-eligible reveal, rank-4 selection, disclosed manual override, replacement reuse, identity-only requests and role boundary.\n');
} finally {
  try { cdp?.close(); } catch {}
  browser?.kill('SIGTERM');
  devServer.kill('SIGTERM');
}

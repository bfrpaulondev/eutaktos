import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5194';
const debugPort = '9237';
const appUrl = `http://127.0.0.1:${appPort}/pessoas`;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const wait = milliseconds => new Promise(done => setTimeout(done, milliseconds));

async function poll(operation, label) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const value = await operation(); if (value) return value; } catch (error) { lastError = error; }
    await wait(150);
  }
  throw new Error(`${label}: ${String(lastError ?? 'timed out')}`);
}
function connectCdp(url) {
  const socket = new WebSocket(url); const pending = new Map(); let nextId = 1;
  socket.addEventListener('message', event => { const message = JSON.parse(String(event.data)); const done = pending.get(message.id); if (done) { pending.delete(message.id); done(message); } });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({
      send(method, params = {}) { const id = nextId++; socket.send(JSON.stringify({ id, method, params })); return new Promise((done, fail) => pending.set(id, response => response.error ? fail(new Error(response.error.message)) : done(response.result))); },
      close() { socket.close(); },
    }));
    socket.addEventListener('error', reject, { once: true });
  });
}

let server; let browser; let cdp;
async function evaluate(expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}
async function clickExact(label, root = 'document') {
  return await poll(async () => await evaluate(`(() => {
    const root = ${root};
    const button = [...root.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled);
    if (!button) return false; button.click(); return true;
  })()`), `O botão ${label} não ficou disponível`);
}
async function clickTopModalButton(label) {
  return await poll(async () => await evaluate(`(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(node => getComputedStyle(node).visibility !== 'hidden');
    const dialog = dialogs.at(-1);
    const button = [...(dialog?.querySelectorAll('button') ?? [])].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled);
    if (!button) return false; button.click(); return true;
  })()`), `O botão de confirmação ${label} não ficou disponível`);
}
async function openArchiveFromTools() {
  await clickExact('Ferramentas');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="menuitem"], .ant-dropdown-menu-item')].find(item => item.textContent?.includes('Arquivo / A não publicar')))`), 'A entrada Arquivo não foi apresentada no menu Ferramentas');
  await evaluate(`[...document.querySelectorAll('[role="menuitem"], .ant-dropdown-menu-item')].find(item => item.textContent?.includes('Arquivo / A não publicar'))?.click()`);
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Arquivo / A não publicar') && getComputedStyle(node).visibility !== 'hidden'))`), 'O diálogo Arquivo não abriu');
}
async function selectPerson(label) {
  const dialogRoot = `[...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Arquivo / A não publicar') && getComputedStyle(node).visibility !== 'hidden')`;
  const opened = await evaluate(`(() => { const dialog = ${dialogRoot}; const trigger = dialog?.querySelector('.ant-select-selector'); if (!trigger) return false; for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) trigger.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })); return true; })()`);
  if (!opened) throw new Error('O seletor de pessoa Arquivo não ficou disponível');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('.ant-select-item-option-content')].find(node => node.textContent?.trim() === ${JSON.stringify(label)}))`), `A opção Arquivo ${label} não ficou disponível`);
  await evaluate(`[...document.querySelectorAll('.ant-select-item-option-content')].find(node => node.textContent?.trim() === ${JSON.stringify(label)})?.parentElement?.click()`);
}

try {
  server = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', appPort, '--strictPort'], { stdio: 'ignore' });
  await poll(async () => (await fetch(appUrl)).ok, 'O servidor de desenvolvimento não iniciou');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-archive-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => { const targets = await (await fetch(`${debugUrl}/json`)).json(); return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl)); }, 'O Chromium não abriu Pessoas');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    localStorage.setItem('eutaktos.preferences.v4', JSON.stringify({ paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false }));
    const people = [
      { id: 'person-a', displayName: 'Pessoa A QA', preferredLocale: 'pt-PT', active: true },
      { id: 'person-b', displayName: 'Pessoa B QA', preferredLocale: 'pt-PT', active: true },
    ];
    const archive = new Map(people.map(person => [person.id, { status: 'active', history: [] }]));
    window.__archiveProfileReads = 0;
    const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const archiveState = personId => {
      const entry = archive.get(personId);
      if (!entry) return null;
      const current = entry.status === 'archived' ? entry.history.at(-1) : undefined;
      return { status: entry.status, ...(current ? { current: { archivedAt: current.occurredAt, reason: current.reason } } : {}), history: entry.history, capabilities: { write: true } };
    };
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(rawUrl, location.origin); const method = init?.method ?? 'GET';
      if (url.pathname === '/api/session' && method === 'GET') return json({ actorId: 'actor-archive-qa', capabilities: ['people.read', 'people.write'] });
      if (url.pathname === '/api/people' && method === 'GET') { window.__archiveProfileReads += 1; return json(people.map(person => ({ ...person, active: archive.get(person.id).status === 'active' }))); }
      if (url.pathname === '/api/people/directory' && method === 'GET') {
        await new Promise(done => setTimeout(done, 180));
        return json({ contractVersion: 'people-directory-v1', generatedAt: '2032-06-10T12:00:00.000Z', capabilities: { writePeople: true, availability: false, eligibility: false, responsibilities: false, schedule: false }, filters: { groups: [], responsibilityKeys: [], assignmentTypeIds: [] }, people: people.map(person => ({ ...person, active: archive.get(person.id).status === 'active', groups: [], availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' }, responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' } })) });
      }
      const match = url.pathname.match(/^\\/api\\/people\\/(person-[ab])\\/archive$/);
      if (match && method === 'GET') return json(archiveState(match[1]));
      if (match && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')); const entry = archive.get(match[1]);
        if (body.action === 'archive' && entry.status === 'active' && typeof body.reason === 'string') { entry.status = 'archived'; entry.history.push({ action: 'archived', occurredAt: '2032-06-10T12:00:00.000Z', reason: body.reason }); return json(archiveState(match[1])); }
        if (body.action === 'restore' && entry.status === 'archived') { entry.status = 'active'; entry.history.push({ action: 'restored', occurredAt: '2032-06-10T12:01:00.000Z' }); return json(archiveState(match[1])); }
        return new Response(JSON.stringify({ error: 'Invalid archive transition' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Not available in archive harness' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    };
  })();` });

  await cdp.send('Page.navigate', { url: `${appUrl}?view=profile&person=person-b` });
  await poll(async () => await evaluate(`document.querySelector('#main')?.textContent?.includes('Pessoa B QA') && document.querySelector('#main')?.textContent?.includes('Resumo')`), 'O perfil QA B não ficou disponível');
  await openArchiveFromTools();
  await wait(700);
  const initialArchiveTarget = await evaluate(`(() => { const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Arquivo / A não publicar') && getComputedStyle(node).visibility !== 'hidden'); const select = dialog?.querySelector('.ant-select'); return { selected: select?.querySelector('.ant-select-selection-item')?.textContent?.trim() ?? null, inputValue: select?.querySelector('input')?.value ?? null, selectText: select?.textContent?.trim() ?? null, text: dialog?.textContent?.slice(0, 300) ?? null }; })()`);
  if (initialArchiveTarget.selected !== 'Pessoa B QA' && initialArchiveTarget.inputValue !== 'Pessoa B QA' && initialArchiveTarget.selectText !== 'Pessoa B QA') throw new Error(`O Arquivo aberto do perfil não manteve o alvo B após o carregamento assíncrono: ${JSON.stringify(initialArchiveTarget)}`);
  const focusInDialog = await evaluate(`(() => { const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Arquivo / A não publicar') && getComputedStyle(node).visibility !== 'hidden'); return Boolean(dialog?.contains(document.activeElement)); })()`);
  if (!focusInDialog) throw new Error('O foco não entrou no diálogo Arquivo');
  const reasonSet = await evaluate(`(() => { const area = [...document.querySelectorAll('[role="dialog"] textarea')].find(node => !node.disabled); if (!area) return false; const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(area, 'Teste QA de arquivo'); area.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  if (!reasonSet) throw new Error('O motivo de arquivo QA não ficou editável');
  await clickExact('Arquivar pessoa');
  await poll(async () => await evaluate(`document.body.textContent?.includes('Pessoa selecionada: Pessoa B QA') && document.body.textContent?.includes('Esta ação deixa a pessoa inativa')`), 'A confirmação Arquivo não repetiu o alvo B e a consequência');
  await clickTopModalButton('Arquivar pessoa');
  await poll(async () => await evaluate(`document.body.textContent?.includes('Arquivada') && window.__archiveProfileReads >= 2`), 'O arquivo não atualizou o estado autoritativo e o perfil');
  await clickExact('Fechar');
  await poll(async () => await evaluate(`!document.body.textContent?.includes('Arquivo / A não publicar') || ![...document.querySelectorAll('[role="dialog"]')].some(node => node.textContent?.includes('Arquivo / A não publicar') && getComputedStyle(node).visibility !== 'hidden')`), 'O diálogo Arquivo não fechou');
  await poll(async () => await evaluate(`document.activeElement?.textContent?.trim() === 'Ferramentas'`), 'O foco não voltou à origem Ferramentas após fechar Arquivo');
  await poll(async () => await evaluate(`document.querySelector('#main')?.textContent?.includes('Inativo')`), 'O perfil não mostrou Inativo após arquivo autoritativo');
  await openArchiveFromTools();
  await poll(async () => await evaluate(`document.body.textContent?.includes('Restaurar pessoa') && document.body.textContent?.includes('Pessoa B QA')`), 'O restauro do alvo contextual não ficou disponível');
  await clickExact('Restaurar pessoa');
  await poll(async () => await evaluate(`document.body.textContent?.includes('Pessoa selecionada: Pessoa B QA') && document.body.textContent?.includes('Esta ação restaura explicitamente')`), 'A confirmação de restauro não repetiu o alvo B e a consequência');
  await clickTopModalButton('Restaurar pessoa');
  await poll(async () => await evaluate(`window.__archiveProfileReads >= 3`), 'O restauro não disparou uma refetch autoritativa do perfil');
  await clickExact('Fechar');
  await poll(async () => await evaluate(`document.querySelector('#main')?.textContent?.includes('Ativo') && !document.querySelector('#main')?.textContent?.includes('Inativo')`), 'O perfil permaneceu desatualizado após restauro autoritativo');

  await cdp.send('Page.navigate', { url: `${appUrl}?view=directory` });
  await poll(async () => await evaluate(`document.querySelector('#main')?.textContent?.includes('Diretório') && document.querySelector('#main')?.textContent?.includes('Pessoa A QA')`), 'O Diretório QA não ficou disponível');
  await openArchiveFromTools();
  await wait(700);
  const unscopedArchiveTarget = await evaluate(`(() => { const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Arquivo / A não publicar') && getComputedStyle(node).visibility !== 'hidden'); const select = dialog?.querySelector('.ant-select'); return { selected: select?.querySelector('.ant-select-selection-item')?.textContent?.trim() ?? null, inputValue: select?.querySelector('input')?.value ?? null, selectText: select?.textContent?.trim() ?? null, text: dialog?.textContent?.slice(0, 220) ?? null }; })()`);
  if (unscopedArchiveTarget.selected || unscopedArchiveTarget.inputValue || unscopedArchiveTarget.selectText !== 'Escolher pessoa') throw new Error(`O Arquivo aberto fora do perfil selecionou implicitamente uma pessoa: ${JSON.stringify(unscopedArchiveTarget)}`);
  const archiveResult = await evaluate(`document.body.textContent ?? ''`);
  if (archiveResult.includes('person-a') || archiveResult.includes('person-b') || archiveResult.includes('actor-archive-qa')) throw new Error('A interface Arquivo expôs identificadores técnicos');

  process.stdout.write('People Archive regression passed: profile-context target survives async load; archive/restore refetches the authoritative profile state; tools without profile require explicit selection; no technical identifiers are exposed; and focus returns to Tools.\n');
} finally {
  try { cdp?.close(); } catch {}
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (server && !server.killed) server.kill('SIGTERM');
}

import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5190';
const debugPort = '9233';
const appUrl = `http://127.0.0.1:${appPort}/pessoas`;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const viteCli = resolve(scriptsDirectory, '../../../node_modules/vite/bin/vite.js');
const fixturePath = resolve(scriptsDirectory, '../../../packages/application/fixtures/hourglass-export.sanitized.json');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const fixtureText = await readFile(fixturePath, 'utf8');

const wait = milliseconds => new Promise(done => setTimeout(done, milliseconds));
async function poll(operation, label) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { const value = await operation(); if (value) return value; } catch (error) { lastError = error; }
    await wait(150);
  }
  throw new Error(`${label}: ${String(lastError ?? 'timed out')}`);
}
function connectCdp(url) {
  const socket = new WebSocket(url); const pending = new Map(); const listeners = new Map(); let nextId = 1;
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const done = pending.get(message.id);
      if (done) { pending.delete(message.id); done(message); }
      return;
    }
    for (const listener of listeners.get(message.method) ?? []) listener(message.params);
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({
      send(method, params = {}) { const id = nextId++; socket.send(JSON.stringify({ id, method, params })); return new Promise((done, fail) => pending.set(id, response => response.error ? fail(new Error(response.error.message)) : done(response.result))); },
      once(method) {
        return new Promise(done => {
          const handler = params => { listeners.get(method)?.delete(handler); done(params); };
          const set = listeners.get(method) ?? new Set();
          set.add(handler); listeners.set(method, set);
        });
      },
      close() { socket.close(); },
    }));
    socket.addEventListener('error', reject, { once: true });
  });
}

let server; let browser; let cdp;
const temporaryFiles = [];
async function evaluate(expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function createFixtureFile(name, contents) {
  const path = `/tmp/eutaktos-hourglass-${process.pid}-${name}`;
  await writeFile(path, contents);
  temporaryFiles.push(path);
  return path;
}
async function chooseFile(path) {
  const button = await evaluate(`(() => {
    const node = [...document.querySelectorAll('[role="dialog"] button')].find(item => item.textContent?.trim() === 'Escolher ficheiro' && !item.disabled);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!button) throw new Error('O botão acessível Escolher ficheiro não ficou disponível');
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: button.x, y: button.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: button.x, y: button.y, button: 'left', clickCount: 1 });
  const documentRoot = await cdp.send('DOM.getDocument');
  const node = await cdp.send('DOM.querySelector', { nodeId: documentRoot.root.nodeId, selector: '#hourglass-import-file' });
  if (!node.nodeId) throw new Error('O input Hourglass associado ao botão não foi encontrado');
  await cdp.send('DOM.setFileInputFiles', { files: [path], nodeId: node.nodeId });
}
async function clickTopModalButton(label) {
  return await poll(async () => await evaluate(`(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(node => getComputedStyle(node).visibility !== 'hidden');
    const dialog = dialogs.at(-1);
    const button = [...(dialog?.querySelectorAll('button') ?? [])].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled);
    if (!button) return false; button.click(); return true;
  })()`), `O botão de confirmação ${label} não ficou disponível`);
}
async function chooseSource(label) {
  const clicked = await evaluate(`(() => {
    const node = [...document.querySelectorAll('[role="dialog"] label, [role="dialog"] .ant-segmented-item')].find(item => item.textContent?.trim() === ${JSON.stringify(label)});
    if (!node) return false; node.click(); return true;
  })()`);
  if (!clicked) throw new Error(`A origem Hourglass ${label} não foi encontrada`);
  await wait(100);
}
async function clickButton(label) {
  return await poll(async () => await evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)} && !node.disabled);
    if (!button) return false; button.click(); return true;
  })()`), `O botão ${label} não ficou disponível`);
}

try {
  server = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', appPort, '--strictPort'], { stdio: 'ignore' });
  await poll(async () => (await fetch(appUrl)).ok, 'O servidor de desenvolvimento não iniciou');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-hourglass-ux-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => { const targets = await (await fetch(`${debugUrl}/json`)).json(); return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl)); }, 'O Chromium não abriu a área de Pessoas');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Page.setInterceptFileChooserDialog', { enabled: true });

  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Diretório'))`), 'O acesso ao diretório não foi apresentado');
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Diretório')?.click()`);
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Ferramentas'))`), 'A entrada Ferramentas não foi apresentada');
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Ferramentas')?.click()`);
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="menuitem"], .ant-dropdown-menu-item')].find(item => item.textContent?.includes('Inspecionar export Hourglass')))`), 'A entrada Hourglass não foi apresentada no menu Ferramentas');
  await evaluate(`[...document.querySelectorAll('[role="menuitem"], .ant-dropdown-menu-item')].find(item => item.textContent?.includes('Inspecionar export Hourglass'))?.click()`);
  await poll(async () => await evaluate(`Boolean(document.querySelector('[role="dialog"]')?.textContent?.includes('Inspeção de export Hourglass'))`), 'O diálogo Hourglass não abriu');
  const fileControl = await evaluate(`(() => {
    const input = document.querySelector('#hourglass-import-file');
    const label = document.querySelector('label[for="hourglass-import-file"]');
    const button = [...document.querySelectorAll('[role="dialog"] button')].find(node => node.textContent?.trim() === 'Escolher ficheiro');
    const style = input ? getComputedStyle(input) : null;
    return Boolean(input && label && button && button.getAttribute('aria-controls') === input.id && input.getAttribute('aria-describedby') === 'hourglass-import-file-help' && style?.display !== 'none' && style?.visibility !== 'hidden');
  })()`);
  if (!fileControl) throw new Error('O seletor Hourglass não expõe associação semântica e controlo acessível de ficheiro');

  await evaluate(`(() => {
    window.__hourglassRequests = { preview: 0, prepare: 0, execute: 0, rollback: 0 };
    const original = window.fetch.bind(window);
    const preview = {
      matchingPolicy: 'tenant-scoped-external-id-only',
      counts: { create: 1, unchanged: 0, conflict: 0 },
      report: { format: 'hourglass-json-export-v1', publisherCount: 1, groupCount: 0, explicitPrivilegeCount: 1, unknownTopLevelSections: [], unknownPublisherFields: [], unknownGroupFields: [], recognizedSections: ['publishers', 'fsGroups', 'privileges'] },
      persons: [{ displayName: 'Pessoa Nova QA', action: 'create', linked: false, reasonCodes: [], explicitAssignmentTypeIds: ['hourglass:reader'] }],
    };
    const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const pathname = new URL(url, location.origin).pathname;
      const request = JSON.parse(String(init?.body ?? '{}'));
      if (pathname === '/api/import/hourglass/preview') {
        window.__hourglassRequests.preview += 1;
        if (request.source !== 'json' || !request.payload || Array.isArray(request.payload)) return new Response('{}', { status: 400 });
        return json(preview);
      }
      if (pathname === '/api/import/hourglass/prepare') {
        window.__hourglassRequests.prepare += 1;
        if (request.source !== 'json' || !request.payload || !/^hourglass-ui-/.test(request.mutationId ?? '')) return new Response('{}', { status: 400 });
        return json({ contractVersion: 'hourglass-execution-prepare-v1', executionId: 'hourglass-execution-0123456789abcdef0123456789abcdef', expiresAt: '2032-06-10T12:00:00.000Z', confirmationDigest: 'a'.repeat(64), counts: preview.counts, canExecute: true, preview });
      }
      if (pathname === '/api/import/hourglass/execute') {
        window.__hourglassRequests.execute += 1;
        if (request.source !== 'json' || request.executionId !== 'hourglass-execution-0123456789abcdef0123456789abcdef' || request.confirmationDigest !== 'a'.repeat(64)) return new Response('{}', { status: 400 });
        return json({ contractVersion: 'hourglass-execution-result-v1', outcome: 'applied', migrationId: 'hourglass-migration-0123456789abcdef0123456789abcdef', createdCount: 1, unchangedCount: 0 });
      }
      if (pathname === '/api/import/hourglass/rollback') {
        window.__hourglassRequests.rollback += 1;
        if (request.migrationId !== 'hourglass-migration-0123456789abcdef0123456789abcdef') return new Response('{}', { status: 400 });
        return json({ contractVersion: 'hourglass-rollback-result-v1', outcome: 'rolled-back', migrationId: request.migrationId, removedCount: 1 });
      }
      return original(input, init);
    };
  })()`);

  const storageBefore = await evaluate(`JSON.stringify(Object.entries(localStorage).sort())`);
  const validFixturePath = await createFixtureFile('hourglass-export.sanitized.json', fixtureText);
  const invalidFixturePath = await createFixtureFile('invalid-hourglass.json', '{');
  const oversizedFixturePath = await createFixtureFile('too-large.json', 'x'.repeat(5_000_001));
  const contactsFixturePath = await createFixtureFile('hourglass-contact-list.csv', 'lastname,firstname,address_id\nExemplo,Ana,ADDR-1\n');
  const privilegesFixturePath = await createFixtureFile('hourglass-privileges.csv', 'lastname,firstname,middlename,suffix,fullname,Oração\nExemplo,Ana,,,Ana Exemplo,X\n');
  await chooseFile(validFixturePath);
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Publicadores encontrados') && document.querySelector('[role="dialog"]')?.textContent?.includes('Export JSON Hourglass')`), 'A inspeção JSON sanitizada não foi apresentada');
  const beforeCompare = await evaluate(`window.__hourglassRequests.preview`);
  if (beforeCompare !== 0) throw new Error('A inspeção local enviou Hourglass ao servidor sem confirmação explícita');
  await clickButton('Comparar com Eutaktos');
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Prévia de reconciliação') && document.querySelector('[role="dialog"]')?.textContent?.includes('Pessoa Nova QA') && document.querySelector('[role="dialog"]')?.textContent?.includes('Prévia apenas')`), 'A prévia servidor não apresentou contagens e salvaguardas localizadas');
  const jsonResult = await evaluate(`({ body: document.body.textContent ?? '', storage: JSON.stringify(Object.entries(localStorage).sort()), requests: window.__hourglassRequests.preview })`);
  if (jsonResult.requests !== 1) throw new Error(`A comparação explícita deveria gerar exatamente um request, recebeu ${jsonResult.requests}`);
  if (jsonResult.storage !== storageBefore || jsonResult.body.includes('ignored@example.invalid')) throw new Error('A prévia Hourglass persistiu ou apresentou conteúdo sanitizado que deve permanecer oculto');
  if (jsonResult.body.includes('hourglass:publisher:') || jsonResult.body.includes('person-1') || jsonResult.body.includes('tenant-')) throw new Error('A prévia expôs identificadores técnicos');
  if (!jsonResult.body.includes('Nomes nunca são usados para associar ou deduplicar pessoas')) throw new Error('A política de correspondência externa não foi explicada');

  await clickButton('Preparar importação');
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('A confirmação foi vinculada a esta prévia pelo servidor.')`), 'A preparação Hourglass não apresentou a confirmação vinculada à prévia');
  await clickButton('Confirmar e importar');
  await poll(async () => await evaluate(`document.querySelectorAll('[role="dialog"]').length >= 2 && document.body.textContent?.includes('Esta ação cria os registos indicados na prévia')`), 'A confirmação explícita de importação não abriu');
  await clickTopModalButton('Confirmar e importar');
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Importação aplicada com sucesso.')`), 'A execução Hourglass não apresentou sucesso autoritativo');
  const executionRequests = await evaluate(`window.__hourglassRequests`);
  if (executionRequests.preview !== 1 || executionRequests.prepare !== 1 || executionRequests.execute !== 1 || executionRequests.rollback !== 0) throw new Error(`A sequência Hourglass antes do rollback não respeitou o protocolo: ${JSON.stringify(executionRequests)}`);
  await clickButton('Reverter importação');
  await poll(async () => await evaluate(`document.querySelectorAll('[role="dialog"]').length >= 2 && document.body.textContent?.includes('Esta ação remove apenas os registos criados')`), 'A confirmação explícita de rollback não abriu');
  await clickTopModalButton('Reverter importação');
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Importação revertida com sucesso.')`), 'O rollback create-only não apresentou sucesso autoritativo');
  const lifecycleRequests = await evaluate(`window.__hourglassRequests`);
  if (lifecycleRequests.preview !== 1 || lifecycleRequests.prepare !== 1 || lifecycleRequests.execute !== 1 || lifecycleRequests.rollback !== 1) throw new Error(`O ciclo Hourglass não respeitou preview, prepare, execute e rollback únicos: ${JSON.stringify(lifecycleRequests)}`);
  if (await evaluate(`document.body.textContent?.includes('hourglass-migration-') || document.body.textContent?.includes('hourglass-execution-')`)) throw new Error('O ciclo Hourglass expôs uma identidade técnica de execução ou migração');

  await clickButton('Remover seleção');
  if (await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('hourglass-export.sanitized.json')`)) throw new Error('A remoção de seleção Hourglass não limpou o nome do ficheiro da interface');
  await chooseFile(invalidFixturePath);
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('não corresponde ao formato escolhido')`), 'O JSON inválido não apresentou erro seguro');
  const invalidBody = await evaluate(`document.querySelector('[role="dialog"]')?.textContent ?? ''`);
  if (invalidBody.includes('{')) throw new Error('O erro de JSON expôs o conteúdo inválido');

  await chooseFile(oversizedFixturePath);
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('excede o limite de segurança de 5 MB')`), 'O ficheiro demasiado grande não foi recusado');

  await chooseSource('Contact list CSV');
  await chooseFile(contactsFixturePath);
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Contact list CSV') && document.querySelector('[role="dialog"]')?.textContent?.includes('não tem um ID de publicador estável comprovado')`), 'O CSV de contactos não apresentou a limitação de reconciliação');
  if (await evaluate(`window.__hourglassRequests.preview`) !== 1) throw new Error('O CSV de contactos foi enviado ao endpoint de reconciliação');

  await chooseSource('Matriz CSV de privilégios');
  await chooseFile(privilegesFixturePath);
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Matriz CSV de privilégios') && document.querySelector('[role="dialog"]')?.textContent?.includes('Nenhuma elegibilidade será criada')`), 'O CSV de privilégios não apresentou a limitação de reconciliação');
  if (await evaluate(`window.__hourglassRequests.preview`) !== 1) throw new Error('O CSV de privilégios foi enviado ao endpoint de reconciliação');

  const storageAfter = await evaluate(`JSON.stringify(Object.entries(localStorage).sort())`);
  if (storageAfter !== storageBefore) throw new Error('A inspeção Hourglass persistiu dados no armazenamento do browser');
  await clickButton('Fechar');
  await poll(async () => await evaluate(`!document.querySelector('[role="dialog"]')`), 'O diálogo Hourglass não fechou');
  process.stdout.write('Hourglass inspector checks passed: accessible real-file chooser, explicit JSON-only preview, prepared confirmation, controlled execute and create-only rollback, no CSV reconciliation, local-storage privacy and safe errors.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (server && !server.killed) server.kill('SIGTERM');
  await Promise.all(temporaryFiles.map(path => rm(path, { force: true })));
}

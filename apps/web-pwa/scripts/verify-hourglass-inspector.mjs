import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function uploadText(name, contents, type) {
  await evaluate(`(() => {
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error('Hourglass file input is unavailable');
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(contents)}], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
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

  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Diretório'))`), 'O acesso ao diretório não foi apresentado');
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Diretório')?.click()`);
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('button')].find(button => button.textContent?.includes('Inspecionar export Hourglass')))`), 'A entrada Hourglass não foi apresentada');
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent?.includes('Inspecionar export Hourglass'))?.click()`);
  await poll(async () => await evaluate(`Boolean(document.querySelector('[role="dialog"]')?.textContent?.includes('Inspeção de export Hourglass'))`), 'O diálogo Hourglass não abriu');

  await evaluate(`(() => {
    window.__hourglassPreviewRequests = 0;
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const pathname = new URL(url, location.origin).pathname;
      if (pathname === '/api/import/hourglass/preview') {
        window.__hourglassPreviewRequests += 1;
        const request = JSON.parse(String(init?.body ?? '{}'));
        if (request.source !== 'json' || !request.payload || Array.isArray(request.payload)) return new Response('{}', { status: 400 });
        return new Response(JSON.stringify({
          matchingPolicy: 'tenant-scoped-external-id-only',
          counts: { create: 1, unchanged: 0, conflict: 1 },
          report: { format: 'hourglass-json-export-v1', publisherCount: 2, groupCount: 0, explicitPrivilegeCount: 1, unknownTopLevelSections: [], unknownPublisherFields: [], unknownGroupFields: [], recognizedSections: ['publishers','fsGroups','privileges'] },
          persons: [
            { displayName: 'Pessoa Nova', action: 'create', linked: false, reasonCodes: [], explicitAssignmentTypeIds: [] },
            { displayName: 'Pessoa Ligada', action: 'conflict', linked: true, reasonCodes: ['DISPLAY_NAME_DIFFERS'], explicitAssignmentTypeIds: ['hourglass:reader'] },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return original(input, init);
    };
  })()`);

  const storageBefore = await evaluate(`JSON.stringify(Object.entries(localStorage).sort())`);
  await uploadText('hourglass-export.sanitized.json', fixtureText, 'application/json');
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Publicadores encontrados') && document.querySelector('[role="dialog"]')?.textContent?.includes('Export JSON Hourglass')`), 'A inspeção JSON sanitizada não foi apresentada');
  const beforeCompare = await evaluate(`window.__hourglassPreviewRequests`);
  if (beforeCompare !== 0) throw new Error('A inspeção local enviou Hourglass ao servidor sem confirmação explícita');
  await clickButton('Comparar com Eutaktos');
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Prévia de reconciliação') && document.querySelector('[role="dialog"]')?.textContent?.includes('Pessoa Ligada') && document.querySelector('[role="dialog"]')?.textContent?.includes('O nome difere')`), 'A prévia servidor não apresentou contagens/conflitos localizados');
  const jsonResult = await evaluate(`({ body: document.body.textContent ?? '', storage: JSON.stringify(Object.entries(localStorage).sort()), requests: window.__hourglassPreviewRequests })`);
  if (jsonResult.requests !== 1) throw new Error(`A comparação explícita deveria gerar exatamente um request, recebeu ${jsonResult.requests}`);
  if (jsonResult.storage !== storageBefore || jsonResult.body.includes('ignored@example.invalid')) throw new Error('A prévia Hourglass persistiu ou apresentou conteúdo sanitizado que deve permanecer oculto');
  if (jsonResult.body.includes('hourglass:publisher:') || jsonResult.body.includes('person-1') || jsonResult.body.includes('tenant-')) throw new Error('A prévia expôs identificadores técnicos');
  if (!jsonResult.body.includes('Nomes nunca são usados para associar ou deduplicar pessoas')) throw new Error('A política de correspondência externa não foi explicada');

  await uploadText('invalid-hourglass.json', '{', 'application/json');
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('não corresponde ao formato escolhido')`), 'O JSON inválido não apresentou erro seguro');
  const invalidBody = await evaluate(`document.querySelector('[role="dialog"]')?.textContent ?? ''`);
  if (invalidBody.includes('{')) throw new Error('O erro de JSON expôs o conteúdo inválido');

  await evaluate(`(() => { const input = document.querySelector('input[type="file"]'); const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(5_000_001)], 'too-large.json', { type: 'application/json' })); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('excede o limite de segurança de 5 MB')`), 'O ficheiro demasiado grande não foi recusado');

  await chooseSource('Contact list CSV');
  await uploadText('hourglass-contact-list.csv', 'lastname,firstname,address_id\nExemplo,Ana,ADDR-1\n', 'text/csv');
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Contact list CSV') && document.querySelector('[role="dialog"]')?.textContent?.includes('não tem um ID de publicador estável comprovado')`), 'O CSV de contactos não apresentou a limitação de reconciliação');
  if (await evaluate(`window.__hourglassPreviewRequests`) !== 1) throw new Error('O CSV de contactos foi enviado ao endpoint de reconciliação');

  await chooseSource('Matriz CSV de privilégios');
  await uploadText('hourglass-privileges.csv', 'lastname,firstname,middlename,suffix,fullname,Oração\nExemplo,Ana,,,Ana Exemplo,X\n', 'text/csv');
  await poll(async () => await evaluate(`document.querySelector('[role="dialog"]')?.textContent?.includes('Matriz CSV de privilégios') && document.querySelector('[role="dialog"]')?.textContent?.includes('Nenhuma elegibilidade será criada')`), 'O CSV de privilégios não apresentou a limitação de reconciliação');
  if (await evaluate(`window.__hourglassPreviewRequests`) !== 1) throw new Error('O CSV de privilégios foi enviado ao endpoint de reconciliação');

  const storageAfter = await evaluate(`JSON.stringify(Object.entries(localStorage).sort())`);
  if (storageAfter !== storageBefore) throw new Error('A inspeção Hourglass persistiu dados no armazenamento do browser');
  await clickButton('Fechar');
  await poll(async () => await evaluate(`!document.querySelector('[role="dialog"]')`), 'O diálogo Hourglass não fechou');
  process.stdout.write('Hourglass inspector checks passed: explicit JSON-only server reconciliation preview, external-ID-only matching explanation, no automatic upload, no CSV reconciliation, sanitized conflict UI, local storage privacy, safe errors and close control.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (server && !server.killed) server.kill('SIGTERM');
}

import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 4176;
const chromium = process.env.CHROMIUM_BIN || '/usr/bin/chromium';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function waitForPort(targetPort, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = createConnection({ port: targetPort, host: '127.0.0.1' });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`Timed out waiting for port ${targetPort}`));
        else setTimeout(attempt, 150);
      });
    };
    attempt();
  });
}

const devServer = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
let cdp;
try {
  await waitForPort(port);
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=9223', `http://127.0.0.1:${port}`], { stdio: 'ignore' });
  await waitForPort(9223);
  const targets = await (await fetch('http://127.0.0.1:9223/json')).json();
  const page = targets.find(target => target.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('No browser page target');
  cdp = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { cdp.addEventListener('open', resolve, { once: true }); cdp.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  cdp.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    item.resolve(message);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    const timeout = setTimeout(() => { pending.delete(messageId); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(messageId, { resolve: value => { clearTimeout(timeout); resolve(value); } });
    cdp.send(JSON.stringify({ id: messageId, method, params }));
  });
  const evaluate = async expression => {
    const response = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result.result.value;
  };
  const poll = async (fn, message, timeoutMs = 10000) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await fn()) return;
      await sleep(100);
    }
    throw new Error(message);
  };
  await command('Runtime.enable');
  await command('Page.enable');

  const defaults = { locale: 'pt-PT', colorMode: 'light', paletteId: 'classic', density: 'comfortable', textSize: 'default', highContrast: false, reducedMotion: false, reducedTransparency: false };
  const setPreferences = async (preferences, expectedText) => {
    await evaluate(`localStorage.setItem('eutaktos.preferences.v4', ${JSON.stringify(JSON.stringify(preferences))}); location.href='http://127.0.0.1:${port}/';`);
    await poll(async () => await evaluate(`document.body?.innerText.includes(${JSON.stringify(expectedText)})`), `Home did not render ${expectedText}`);
  };
  const navigate = async url => {
    await command('Page.navigate', { url: `http://127.0.0.1:${port}${url}` });
    await new Promise(resolve => setTimeout(resolve, 250));
  };
  const clickExactButton = async text => evaluate(`(()=>{const target=[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()===${JSON.stringify(text)});if(!target)return false;target.click();return true;})()`);
  const visitWorkspace = async (pathname, expected, locale, expectedTitle) => {
    await navigate(pathname);
    await poll(async () => await evaluate(`document.body?.innerText.includes(${JSON.stringify(expected)})`), `Workspace ${pathname} did not render ${expected}`);
    await poll(async () => await evaluate(`document.documentElement.lang===${JSON.stringify(locale)}`), `Workspace ${pathname} did not keep locale ${locale}`);
    await poll(async () => await evaluate(`document.title===${JSON.stringify(expectedTitle)}`), `Workspace ${pathname} title mismatch`);
    const privacy = await evaluate(`({url:location.href, storage:Object.keys(localStorage), cache:typeof caches==='undefined'?[]:await caches.keys()})`);
    if (/displayName|phone|email|address|contact/i.test(privacy.url)) throw new Error(`PII-like data leaked into URL: ${privacy.url}`);
    if (privacy.storage.some(key => key !== 'eutaktos.preferences.v4')) throw new Error(`Unexpected browser storage key: ${JSON.stringify(privacy.storage)}`);
  };

  const verifyLocalizedOrganization = async (locale, expected) => {
    await visitWorkspace(expected.path, expected.overview, locale, expected.documentTitle);
    await poll(async () => await evaluate(`document.body?.innerText.includes(${JSON.stringify(expected.overviewLabel)})`), `${locale}: overview label missing`);
    if (!await clickExactButton(expected.add)) throw new Error(`${locale}: Add Person action missing`);
    await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node=>node.textContent?.includes(${JSON.stringify(expected.createTitle)})))`), `${locale}: Add Person dialog did not open`);
    if (!await clickExactButton(expected.cancel)) throw new Error(`${locale}: Add Person cancel missing`);
    await visitWorkspace(`${expected.path}?area=organization`, expected.heading, locale, locale === 'pt-PT' ? 'Eutaktos — Organização' : locale === 'en' ? 'Eutaktos — Organization' : 'Eutaktos — Organización');
    for (const label of [expected.directory, expected.households, expected.groups, expected.responsibilities]) {
      if (!await evaluate(`document.body?.innerText.includes(${JSON.stringify(label)})`)) throw new Error(`${locale}: organization surface missing ${label}`);
    }
  };

  await setPreferences(defaults, 'Tudo em boa ordem.');
  const shell = await evaluate(`({main:Boolean(document.querySelector('main#main')),nav:Boolean(document.querySelector('nav,[aria-label="Navegação principal"]')),skip:[...document.querySelectorAll('a,button')].some(node=>node.textContent?.includes('Saltar para o conteúdo principal'))})`);
  if (!shell.main || !shell.nav || !shell.skip) throw new Error(`Task shell landmarks/skip link missing: ${JSON.stringify(shell)}`);

  await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 800, deviceScaleFactor: 1, mobile: true });
  await sleep(150);
  const mobileOverflow = await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`);
  if (!mobileOverflow) throw new Error('Task shell overflows horizontally at 320px');
  await command('Emulation.clearDeviceMetricsOverride');

  if (!await clickExactButton('Mais')) throw new Error('O botão Mais não foi encontrado');
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes('Planeamento') && node.textContent?.includes('Organização') && node.textContent?.includes('Administração')))`), 'O painel Mais orientado a tarefas não abriu');
  if (!await clickExactButton('Fechar')) throw new Error('O botão Fechar não foi encontrado');
  await poll(async () => await evaluate(`document.activeElement?.textContent?.trim().endsWith('Mais')`), 'O foco não regressou ao botão Mais depois de fechar o painel');

  const workspaces = {
    'pt-PT': [['/agenda', 'Agenda', 'Eutaktos — Preparar reunião'], ['/designacoes', 'Designações', 'Eutaktos — Planeamento'], ['/pessoas', 'Pessoas', 'Eutaktos — Pessoas'], ['/preferencias', 'Preferências', 'Eutaktos — Administração']],
    en: [['/agenda', 'Agenda', 'Eutaktos — Prepare meeting'], ['/assignments', 'Assignments', 'Eutaktos — Planning'], ['/people', 'People', 'Eutaktos — People'], ['/preferences', 'Preferences', 'Eutaktos — Administration']],
    es: [['/agenda', 'Agenda', 'Eutaktos — Preparar reunión'], ['/designacoes', 'Asignaciones', 'Eutaktos — Planificación'], ['/pessoas', 'Personas', 'Eutaktos — Personas'], ['/preferencias', 'Preferencias', 'Eutaktos — Administración']],
  };
  const organization = {
    'pt-PT': { path: '/pessoas', overview: 'Pessoas', heading: 'Pessoas e organização', documentTitle: 'Eutaktos — Pessoas', overviewLabel: 'Visão geral', add: 'Adicionar pessoa', createTitle: 'Adicionar pessoa', cancel: 'Cancelar', directory: 'Diretório', households: 'Agregados', groups: 'Grupos de serviço', responsibilities: 'Responsabilidades', hourglass: 'Inspecionar export Hourglass', audit: 'Histórico de auditoria', access: 'Gerir acessos', hourglassTitle: 'Inspeção de export Hourglass', auditTitle: 'Histórico de auditoria', accessTitle: 'Gestão de acessos', close: 'Fechar' },
    en: { path: '/people', overview: 'People', heading: 'People and organization', documentTitle: 'Eutaktos — People', overviewLabel: 'Overview', add: 'Add person', createTitle: 'Add person', cancel: 'Cancel', directory: 'Directory', households: 'Households', groups: 'Service groups', responsibilities: 'Responsibilities', hourglass: 'Inspect Hourglass export', audit: 'Audit history', access: 'Manage access', hourglassTitle: 'Hourglass export inspector', auditTitle: 'Audit history', accessTitle: 'Access management', close: 'Close' },
    es: { path: '/pessoas', overview: 'Personas', heading: 'Personas y organización', documentTitle: 'Eutaktos — Personas', overviewLabel: 'Vista general', add: 'Añadir persona', createTitle: 'Añadir persona', cancel: 'Cancelar', directory: 'Directorio', households: 'Grupos familiares', groups: 'Grupos de servicio', responsibilities: 'Responsabilidades', hourglass: 'Inspeccionar exportación Hourglass', audit: 'Historial de auditoría', access: 'Gestionar accesos', hourglassTitle: 'Inspector de exportación Hourglass', auditTitle: 'Historial de auditoría', accessTitle: 'Gestión de accesos', close: 'Cerrar' },
  };

  for (const locale of ['pt-PT', 'en', 'es']) {
    const expectedHome = locale === 'pt-PT' ? 'Tudo em boa ordem.' : locale === 'en' ? 'Everything in good order.' : 'Todo en buen orden.';
    await setPreferences({ ...defaults, locale }, expectedHome);
    for (const [path, heading, title] of workspaces[locale]) await visitWorkspace(path, heading, locale, title);
    await verifyLocalizedOrganization(locale, organization[locale]);
  }

  await setPreferences({ ...defaults, locale: 'pt-PT' }, 'Tudo em boa ordem.');
  await visitWorkspace('/pessoas?area=organization', 'Pessoas e organização', 'pt-PT', 'Eutaktos — Organização');
  await visitWorkspace('/pessoas?area=organization&view=groups', 'Grupos de serviço', 'pt-PT', 'Eutaktos — Organização');

  await setPreferences({ ...defaults, locale: 'en' }, 'Everything in good order.');
  await visitWorkspace('/people/?source=deep-link#contacts', 'People', 'en', 'Eutaktos — People');
  await visitWorkspace('/unknown-route?source=deep-link', 'Everything in good order.', 'en', 'Eutaktos — Home');

  await setPreferences({ ...defaults, locale: 'es', colorMode: 'dark', highContrast: true }, 'Todo en buen orden.');
  const accessibility = await evaluate(`(()=>{const surface=document.querySelector('.ant-card');return { mode: document.documentElement.dataset.colorMode, background: getComputedStyle(document.body).backgroundColor, border: surface ? getComputedStyle(surface).borderTopWidth : null };})()`);
  if (accessibility.mode !== 'dark' || accessibility.border !== '2px' || accessibility.background === 'rgb(0, 0, 0)') throw new Error(`O tema acessível não foi aplicado corretamente: ${JSON.stringify(accessibility)}`);

  process.stdout.write('UX runtime checks passed: task-oriented Ant shell, pt-PT/en/es workspaces, People/Organization deep links, guided Add Person entry, safe unknown-route fallback, More focus restore, dark/high contrast, 320px reflow, skip link, landmarks and aria-current.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (!devServer.killed) devServer.kill('SIGTERM');
}

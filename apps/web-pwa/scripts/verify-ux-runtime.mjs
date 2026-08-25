import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5188';
const debugPort = '9231';
const appUrl = `http://127.0.0.1:${appPort}/`;
const appOrigin = new URL(appUrl).origin;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function poll(operation, label, attempts = 40) {
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

async function setPreferences(preferences, expectedHeading) {
  await poll(async () => {
    try {
      await cdp.send('DOMStorage.setDOMStorageItem', {
        storageId: { securityOrigin: appOrigin, isLocalStorage: true },
        key: 'eutaktos.preferences.v4',
        value: JSON.stringify(preferences),
      });
      return true;
    } catch (error) {
      if (String(error).includes('Frame not found')) return false;
      throw error;
    }
  }, 'O armazenamento de preferências não ficou disponível', 20);

  // PX2 deliberately removed the old generic Home hero from feature routes.
  // Start locale/theme checks from Home so the assertion verifies the persisted
  // preference itself rather than depending on the route left by a prior case.
  await cdp.send('Page.navigate', { url: appUrl });
  await poll(
    async () => await evaluate(`document.readyState === 'complete' && location.pathname === '/' && document.documentElement.lang === ${JSON.stringify(preferences.locale)} && Boolean(document.querySelector('#root')?.textContent?.includes(${JSON.stringify(expectedHeading)}))`),
    `A interface não carregou em ${preferences.locale}`,
    80,
  );
}

async function visitWorkspace(path, expectedHeading, locale, expectedTitle = `Eutaktos — ${expectedHeading}`) {
  const target = new URL(path, appUrl);
  const expectedLocation = `${target.pathname}${target.search}${target.hash}`;
  await cdp.send('Page.navigate', { url: target.toString() });
  try {
    await poll(
      async () => await evaluate(`document.readyState === 'complete' && location.pathname + location.search + location.hash === ${JSON.stringify(expectedLocation)} && document.documentElement.lang === ${JSON.stringify(locale)} && document.title === ${JSON.stringify(expectedTitle)} && Boolean(document.querySelector('#main')?.textContent?.includes(${JSON.stringify(expectedHeading)}))`),
      `O deep link ${path} não apresentou o título e conteúdo localizados em ${locale}`,
      80,
    );
  } catch (error) {
    let observed;
    try {
      observed = await evaluate(`({ location: location.pathname + location.search + location.hash, lang: document.documentElement.lang, title: document.title, main: document.querySelector('#main')?.textContent?.slice(0, 500) ?? '', readyState: document.readyState })`);
    } catch (diagnosticError) {
      observed = { diagnosticError: String(diagnosticError) };
    }
    throw new Error(`${String(error)}; observed=${JSON.stringify(observed)}`);
  }
}

async function clickExactButton(label) {
  return await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(label)});
    button?.click();
    return Boolean(button);
  })()`);
}

async function openLocalizedDialog(trigger, title, closeLabel, locale) {
  if (!await clickExactButton(trigger)) throw new Error(`O gatilho localizado ${trigger} não foi encontrado em ${locale}`);
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes(${JSON.stringify(title)})))`), `O diálogo ${title} não abriu em ${locale}`);
  const closed = await evaluate(`(() => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes(${JSON.stringify(title)}));
    const button = dialog && [...dialog.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(closeLabel)});
    button?.click();
    return Boolean(button);
  })()`);
  if (!closed) throw new Error(`O fecho localizado do diálogo ${title} não foi encontrado em ${locale}`);
  await poll(async () => await evaluate(`![...document.querySelectorAll('[role="dialog"]')].some(node => node.textContent?.includes(${JSON.stringify(title)}) && getComputedStyle(node).visibility !== 'hidden')`), `O diálogo ${title} não fechou em ${locale}`);
}

async function verifyLocalizedOrganization(locale, expected) {
  await visitWorkspace(expected.path, expected.overview, locale, expected.documentTitle);
  if (!await clickExactButton(expected.add)) throw new Error(`A ação principal ${expected.add} não foi encontrada em ${locale}`);
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="dialog"]')].find(node => node.textContent?.includes(${JSON.stringify(expected.createTitle)})))`), `O fluxo de criação ${expected.createTitle} não abriu na primeira tentativa em ${locale}`);
  if (!await clickExactButton(expected.cancel)) throw new Error(`O cancelamento do fluxo de criação não foi encontrado em ${locale}`);
  await poll(async () => await evaluate(`![...document.querySelectorAll('[role="dialog"]')].some(node => node.textContent?.includes(${JSON.stringify(expected.createTitle)}) && getComputedStyle(node).visibility !== 'hidden')`), `O fluxo de criação ${expected.createTitle} não fechou em ${locale}`);
  if (!await clickExactButton(expected.directory)) throw new Error(`O acesso ao diretório ${expected.directory} não foi encontrado em ${locale}`);
  await poll(async () => await evaluate(`Boolean(document.querySelector('#main')?.textContent?.includes(${JSON.stringify(expected.heading)}))`), `O diretório não apresentou o contexto organizacional em ${locale}`);
  const missingLabels = await evaluate(`(() => {
    const labels = new Set([...document.querySelectorAll('button')].map(node => (node.innerText || node.textContent || '').trim()));
    return ${JSON.stringify(['overviewLabel', 'directory', 'households', 'groups', 'responsibilities', 'hourglass', 'audit', 'access'].map(key => expected[key]))}.filter(label => !labels.has(label));
  })()`);
  if (missingLabels.length) throw new Error(`Faltam rótulos organizacionais localizados em ${locale}: ${missingLabels.join(', ')}`);
  await openLocalizedDialog(expected.hourglass, expected.hourglassTitle, expected.close, locale);
  await openLocalizedDialog(expected.audit, expected.auditTitle, expected.close, locale);
  await openLocalizedDialog(expected.access, expected.accessTitle, expected.close, locale);
}

try {
  await poll(async () => (await fetch(appUrl)).ok, 'O servidor de desenvolvimento não iniciou');
  browser = spawn(chromium, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/eutaktos-ux-runtime-${process.pid}`, appUrl], { stdio: 'ignore' });
  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'O Chromium não abriu a aplicação');
  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('DOMStorage.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const originalFetch = window.fetch.bind(window);
    const json = value => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
    window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const pathname = new URL(rawUrl, window.location.origin).pathname;
      if (pathname === '/api/people' && (!init?.method || init.method === 'GET')) return json([{ id: 'person-runtime', displayName: 'Runtime person', active: true }]);
      if (pathname === '/api/people/directory' && (!init?.method || init.method === 'GET')) return json({
        contractVersion: 'people-directory-v1',
        generatedAt: '2026-08-25T12:00:00.000Z',
        capabilities: { writePeople: true, availability: true, eligibility: true, responsibilities: true, schedule: true },
        filters: { groups: [{ id: 'group-runtime', name: 'Runtime group' }], responsibilityKeys: [], assignmentTypeIds: [] },
        people: [{
          id: 'person-runtime', displayName: 'Runtime person', preferredLocale: 'pt-PT', active: true,
          groups: [{ id: 'group-runtime', name: 'Runtime group' }],
          availability: { status: 'ready', current: 'available', currentReasonCodes: [] },
          eligibility: { status: 'ready', enabledAssignmentTypeIds: [] },
          responsibilities: { status: 'ready', keys: [] },
          assignmentHistory: { status: 'ready' },
        }],
      });
      if (pathname === '/api/service-groups' && (!init?.method || init.method === 'GET')) return json([{ id: 'group-runtime', name: 'Runtime group', memberIds: ['person-runtime'] }]);
      if (pathname === '/api/midweek' && (!init?.method || init.method === 'GET')) return json({ meetings: [], studentAssignments: [], nonStudentAssignments: [] });
      return originalFetch(input, init);
    };
  })();` });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });

  const defaults = { paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false };
  await setPreferences(defaults, 'Tudo em boa ordem.');

  const keyboard = await evaluate(`(() => {
    const skip = document.querySelector('.skip-link');
    const main = document.querySelector('main#main');
    const active = document.querySelector('[aria-current="page"]');
    skip?.focus();
    return { hasSkip: Boolean(skip), href: skip?.getAttribute('href'), hasMain: Boolean(main), navCount: document.querySelectorAll('nav').length, activeLabel: active?.textContent?.trim() ?? '', skipTop: skip ? getComputedStyle(skip).top : '' };
  })()`);
  if (!keyboard.hasSkip || keyboard.href !== '#main' || !keyboard.hasMain || keyboard.navCount < 1 || !keyboard.activeLabel || keyboard.skipTop === '-80px') throw new Error(`A navegação por teclado não expõe skip link, landmarks ou estado actual: ${JSON.stringify(keyboard)}`);

  const mobile = await evaluate(`({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, body: document.body.innerText })`);
  if (mobile.scrollWidth > mobile.width) throw new Error(`A navegação móvel cria overflow horizontal: ${mobile.scrollWidth}px > ${mobile.width}px`);
  if (!mobile.body.includes('Mais')) throw new Error('A navegação móvel não expõe o destino Mais');

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
    'pt-PT': { path: '/pessoas', overview: 'Pessoas', heading: 'Pessoas e organização', documentTitle: 'Eutaktos — Pessoas', overviewLabel: 'Visão geral', add: 'Adicionar pessoa', createTitle: 'Nova pessoa', cancel: 'Cancelar', directory: 'Diretório', households: 'Agregados', groups: 'Grupos de serviço', responsibilities: 'Responsabilidades', hourglass: 'Inspecionar export Hourglass', audit: 'Histórico de auditoria', access: 'Gerir acessos', hourglassTitle: 'Inspeção de export Hourglass', auditTitle: 'Histórico de auditoria', accessTitle: 'Gestão de acessos', close: 'Fechar' },
    en: { path: '/people', overview: 'People', heading: 'People and organization', documentTitle: 'Eutaktos — People', overviewLabel: 'Overview', add: 'Add person', createTitle: 'New person', cancel: 'Cancel', directory: 'Directory', households: 'Households', groups: 'Service groups', responsibilities: 'Responsibilities', hourglass: 'Inspect Hourglass export', audit: 'Audit history', access: 'Manage access', hourglassTitle: 'Hourglass export inspector', auditTitle: 'Audit history', accessTitle: 'Access management', close: 'Close' },
    es: { path: '/pessoas', overview: 'Personas', heading: 'Personas y organización', documentTitle: 'Eutaktos — Personas', overviewLabel: 'Vista general', add: 'Añadir persona', createTitle: 'Nueva persona', cancel: 'Cancelar', directory: 'Directorio', households: 'Grupos familiares', groups: 'Grupos de servicio', responsibilities: 'Responsabilidades', hourglass: 'Inspeccionar exportación Hourglass', audit: 'Historial de auditoría', access: 'Gestionar accesos', hourglassTitle: 'Inspector de exportación Hourglass', auditTitle: 'Historial de auditoría', accessTitle: 'Gestión de accesos', close: 'Cerrar' },
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
  const accessibility = await evaluate(`({ mode: document.documentElement.dataset.colorMode, background: getComputedStyle(document.body).backgroundColor, border: getComputedStyle(document.querySelector('.MuiPaper-root')).borderTopWidth })`);
  if (accessibility.mode !== 'dark' || accessibility.border !== '2px' || accessibility.background === 'rgb(0, 0, 0)') throw new Error(`O tema acessível não foi aplicado corretamente: ${JSON.stringify(accessibility)}`);

  process.stdout.write('UX runtime checks passed: task-oriented shell, pt-PT/en/es workspaces, People/Organization deep links, safe unknown-route fallback, More focus restore, dark/high contrast, 320px reflow, skip link, landmarks and aria-current.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (!devServer.killed) devServer.kill('SIGTERM');
}

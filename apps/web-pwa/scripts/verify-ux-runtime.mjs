import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5188';
const debugPort = '9231';
const appUrl = `http://127.0.0.1:${appPort}/`;
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
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
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
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function setPreferences(preferences, expectedHeading) {
  await evaluate(`localStorage.setItem('eutaktos.preferences.v4', ${JSON.stringify(JSON.stringify(preferences))})`);
  await cdp.send('Page.reload', { ignoreCache: true });
  await poll(
    async () => await evaluate(`document.readyState === 'complete' && document.documentElement.lang === ${JSON.stringify(preferences.locale)} && Boolean(document.querySelector('#root')?.textContent?.includes(${JSON.stringify(expectedHeading)}))`),
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

async function openLocalizedDialog(trigger, title, closeLabel, locale) {
  const foundTrigger = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(node => (node.innerText || node.textContent || '').trim() === ${JSON.stringify(trigger)});
    button?.click();
    return Boolean(button);
  })()`);
  if (!foundTrigger) throw new Error(`O gatilho localizado ${trigger} não foi encontrado em ${locale}`);
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
  await visitWorkspace(expected.path, expected.heading, locale, expected.documentTitle);
  const missingLabels = await evaluate(`(() => {
    const labels = new Set([...document.querySelectorAll('button')].map(node => (node.innerText || node.textContent || '').trim()));
    return ${JSON.stringify(['people', 'households', 'groups', 'responsibilities', 'hourglass', 'audit', 'access'].map(key => expected[key]))}.filter(label => !labels.has(label));
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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });

  const defaults = { paletteId: 'classic', colorMode: 'light', density: 'comfortable', locale: 'pt-PT', textSize: 'default', reducedMotion: false, reducedTransparency: false, highContrast: false };
  await setPreferences(defaults, 'Tudo em boa ordem.');

  const keyboard = await evaluate(`(() => {
    const skip = document.querySelector('.skip-link');
    const main = document.querySelector('main#main');
    const active = document.querySelector('[aria-current="page"]');
    skip?.focus();
    return {
      hasSkip: Boolean(skip),
      href: skip?.getAttribute('href'),
      hasMain: Boolean(main),
      navCount: document.querySelectorAll('nav').length,
      activeLabel: active?.textContent?.trim() ?? '',
      skipTop: skip ? getComputedStyle(skip).top : '',
    };
  })()`);
  if (!keyboard.hasSkip || keyboard.href !== '#main' || !keyboard.hasMain || keyboard.navCount < 1 || !keyboard.activeLabel || keyboard.skipTop === '-80px') {
    throw new Error(`A navegação por teclado não expõe skip link, landmarks ou estado actual: ${JSON.stringify(keyboard)}`);
  }

  const mobile = await evaluate(`({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, labels: [...document.querySelectorAll('button')].map(button => button.innerText?.trim() || button.textContent?.trim()), body: document.body.innerText })`);
  if (mobile.scrollWidth > mobile.width) throw new Error(`A navegação móvel cria overflow horizontal: ${mobile.scrollWidth}px > ${mobile.width}px`);
  if (!mobile.body.includes('Mais')) throw new Error(`A navegação móvel não expõe o destino Mais: ${JSON.stringify(mobile.labels)}`);

  await evaluate(`[...document.querySelectorAll('button')].find(button => (button.innerText || button.textContent || '').includes('Mais'))?.click()`);
  await poll(async () => await evaluate(`Boolean([...document.querySelectorAll('[role="presentation"], [role="dialog"]')].find(node => node.textContent?.includes('Designações')))`), 'O painel Mais não abriu');
  await evaluate(`[...document.querySelectorAll('button')].find(button => (button.innerText || button.textContent || '').trim() === 'Fechar')?.click()`);
  await poll(async () => await evaluate(`document.activeElement?.textContent?.trim() === '•••Mais'`), 'O foco não regressou ao botão Mais depois de fechar o painel');

  const workspaces = {
    'pt-PT': [['/agenda', 'Agenda'], ['/designacoes', 'Designações'], ['/pessoas', 'Pessoas'], ['/preferencias', 'Preferências']],
    en: [['/agenda', 'Agenda'], ['/assignments', 'Assignments'], ['/people', 'People'], ['/preferences', 'Preferences']],
    es: [['/agenda', 'Agenda'], ['/designacoes', 'Asignaciones'], ['/pessoas', 'Personas'], ['/preferencias', 'Preferencias']],
  };
  const organization = {
    'pt-PT': { path: '/pessoas', heading: 'Pessoas e organização', documentTitle: 'Eutaktos — Pessoas', people: 'Pessoas', households: 'Agregados', groups: 'Grupos de serviço', responsibilities: 'Responsabilidades', hourglass: 'Inspecionar export Hourglass', audit: 'Histórico de auditoria', access: 'Gerir acessos', hourglassTitle: 'Inspeção de export Hourglass', auditTitle: 'Histórico de auditoria', accessTitle: 'Gestão de acessos', close: 'Fechar' },
    en: { path: '/people', heading: 'People and organization', documentTitle: 'Eutaktos — People', people: 'People', households: 'Households', groups: 'Service groups', responsibilities: 'Responsibilities', hourglass: 'Inspect Hourglass export', audit: 'Audit history', access: 'Manage access', hourglassTitle: 'Hourglass export inspector', auditTitle: 'Audit history', accessTitle: 'Access management', close: 'Close' },
    es: { path: '/pessoas', heading: 'Personas y organización', documentTitle: 'Eutaktos — Personas', people: 'Personas', households: 'Grupos familiares', groups: 'Grupos de servicio', responsibilities: 'Responsabilidades', hourglass: 'Inspeccionar exportación Hourglass', audit: 'Historial de auditoría', access: 'Gestionar accesos', hourglassTitle: 'Inspector de exportación Hourglass', auditTitle: 'Historial de auditoría', accessTitle: 'Gestión de accesos', close: 'Cerrar' },
  };
  for (const locale of ['pt-PT', 'en', 'es']) {
    const expectedHome = locale === 'pt-PT' ? 'Tudo em boa ordem.' : locale === 'en' ? 'Everything in good order.' : 'Todo en buen orden.';
    await setPreferences({ ...defaults, locale }, expectedHome);
    for (const [path, heading] of workspaces[locale]) await visitWorkspace(path, heading, locale);
    await verifyLocalizedOrganization(locale, organization[locale]);
  }
  await setPreferences({ ...defaults, locale: 'en' }, 'Everything in good order.');
  await visitWorkspace('/people/?source=deep-link#contacts', 'People', 'en');
  await visitWorkspace('/unknown-route?source=deep-link', 'Everything in good order.', 'en', 'Eutaktos — Home');

  await setPreferences({ ...defaults, locale: 'es', colorMode: 'dark', highContrast: true }, 'Todo en buen orden.');
  const accessibility = await evaluate(`({ mode: document.documentElement.dataset.colorMode, background: getComputedStyle(document.body).backgroundColor, border: getComputedStyle(document.querySelector('.MuiPaper-root')).borderTopWidth })`);
  if (accessibility.mode !== 'dark' || accessibility.border !== '2px' || accessibility.background === 'rgb(0, 0, 0)') throw new Error(`O tema acessível não foi aplicado corretamente: ${JSON.stringify(accessibility)}`);

  process.stdout.write('UX runtime checks passed: pt-PT/en/es workspaces and organization dialogs, localized real deep-link navigations/titles, safe unknown-route fallback, More focus restore, dark/high contrast, 320px reflow, skip link, landmarks and aria-current.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (!devServer.killed) devServer.kill('SIGTERM');
}

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

async function poll(operation, label) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
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
  await evaluate(`localStorage.setItem('eutaktos.preferences.v4', ${JSON.stringify(JSON.stringify(preferences))}); location.reload();`);
  await poll(async () => await evaluate(`document.documentElement.lang === ${JSON.stringify(preferences.locale)} && Boolean(document.querySelector('#root')?.textContent?.includes(${JSON.stringify(expectedHeading)}))`), `A interface não carregou em ${preferences.locale}`);
}

async function visitWorkspace(path, expectedHeading, locale, expectedTitle = `Eutaktos — ${expectedHeading}`) {
  await evaluate(`history.pushState({}, '', ${JSON.stringify(path)}); window.dispatchEvent(new PopStateEvent('popstate'));`);
  await poll(async () => await evaluate(`document.documentElement.lang === ${JSON.stringify(locale)} && document.title === ${JSON.stringify(expectedTitle)} && Boolean(document.querySelector('#main')?.textContent?.includes(${JSON.stringify(expectedHeading)}))`), `O deep link ${path} não apresentou o título e conteúdo localizados em ${locale}`);
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
  for (const locale of ['pt-PT', 'en', 'es']) {
    const expectedHome = locale === 'pt-PT' ? 'Tudo em boa ordem.' : locale === 'en' ? 'Everything in good order.' : 'Todo en buen orden.';
    await setPreferences({ ...defaults, locale }, expectedHome);
    for (const [path, heading] of workspaces[locale]) await visitWorkspace(path, heading, locale);
  }
  await setPreferences({ ...defaults, locale: 'en' }, 'Everything in good order.');
  await visitWorkspace('/people/?source=deep-link#contacts', 'People', 'en');
  await visitWorkspace('/unknown-route?source=deep-link', 'Everything in good order.', 'en', 'Eutaktos — Home');

  await setPreferences({ ...defaults, locale: 'es', colorMode: 'dark', highContrast: true }, 'Todo en buen orden.');
  const accessibility = await evaluate(`({ mode: document.documentElement.dataset.colorMode, background: getComputedStyle(document.body).backgroundColor, border: getComputedStyle(document.querySelector('.MuiPaper-root')).borderTopWidth })`);
  if (accessibility.mode !== 'dark' || accessibility.border !== '2px' || accessibility.background === 'rgb(0, 0, 0)') throw new Error(`O tema acessível não foi aplicado corretamente: ${JSON.stringify(accessibility)}`);

  process.stdout.write('UX runtime checks passed: pt-PT/en/es workspaces, localized deep links/titles, safe unknown-route fallback, More focus restore, dark/high contrast, 320px reflow, skip link, landmarks and aria-current.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (!devServer.killed) devServer.kill('SIGTERM');
}

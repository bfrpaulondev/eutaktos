import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appPort = '5194';
const debugPort = '9237';
const appUrl = `http://127.0.0.1:${appPort}/`;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const wait = ms => new Promise(done => setTimeout(done, ms));

async function poll(operation, label, attempts = 80) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
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
  const socket = new WebSocket(url); const pending = new Map(); let nextId = 1;
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    const done = pending.get(message.id);
    if (done) { pending.delete(message.id); done(message); }
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const id = nextId++;
        socket.send(JSON.stringify({ id, method, params }));
        return new Promise((done, fail) => pending.set(id, result => result.error ? fail(new Error(result.error.message)) : done(result.result)));
      },
      close() { socket.close(); },
    }));
    socket.addEventListener('error', reject, { once: true });
  });
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}

let server; let browser; let cdp;
try {
  server = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', appPort, '--strictPort'], { stdio: 'ignore' });
  await poll(async () => (await fetch(appUrl)).ok, 'Vite did not start');

  browser = spawn(chromium, [
    `--remote-debugging-port=${debugPort}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=/tmp/eutaktos-lazy-recovery-${process.pid}`,
    '--window-size=1280,900',
    appUrl,
  ], { stdio: 'ignore' });

  const target = await poll(async () => {
    const targets = await (await fetch(`${debugUrl}/json`)).json();
    return targets.find(item => item.type === 'page' && item.url.startsWith(appUrl));
  }, 'Chromium did not open the application');

  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  await poll(async () => await evaluate(cdp, "document.readyState === 'complete' && document.body.innerText.includes('Tudo em boa ordem.')"), 'Home did not render before lazy failure injection');

  // Reproduce the production failure class deliberately: the shell is already
  // mounted, but the lazy workspace chunk is unavailable during navigation.
  await cdp.send('Network.setBlockedURLs', { urls: ['*SectionWorkspace*'] });
  const clicked = await evaluate(cdp, `(() => {
    const target = [...document.querySelectorAll('button, a[href], [role="menuitem"]')].find(node => node.textContent?.trim() === 'Pessoas');
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!clicked) throw new Error('People navigation control was not found');

  await poll(async () => await evaluate(cdp, "location.pathname === '/pessoas' && Boolean(document.querySelector('[data-app-recovery-boundary=\"true\"]'))"), 'Lazy workspace failure did not render the recovery boundary');

  const failureSnapshot = await evaluate(cdp, `(() => ({
    rootChildren: document.querySelector('#root')?.childElementCount ?? 0,
    hasMain: Boolean(document.querySelector('#main')),
    hasRetry: Boolean(document.querySelector('[data-app-recovery-retry="true"]')),
    path: location.pathname,
  }))()`);
  if (failureSnapshot.rootChildren <= 0 || !failureSnapshot.hasMain || !failureSnapshot.hasRetry || failureSnapshot.path !== '/pessoas') {
    throw new Error(`Recovery boundary did not preserve a usable app surface: ${JSON.stringify(failureSnapshot)}`);
  }

  // A real retry performs a full reload, which clears React.lazy's rejected
  // promise cache and obtains the current deployment resources again.
  await cdp.send('Network.setBlockedURLs', { urls: [] });
  const retried = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-app-recovery-retry="true"]');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!retried) throw new Error('Recovery retry control was not available');

  await poll(async () => await evaluate(cdp, "document.readyState === 'complete' && location.pathname === '/pessoas' && !document.querySelector('[data-app-recovery-boundary=\"true\"]') && Boolean(document.querySelector('#main')) && document.title.includes('Pessoas')"), 'Application did not recover after lazy chunk retry', 120);

  const recoverySnapshot = await evaluate(cdp, `(() => ({
    rootChildren: document.querySelector('#root')?.childElementCount ?? 0,
    hasMain: Boolean(document.querySelector('#main')),
    hasRecoveryBoundary: Boolean(document.querySelector('[data-app-recovery-boundary="true"]')),
    path: location.pathname,
    title: document.title,
  }))()`);
  if (recoverySnapshot.rootChildren <= 0 || !recoverySnapshot.hasMain || recoverySnapshot.hasRecoveryBoundary || recoverySnapshot.path !== '/pessoas') {
    throw new Error(`Application remained unhealthy after retry: ${JSON.stringify(recoverySnapshot)}`);
  }

  process.stdout.write('Lazy-route recovery passed: blocked workspace chunk produced a non-empty accessible recovery state and retry restored /pessoas after a full reload.\n');
} finally {
  cdp?.close();
  if (browser && !browser.killed) browser.kill('SIGTERM');
  if (server && !server.killed) server.kill('SIGTERM');
}

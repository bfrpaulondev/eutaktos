import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const port = '5186';
const url = `http://127.0.0.1:${port}/`;
const deepLinkUrl = `http://127.0.0.1:${port}/auth/confirm?token_hash=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef&type=email`;
const chromium = process.env.CHROMIUM_BIN ?? 'chromium';
const viteCli = resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/vite/bin/vite.js');

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForPreview() {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await wait(200);
  }
  throw new Error(`O preview de produção não iniciou: ${String(lastError)}`);
}

async function requireProductionAsset(pathname) {
  const response = await fetch(new URL(pathname, url));
  if (!response.ok) throw new Error(`O recurso PWA de produção não foi publicado: ${pathname} (${response.status})`);
  return response;
}

async function verifyPwaAssets() {
  const manifestResponse = await requireProductionAsset('manifest.webmanifest');
  const manifest = await manifestResponse.json();
  if (manifest.display !== 'standalone' || manifest.start_url !== './' || !Array.isArray(manifest.icons) || manifest.icons.length < 2) {
    throw new Error(`O manifesto PWA não cumpre o contrato de instalação: ${JSON.stringify(manifest)}`);
  }
  for (const icon of manifest.icons) await requireProductionAsset(icon.src.replace(/^\.\//, ''));

  const serviceWorker = await (await requireProductionAsset('sw.js')).text();
  const requiredWorkerRules = ["pathname.startsWith('/api/')", "pathname.startsWith('/auth/')", "request.headers.has('authorization')", 'url.search', 'isSafeStaticResponse(response)', "cache: 'no-store'", "Referrer-Policy': 'no-referrer'", "X-Content-Type-Options': 'nosniff'", 'cache.put(request, response.clone())'];
  for (const rule of requiredWorkerRules) {
    if (!serviceWorker.includes(rule)) throw new Error(`O service worker publicado não contém a salvaguarda esperada: ${rule}`);
  }
}

function dumpDom(targetUrl) {
  return spawnSync(chromium, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=3500', '--dump-dom', targetUrl,
  ], { encoding: 'utf8' });
}

const preview = spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let previewOutput = '';
preview.stdout.on('data', chunk => { previewOutput += chunk; });
preview.stderr.on('data', chunk => { previewOutput += chunk; });

try {
  await waitForPreview();
  await verifyPwaAssets();

  const rootPage = dumpDom(url);
  if (rootPage.status !== 0) {
    throw new Error(`O Chromium não conseguiu abrir o build de produção: ${rootPage.stderr}`);
  }
  if (!/<div id="root"><[^>]/.test(rootPage.stdout) || !rootPage.stdout.includes('Eutaktos')) {
    throw new Error(`A aplicação não montou no build de produção. DOM recebido: ${rootPage.stdout.slice(0, 500)}`);
  }

  const deepLinkPage = dumpDom(deepLinkUrl);
  if (deepLinkPage.status !== 0) {
    throw new Error(`O Chromium não conseguiu abrir o deep link de confirmação: ${deepLinkPage.stderr}`);
  }
  if (!deepLinkPage.stdout.includes('Confirmar entrada') || !deepLinkPage.stdout.includes('Entrar no Eutaktos')) {
    throw new Error(`O deep link /auth/confirm não montou a confirmação segura. DOM recebido: ${deepLinkPage.stdout.slice(0, 700)}`);
  }

  process.stdout.write('Production build mounted successfully at root and scanner-safe auth deep link with manifest, icons and service-worker safeguards.\n');
} finally {
  if (!preview.killed) preview.kill('SIGTERM');
}

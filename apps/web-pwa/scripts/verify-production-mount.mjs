import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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

  const revisionResponse = await requireProductionAsset('build-revision.json');
  const revision = await revisionResponse.json();
  if (!revision || typeof revision !== 'object' || Array.isArray(revision) || Object.keys(revision).length !== 1 || !/^[0-9a-f]{40}$/.test(revision.revision ?? '')) {
    throw new Error('O artefacto de revisão de produção deve conter apenas um SHA-40 hexadecimal.');
  }
  const headers = await readFile(resolve(process.cwd(), 'dist/_headers'), 'utf8');
  if (!/\/build-revision\.json\s+Cache-Control:\s*no-store/m.test(headers)) {
    throw new Error('O artefacto de revisão de produção deve ser publicado com Cache-Control: no-store.');
  }

  const serviceWorker = await (await requireProductionAsset('sw.js')).text();
  const requiredWorkerRules = ["pathname.startsWith('/api/')", "pathname.startsWith('/auth/')", "request.headers.has('authorization')", 'url.search', 'isSafeStaticResponse(response)', "cache: 'no-store'", "Referrer-Policy': 'no-referrer'", "X-Content-Type-Options': 'nosniff'", 'cache.put(request, response.clone())'];
  for (const rule of requiredWorkerRules) {
    if (!serviceWorker.includes(rule)) throw new Error(`O service worker publicado não contém a salvaguarda esperada: ${rule}`);
  }
}

async function verifyDeepLinkAssets() {
  const response = await fetch(deepLinkUrl);
  if (!response.ok) throw new Error(`O deep link de autenticação não devolveu o shell SPA: ${response.status}`);
  const html = await response.text();
  const references = [
    ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
    ...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g),
  ].map(match => match[1]).filter(Boolean);

  if (references.length === 0) throw new Error('O shell do deep link não contém bundles de produção.');

  for (const reference of references) {
    const assetUrl = new URL(reference, deepLinkUrl);
    if (!assetUrl.pathname.startsWith('/assets/')) {
      throw new Error(`O bundle ${reference} resolve incorretamente no deep link para ${assetUrl.pathname}; esperado /assets/...`);
    }
    const assetResponse = await fetch(assetUrl);
    if (!assetResponse.ok) throw new Error(`O bundle do deep link não está acessível: ${assetUrl.pathname} (${assetResponse.status})`);
    const contentType = (assetResponse.headers.get('content-type') ?? '').toLowerCase();
    if (assetUrl.pathname.endsWith('.js') && !contentType.includes('javascript')) {
      throw new Error(`O bundle JS do deep link devolveu Content-Type inesperado: ${assetUrl.pathname} -> ${contentType}`);
    }
    if (assetUrl.pathname.endsWith('.css') && !contentType.includes('text/css')) {
      throw new Error(`O bundle CSS do deep link devolveu Content-Type inesperado: ${assetUrl.pathname} -> ${contentType}`);
    }
  }
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
  await verifyDeepLinkAssets();

  const page = spawnSync(chromium, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=3500', '--dump-dom', url,
  ], { encoding: 'utf8' });

  if (page.status !== 0) {
    throw new Error(`O Chromium não conseguiu abrir o build de produção: ${page.stderr}`);
  }

  const dom = page.stdout;
  if (!/<div id="root"><[^>]/.test(dom) || !dom.includes('Eutaktos')) {
    throw new Error(`A aplicação não montou no build de produção. DOM recebido: ${dom.slice(0, 500)}`);
  }

  process.stdout.write('Production build mounted successfully; build revision artifact, auth deep-link bundles and PWA safeguards are available.\n');
} finally {
  if (!preview.killed) preview.kill('SIGTERM');
}

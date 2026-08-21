import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const port = '5186';
const url = `http://127.0.0.1:${port}/`;
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

const preview = spawn(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let previewOutput = '';
preview.stdout.on('data', chunk => { previewOutput += chunk; });
preview.stderr.on('data', chunk => { previewOutput += chunk; });

try {
  await waitForPreview();
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

  process.stdout.write('Production build mounted successfully.\n');
} finally {
  if (!preview.killed) preview.kill('SIGTERM');
}

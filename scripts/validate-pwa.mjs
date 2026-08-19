import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const webRoot = resolve(root, 'apps/web-pwa');
const publicRoot = resolve(webRoot, 'public');
const manifestPath = resolve(publicRoot, 'manifest.webmanifest');
const serviceWorkerPath = resolve(publicRoot, 'sw.js');
const htmlPath = resolve(webRoot, 'index.html');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const serviceWorker = await readFile(serviceWorkerPath, 'utf8');
const html = await readFile(htmlPath, 'utf8');

const fail = message => {
  console.error(`PWA validation failed: ${message}`);
  process.exitCode = 1;
};

if (manifest.background_color !== '#FAFAFA') fail('default background must use palette 1 #FAFAFA');
if (manifest.theme_color !== '#FAFAFA') fail('default theme color must use palette 1 #FAFAFA');
if (manifest.start_url !== './' || manifest.scope !== './') fail('manifest must remain deploy-path agnostic');
if (manifest.display !== 'standalone') fail('manifest display must be standalone');

const requiredSizes = new Set(['192x192', '512x512']);
for (const icon of manifest.icons ?? []) {
  if (icon.sizes) requiredSizes.delete(icon.sizes);
  const path = resolve(publicRoot, icon.src.replace(/^\.\//, ''));
  try {
    await access(path);
  } catch {
    fail(`manifest icon does not exist: ${icon.src}`);
  }
}
if (requiredSizes.size) fail(`missing required icon sizes: ${[...requiredSizes].join(', ')}`);
if (!(manifest.icons ?? []).some(icon => String(icon.purpose).includes('maskable'))) fail('a maskable icon is required');

if (!html.includes('name="theme-color" content="#FAFAFA"')) fail('HTML theme color must match default palette');
if (!html.includes('rel="manifest"')) fail('HTML must link the web manifest');

if (!serviceWorker.includes("SAFE_DESTINATIONS = new Set(['style', 'script', 'font', 'image', 'manifest'])")) {
  fail('service worker must explicitly allowlist public asset destinations');
}
if (!serviceWorker.includes("if (!SAFE_DESTINATIONS.has(request.destination))")) {
  fail('service worker must exclude non-public destinations from Cache Storage');
}
if (!serviceWorker.includes("request.mode === 'navigate'")) fail('service worker must provide a navigation offline fallback');
if (!serviceWorker.includes("'Cache-Control': 'no-store'")) fail('offline fallback must not be cached');

if (!process.exitCode) console.log('PWA validation passed.');

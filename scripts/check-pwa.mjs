import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'apps/web-pwa');
const manifestPath = resolve(root, 'public/manifest.webmanifest');
const serviceWorkerPath = resolve(root, 'public/sw.js');
const indexPath = resolve(root, 'index.html');
const mainPath = resolve(root, 'src/main.tsx');
const appPath = resolve(root, 'src/App.tsx');
const updateRecoveryPath = resolve(root, 'src/PwaUpdateRecovery.tsx');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const sw = await readFile(serviceWorkerPath, 'utf8');
const index = await readFile(indexPath, 'utf8');
const main = await readFile(mainPath, 'utf8');
const app = await readFile(appPath, 'utf8');
const updateRecovery = await readFile(updateRecoveryPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(`PWA check failed: ${message}`);
}

assert(manifest.name === 'Eutaktos', 'manifest name must be Eutaktos');
assert(manifest.start_url === './' && manifest.scope === './', 'start_url and scope must remain monorepo-safe relative URLs');
assert(manifest.display === 'standalone', 'manifest must support standalone installation');
assert(manifest.background_color === '#FAFAFA' && manifest.theme_color === '#FAFAFA', 'manifest must use approved palette 1 background by default');
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest needs install icons');
assert(manifest.icons.some(icon => icon.sizes === '192x192'), 'manifest needs a 192x192 icon');
assert(manifest.icons.some(icon => icon.sizes === '512x512'), 'manifest needs a 512x512 icon');

for (const icon of manifest.icons) {
  const relative = icon.src.replace(/^\.\//, '');
  await access(resolve(root, 'public', relative));
}

assert(index.includes('rel="manifest"'), 'index must link the web app manifest');
assert(index.includes('apple-mobile-web-app-capable'), 'index must include iOS install metadata');
assert(index.includes('#FAFAFA'), 'index theme color must match palette 1');

assert(sw.includes("request.destination === 'document'"), 'service worker must handle documents separately');
assert(sw.includes("url.pathname.startsWith('/api/')"), 'service worker must explicitly exclude API routes');
assert(sw.includes("url.pathname.startsWith('/auth/')"), 'service worker must explicitly exclude auth routes');
assert(sw.includes("new Set(['script', 'style', 'font', 'image', 'manifest'])"), 'service worker cache allowlist must stay static-only');
assert(!sw.includes("request.destination!=='document'"), 'legacy broad cache rule must not return');
assert(sw.includes("event.data?.type === 'SKIP_WAITING'"), 'service worker updates must require the explicit SKIP_WAITING message');
assert(!sw.includes("self.addEventListener('install', () => self.skipWaiting())"), 'updates must not silently force activation during install');
assert(main.includes('<App />'), 'application root must render the App shell');
assert(app.includes('<PwaUpdateRecovery />'), 'App shell must render the update/recovery experience under the active theme');
assert(updateRecovery.includes('registerPwaUpdateController'), 'update/recovery experience must use the controlled update flow');
assert(updateRecovery.includes('aria-live="polite"'), 'update notice must announce itself accessibly');

console.log('PWA installability, safe-cache and controlled-update checks passed.');

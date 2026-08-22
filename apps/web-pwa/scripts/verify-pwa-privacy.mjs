import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const applicationDirectory = resolve(scriptDirectory, '../src');
const serviceWorkerPath = resolve(scriptDirectory, '../public/sw.js');

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)) return [path];
    return [];
  }));
  return nested.flat();
}

const files = await sourceFiles(applicationDirectory);
const storageFiles = [];
const cacheApiFiles = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  if (/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(content)) storageFiles.push(relative(applicationDirectory, file));
  if (/\b(?:caches|CacheStorage)\b/.test(content)) cacheApiFiles.push(relative(applicationDirectory, file));
}

if (storageFiles.length !== 1 || storageFiles[0] !== 'App.tsx') {
  throw new Error(`Unexpected browser storage use in production source: ${storageFiles.join(', ') || 'none'}.`);
}
if (cacheApiFiles.length > 0) {
  throw new Error(`React source must not access Cache Storage directly: ${cacheApiFiles.join(', ')}.`);
}

const app = await readFile(resolve(applicationDirectory, 'App.tsx'), 'utf8');
if (!app.includes("const STORAGE_KEY = 'eutaktos.preferences.v4'")) {
  throw new Error('Preferences storage key is missing or was changed without a privacy review.');
}
if (/hourglass|emergency|audit|person|contact/i.test(app.match(/localStorage\.[\s\S]{0,200}/)?.[0] ?? '')) {
  throw new Error('Local storage near the preferences access contains a sensitive-data identifier.');
}

const serviceWorker = await readFile(serviceWorkerPath, 'utf8');
const requiredRules = [
  "pathname.startsWith('/api/')",
  "pathname.startsWith('/auth/')",
  "request.headers.has('authorization')",
  'url.search',
  'isSafeStaticResponse(response)',
  "cache: 'no-store'",
  "Referrer-Policy': 'no-referrer'",
  "X-Content-Type-Options': 'nosniff'",
];
for (const rule of requiredRules) {
  if (!serviceWorker.includes(rule)) throw new Error(`Missing service-worker privacy rule: ${rule}`);
}
if (serviceWorker.includes('caches.match(request)')) {
  throw new Error('The worker must not search caches outside its current static cache.');
}
if (!serviceWorker.includes('new Response(') || !serviceWorker.includes("'Cache-Control': 'no-store'")) {
  throw new Error('The offline document must be an informational no-store response.');
}

process.stdout.write('PWA privacy checks passed: browser storage is limited to preferences; React source has no Cache Storage access; static cache excludes API, auth, authorization, query and private/no-store responses.\n');

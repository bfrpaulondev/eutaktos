import { readFileSync, existsSync } from 'node:fs';

const required = [
  'apps/web-pwa/package.json',
  'apps/web-pwa/index.html',
  'apps/web-pwa/public/manifest.webmanifest',
  'apps/web-pwa/src/App.tsx',
  'apps/web-pwa/src/i18n.ts',
  'apps/web-pwa/tests/App.test.tsx',
  'apps/web-pwa/e2e/app.spec.ts',
];
for (const path of required) if (!existsSync(path)) throw new Error(`Missing required file: ${path}`);

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const app = JSON.parse(readFileSync('apps/web-pwa/package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('apps/web-pwa/public/manifest.webmanifest', 'utf8'));
if (!root.private || !Array.isArray(root.workspaces)) throw new Error('Root workspace configuration is invalid.');
if (app.dependencies.react !== app.dependencies['react-dom']) throw new Error('React and react-dom must stay aligned.');
if (manifest.display !== 'standalone' || !manifest.start_url) throw new Error('PWA manifest is incomplete.');

const i18n = readFileSync('apps/web-pwa/src/i18n.ts', 'utf8');
for (const locale of ["'pt-PT'", 'en:', 'es:']) if (!i18n.includes(locale)) throw new Error(`Missing locale ${locale}`);
const html = readFileSync('apps/web-pwa/index.html', 'utf8');
if (!html.includes('href="#main-content"')) throw new Error('Skip link is required.');
console.log('Repository foundation validation passed.');

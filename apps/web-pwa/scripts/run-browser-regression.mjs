import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const checks = [
  { label: 'typecheck', args: ['run', 'typecheck'] },
  { label: 'unit tests', args: ['test'] },
  { label: 'bundle budget', args: ['run', 'test:bundle-budget'] },
  { label: 'PWA privacy', args: ['run', 'test:pwa-privacy'] },
  { label: 'production mount', args: ['run', 'test:production-mount'] },
  { label: 'browser UX runtime', args: ['run', 'test:ux-runtime'] },
  { label: 'Person profile route runtime', args: ['run', 'test:person-profile-route'] },
  { label: 'PX5 profile contacts runtime', args: ['run', 'test:px5-profile-regression'] },
  { label: 'Person wizard Directory runtime', args: ['run', 'test:person-wizard-directory'] },
  { label: 'Recommendation picker runtime', args: ['run', 'test:recommendation-picker'] },
  { label: 'C6 responsive overflow runtime', args: ['run', 'test:c6-responsive-overflow'] },
  { label: 'People Directory export runtime', args: ['run', 'test:people-directory-export-runtime'] },
  { label: 'System theme runtime', args: ['run', 'test:system-theme-runtime'] },
  { label: 'lazy-route recovery', args: ['run', 'test:lazy-recovery'] },
  { label: 'sanitized visual regression', args: ['run', 'test:visual-sanitized'] },
  { label: 'Hourglass inspector runtime', args: ['run', 'test:hourglass-inspector'] },
];

function runCheck({ label, args }) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`\n=== ${label} ===\n`);
    const child = spawn(npmCommand, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${String(code)}. Reproduce with: ${npmCommand} ${args.join(' ')}`));
    });
  });
}

for (const check of checks) await runCheck(check);
process.stdout.write(`\nBrowser regression passed: ${checks.map(check => check.label).join(', ')}.\n`);

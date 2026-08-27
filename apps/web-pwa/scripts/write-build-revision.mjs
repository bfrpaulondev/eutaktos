import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function revisionFromEnvironment() {
  for (const candidate of [process.env.COMMIT_REF, process.env.GITHUB_SHA]) {
    const value = candidate?.trim();
    if (value && /^[0-9a-f]{40}$/i.test(value)) return value.toLowerCase();
  }
  return undefined;
}

function revisionFromGit() {
  try {
    const value = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    return /^[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

const revision = revisionFromEnvironment() ?? revisionFromGit();
if (!revision) throw new Error('Unable to determine build revision');

const dist = resolve(process.cwd(), 'dist');
await mkdir(dist, { recursive: true });
await writeFile(resolve(dist, 'build-revision.json'), `${JSON.stringify({ revision })}\n`, 'utf8');
process.stdout.write(`Published build revision ${revision}\n`);

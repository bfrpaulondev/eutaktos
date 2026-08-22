import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const assetsDirectory = resolve(scriptDirectory, '../dist/assets');
const initialBudgetBytes = 500_000;

const files = await readdir(assetsDirectory);
const javaScriptFiles = files.filter(file => file.endsWith('.js'));
const initialFiles = javaScriptFiles.filter(file => file.startsWith('index-'));
const workspaceFiles = javaScriptFiles.filter(file => file.startsWith('SectionWorkspace-'));

if (initialFiles.length !== 1) throw new Error(`Expected exactly one initial application chunk, found: ${initialFiles.join(', ') || 'none'}.`);
if (workspaceFiles.length !== 1) throw new Error(`Expected exactly one lazy SectionWorkspace chunk, found: ${workspaceFiles.join(', ') || 'none'}.`);

const initialSize = (await stat(resolve(assetsDirectory, initialFiles[0]))).size;
const workspaceSize = (await stat(resolve(assetsDirectory, workspaceFiles[0]))).size;

if (initialSize > initialBudgetBytes) {
  throw new Error(`Initial application chunk exceeds the ${initialBudgetBytes}-byte budget: ${initialFiles[0]} is ${initialSize} bytes.`);
}
if (workspaceSize === 0) throw new Error(`Lazy workspace chunk is empty: ${workspaceFiles[0]}.`);

process.stdout.write(`Bundle budget passed: initial ${initialFiles[0]} is ${initialSize} bytes; lazy ${workspaceFiles[0]} is ${workspaceSize} bytes.\n`);

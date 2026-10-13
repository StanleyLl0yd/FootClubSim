import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const extensions = new Set(['.ts', '.tsx', '.mjs', '.css', '.yml', '.json', '.html']);
const roots = ['src', 'tests', 'scripts', 'data', '.github/workflows'];
const rootFiles = [
  'index.html', 'package.json', 'package-lock.json',
  'tsconfig.json', 'tsconfig.app.json', 'eslint.config.mjs', 'vite.config.ts',
];
const errors = [];

async function checkFile(file) {
  const value = await readFile(file, 'utf8');
  if (!value.endsWith('\n')) errors.push(file + ': missing terminal newline');
  if (value.includes('\r')) errors.push(file + ': CR/CRLF line endings');
  if (value.includes('\t')) errors.push(file + ': tab indentation');
  if (/[^\S\n]+$/m.test(value)) errors.push(file + ': trailing whitespace');
}

async function visit(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
      continue;
    }
    if (!entry.isFile() || !extensions.has(extname(file))) continue;
    await checkFile(file);
  }
}

for (const root of roots) await visit(root);
for (const file of rootFiles) await checkFile(file);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log('Source formatting hygiene verified');
}

import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const extensions = new Set(['.ts', '.tsx', '.mjs', '.css', '.yml', '.json', '.html']);
const roots = ['src', 'tests', 'scripts', '.github/workflows'];
const errors = [];

async function visit(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
      continue;
    }
    if (!entry.isFile() || !extensions.has(extname(file))) continue;
    const value = await readFile(file, 'utf8');
    if (value.length === 0) continue;
    if (!value.endsWith('\n')) errors.push(file + ': missing terminal newline');
    if (value.includes('\r')) errors.push(file + ': CR/CRLF line endings');
    if (value.includes('\t')) errors.push(file + ': tab indentation');
    if (/[^\S\n]+$/m.test(value)) errors.push(file + ': trailing whitespace');
  }
}

for (const root of roots) await visit(root);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else {
  console.log('Source formatting hygiene verified');
}

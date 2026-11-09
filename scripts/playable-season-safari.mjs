import assert from 'node:assert/strict';
import { exercisePlayableSeason } from './playable-season-ui.mjs';

const [driver, session, appUrl] = process.argv.slice(2);
const maxWait = 10 * 60_000;
const chunkSize = 256 * 1024;

async function wd(command, payload) {
  const response = await fetch(driver + '/session/' + encodeURIComponent(session) + '/' + command, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(maxWait + 15_000),
  });
  const result = await response.json();
  if (!response.ok || result.value?.error)
    throw new Error('Safari WebDriver ' + command + ': ' + (result.value?.message ?? response.status));
  return result.value;
}

async function evaluate(expression) {
  const result = await wd('execute/async', {
    script: 'const done = arguments[arguments.length - 1]; ' +
      'Promise.resolve().then(() => (' + expression + ')).then(' +
      'value => done({value}), error => done({message: String(error)}));',
    args: [],
  });
  if (result?.message) throw new Error(result.message);
  return result?.value;
}

async function download({ click, waitPage }) {
  // Capture the app's exact Blob and filename before Safari opens a download prompt.
  // Restore still passes through the real input[type=file] and browser IndexedDB.
  await evaluate('(() => {' +
    'const archive = { create: URL.createObjectURL, click: HTMLAnchorElement.prototype.click };' +
    'window.__playableSeasonArchive = archive;' +
    'URL.createObjectURL = function(blob) {' +
    '  archive.blob = blob; archive.url = archive.create.call(URL, blob); return archive.url;' +
    '};' +
    'HTMLAnchorElement.prototype.click = function() {' +
    '  if (this.href === archive.url) { archive.filename = this.download; return; }' +
    '  return archive.click.call(this);' +
    '};' +
    '})()');
  await click('Скачать полную карьеру');
  await waitPage('Полный архив создан: стартовая карьера', maxWait);
  const { filename, length } = await evaluate('(async () => {' +
    'const archive = window.__playableSeasonArchive;' +
    'URL.createObjectURL = archive.create; HTMLAnchorElement.prototype.click = archive.click;' +
    'archive.content = await archive.blob.text();' +
    'return { filename: archive.filename, length: archive.content.length };' +
    '})()');
  assert.ok(length > 0 && length <= 130_000_000);
  const chunks = [];
  for (let start = 0; start < length; start += chunkSize) {
    chunks.push(await evaluate('window.__playableSeasonArchive.content.slice(' +
      start + ',' + (start + chunkSize) + ')'));
  }
  await evaluate('delete window.__playableSeasonArchive');
  return { filename, json: chunks.join('') };
}

async function importArchive({ filename, json, selector = '#import-full-file' }) {
  const data = Buffer.from(json);
  await evaluate('window.__playableSeasonImport = []');
  for (let start = 0; start < data.length; start += chunkSize) {
    const encoded = JSON.stringify(data.subarray(start, start + chunkSize).toString('base64'));
    await evaluate('window.__playableSeasonImport.push(Uint8Array.from(atob(' + encoded +
      '), character => character.charCodeAt(0)))');
  }
  assert.equal(await evaluate('(() => {' +
    'const input = document.querySelector(' + JSON.stringify(selector) + '); if (!input) return false;' +
    'const transfer = new DataTransfer(); transfer.items.add(new File(window.__playableSeasonImport, ' +
    JSON.stringify(filename) + ', { type: "application/json" }));' +
    'delete window.__playableSeasonImport; input.files = transfer.files;' +
    'input.dispatchEvent(new Event("change", { bubbles: true })); return true;' +
    '})()'), true, 'Safari full-career input unavailable');
}

await wd('timeouts', { script: maxWait, pageLoad: maxWait });
await wd('url', { url: appUrl });
await exercisePlayableSeason({
  evaluate,
  reload: () => wd('refresh', {}),
  download,
  importArchive,
  browser: 'macOS Safari (archive Blob and native file input)',
});

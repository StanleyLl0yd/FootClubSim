#!/usr/bin/env node
// Chromium DevTools Protocol smoke: native browser, no DOM emulator or extra packages.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const executable = process.argv[2];
const targetUrl = process.argv[3] ?? 'http://127.0.0.1:4173/';
const privateFlag = process.argv[4] ?? null;
if (privateFlag !== null && privateFlag !== '--incognito' && privateFlag !== '--inprivate') {
  console.error('Unknown browser mode, expected --incognito or --inprivate');
  process.exit(2);
}
if (!executable) {
  console.error('Usage: node scripts/chromium-e2e.mjs /path/to/chrome-or-edge [url]');
  process.exit(2);
}

async function until(fn, description, duration = 30_000) {
  const deadline = Date.now() + duration;
  let lastError;
  do {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(300);
  } while (Date.now() < deadline);
  throw new Error('Timed out: ' + description + (lastError ? ': ' + String(lastError) : ''));
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => reject(new Error('CDP websocket timeout')), 15000);
    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('CDP websocket refused'));
    }, { once: true });
  });
}

function cdpClient(socket) {
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const response = JSON.parse(String(event.data));
    if (!Number.isInteger(response.id)) return;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    clearTimeout(entry.timeout);
    if (response.error) entry.reject(new Error('CDP: ' + JSON.stringify(response.error)));
    else entry.resolve(response.result ?? {});
  });
  socket.addEventListener('close', () => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(new Error('CDP websocket disconnected'));
    }
    pending.clear();
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('CDP timed out: ' + method));
    }, 20_000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

/**
 * Windows runners sometimes fail to launch a headless Chrome instance before
 * DevToolsActivePort exists. Retry only startup, with a fresh isolated profile;
 * never retry application assertions or hide a failing browser test.
 */
async function startBrowser(reuseProfile = null) {
  const failures = [];
  for (let attempt = 1; attempt <= (reuseProfile ? 1 : 2); attempt++) {
    const profile = reuseProfile ?? await mkdtemp(join(tmpdir(), 'footclubsim-cdp-'));
    if (reuseProfile) await rm(join(profile, 'DevToolsActivePort'), { force: true });
    const browser = spawn(executable, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      ...(privateFlag ? [privateFlag] : []),
      '--disable-extensions', '--remote-debugging-port=0',
      '--remote-allow-origins=*', '--user-data-dir=' + profile,
      'about:blank',
    ], { stdio: 'ignore', windowsHide: true });
    let launchError = null;
    browser.on('error', error => { launchError = error; });
    try {
      const portFile = join(profile, 'DevToolsActivePort');
      const port = await until(async () => {
        if (launchError) throw launchError;
        if (browser.exitCode !== null) throw new Error('Browser exited with code ' + browser.exitCode);
        const file = await readFile(portFile, 'utf8');
        const parsed = Number(file.split(/\r?\n/)[0]);
        return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : null;
      }, 'Edge/Chrome DevTools port', 20_000);
      if (attempt > 1) console.log('PASS: browser started on second attempt with a fresh profile');
      return { profile, browser, port };
    } catch (error) {
      const status = launchError ? String(launchError) :
        browser.exitCode !== null ? 'exit=' + browser.exitCode : 'no DevToolsActivePort';
      failures.push('attempt ' + attempt + ': ' + status + '; ' + String(error));
      browser.kill();
      await delay(500);
      if (!reuseProfile) await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 500 });
    }
  }
  throw new Error('Browser startup failed: ' + failures.join(' | '));
}

async function run() {
  let { profile, browser, port } = await startBrowser();
  let socket;
  try {

    const target = await until(async () => {
      const response = await fetch('http://127.0.0.1:' + port + '/json/list');
      if (!response.ok) return null;
      const pages = await response.json();
      return pages.find(page => page.type === 'page' && page.webSocketDebuggerUrl);
    }, 'CDP page target');

    socket = await openSocket(target.webSocketDebuggerUrl);
    let send = cdpClient(socket);
    await send('Page.enable');
    await send('Runtime.enable');

    if (privateFlag) {
      const info = await send('Target.getTargetInfo');
      if (typeof info.targetInfo?.browserContextId !== 'string' ||
          !info.targetInfo.browserContextId.length) {
        throw new Error('Private flag did not create an isolated CDP browser context');
      }
      console.log('PASS: private session has a separate CDP browserContextId');
    }

    async function evaluate(expression) {
      const reply = await send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
      });
      if (reply.exceptionDetails) {
        throw new Error('Browser JS exception: ' + JSON.stringify(reply.exceptionDetails));
      }
      return reply.result?.value;
    }

    async function waitText(text) {
      return until(async () => {
        const body = await evaluate('document.body?.innerText ?? ""');
        return typeof body === 'string' && body.includes(text) ? body : null;
      }, 'rendered text "' + text + '"');
    }

    async function click(label) {
      const found = await evaluate(`(() => {
        const button = Array.from(document.querySelectorAll('button')).find(
          element => element.textContent.trim() === ${JSON.stringify(label)}
        );
        if (!button || button.disabled) return false;
        button.click();
        return true;
      })()`);
      if (found !== true) throw new Error('Unavailable browser button: ' + label);
    }

    await send('Page.navigate', { url: targetUrl });
    const body = await waitText('Начало карьеры');
    for (const text of ['Календарь', 'Сохранения', '368', '240']) {
      if (!body.includes(text)) throw new Error('Missing M0 UI text: ' + text);
    }

    // Select a non-default club so restore must recover actual saved UI state.
    const switched = await evaluate(`(() => {
      const select = document.querySelector('#club-select');
      if (!select || select.options[1]?.value !== 'fictional-2') return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'fictional-2');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    if (!switched) throw new Error('Non-default club selection failed');

    async function assertNondefaultCareer(stage) {
      const matches = await evaluate(`(() => {
        const select = document.querySelector('#club-select');
        const info = document.querySelector('.career-info')?.innerText ?? '';
        return select?.value === 'fictional-2' &&
          info.includes('Fictional Club 2') && info.includes('Ревизия 0');
      })()`);
      if (!matches) throw new Error('Club identity or revision missing after ' + stage);
    }

    await click('Создать стартовую карьеру');
    await waitText('Стартовая карьера создана в памяти браузера');
    await assertNondefaultCareer('creation');
    await click('Сохранить в браузере');

    if (privateFlag) {
      const outcome = await until(async () => {
        const status = await evaluate("document.querySelector('.status')?.textContent ?? ''");
        if (status.includes('Начальная карьера записана в IndexedDB')) return 'saved';
        if (status.startsWith('Сохранение отклонено:')) return 'rejected';
        return null;
      }, 'explicit private-session storage success or rejection');

      if (outcome === 'saved') {
        // Private browsers may permit temporary same-session IndexedDB.
        await click('Сохранить в браузере');
        await waitText('Сохранение отклонено: DUPLICATE');
        await send('Page.reload', { ignoreCache: true });
        await waitText('Выберите вымышленный клуб');
        await click('Восстановить из браузера');
        await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
        await assertNondefaultCareer('private-session restore');
      } else {
        // A browser blocking private storage must not silently drop the career.
        if (!await evaluate("Boolean(document.querySelector('.career-info'))")) {
          throw new Error('Private-mode storage rejection erased the active career');
        }
        await assertNondefaultCareer('private-session storage failure');
        await click('Экспортировать JSON');
        await waitText('Файл JSON экспортирован');
      }
      console.log('PASS: private browser ' + privateFlag + ' responded explicitly (' + outcome + ')');
      return;
    }
    await waitText('Начальная карьера записана в IndexedDB');

    // Verify an ACTUAL browser-downloaded JSON file, not merely a UI message
    // or a synthetic file written by the test harness.
    const downloadedPath = join(profile, 'footclubsim-initial-career.json');
    await send('Browser.setDownloadBehavior', {
      behavior: 'allow', downloadPath: profile, eventsEnabled: true,
    });
    await click('Экспортировать JSON');
    await waitText('Файл JSON экспортирован');
    const downloadedJson = await until(async () => {
      const content = await readFile(downloadedPath, 'utf8');
      return content.includes('footclubsim-initial-career') ? content : null;
    }, 'native Chrome/Edge exported JSON download');
    console.log('PASS: native browser downloaded real M0 career JSON to disposable profile');

    await click('Сохранить в браузере');
    await waitText('Сохранение отклонено: DUPLICATE');

    await send('Page.reload', { ignoreCache: true });
    await waitText('Выберите вымышленный клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await assertNondefaultCareer('normal profile restore');

    // Exercise the actual M1 UI against native IndexedDB, then reload.
    // M0 identity/revision must remain unchanged while M1 advances independently.
    await click('Начать или продолжить M1');
    await waitText('Проверен исходный M0 и весь сохранённый журнал M1.');
    await click('Рассчитать матч');
    await waitText('Матч рассчитан. Результат пока не записан.');
    const previewScore = await evaluate(
      "document.querySelector('.m1-preview')?.innerText ?? ''");
    if (!previewScore.includes('Результат')) {
      throw new Error('M1 fixture simulation did not render a preview');
    }
    await click('Подтвердить и сохранить матч');
    await waitText('Матч подтверждён, независимо перепроверен и сохранён');
    await assertNondefaultCareer('M1 result CAS commit');
    await send('Page.reload', { ignoreCache: true });
    await waitText('Выберите вымышленный клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await click('Начать или продолжить M1');
    await waitText('Проверен исходный M0 и весь сохранённый журнал M1.');
    await waitText('Сохранено матчей выбранного клуба: 1 из 30.');
    await assertNondefaultCareer('M1 browser revision-1 restart');
    console.log('PASS: native browser played, committed and restored M1 without rewriting M0');

    // A second real browser match uses manager-selected substitute IDs,
    // not the previously fixed synthetic participants.
    const changedScenario = await evaluate(`(() => {
      const select = document.querySelector('#m1-playtest-scenario');
      if (!select) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'normal-substitution');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    if (!changedScenario) throw new Error('Missing M1 substitution scenario control');
    await waitText('Уходит с поля');
    const participants = await evaluate(`(() => {
      const outgoing = document.querySelector('#m1-player-out');
      const incoming = document.querySelector('#m1-player-in');
      if (!outgoing || !incoming || outgoing.options.length < 3 ||
          incoming.options.length < 3) return null;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype, 'value').set;
      setter.call(outgoing, outgoing.options[outgoing.options.length - 1].value);
      outgoing.dispatchEvent(new Event('change', { bubbles: true }));
      setter.call(incoming, incoming.options[incoming.options.length - 1].value);
      incoming.dispatchEvent(new Event('change', { bubbles: true }));
      return { out: outgoing.value, in: incoming.value };
    })()`);
    if (!participants?.out || !participants?.in) {
      throw new Error('M1 chosen substitution participants unavailable');
    }
    await click('Рассчитать матч');
    await waitText('Матч рассчитан. Результат пока не записан.');
    await click('Подтвердить и сохранить матч');
    await waitText('Матч подтверждён, независимо перепроверен и сохранён');
    const applied = await evaluate(`new Promise((resolve, reject) => {
      const opening = indexedDB.open('footclubsim-m1-v8', 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction('result-journals', 'readonly');
        const request = tx.objectStore('result-journals').get('m0-ui-initial-career');
        let command = null;
        request.onsuccess = () => {
          const journal = request.result;
          command = journal?.revision === 2 ?
            journal.results[1]?.source.plannedCommands[0] : null;
        };
        tx.oncomplete = () => { db.close(); resolve(command); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    })`);
    if (applied?.outPlayerId !== participants.out ||
        applied?.inPlayerId !== participants.in) {
      throw new Error('Browser CAS did not preserve the user-selected substitution');
    }
    await send('Page.reload', { ignoreCache: true });
    await waitText('Выберите вымышленный клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await click('Начать или продолжить M1');
    await waitText('Сохранено матчей выбранного клуба: 2 из 30.');
    await assertNondefaultCareer('M1 selected substitute browser restart');
    console.log('PASS: browser selected two specific substitution players and restored source CAS');



    // The seeded in-game referee feeds the very same v8 CAS journal; its
    // result must survive a native browser restart without M0 mutation.
    const refereeSelected = await evaluate(`(() => {
      const select = document.querySelector('#m1-playtest-scenario');
      if (!select) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'internal-referee');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value === 'internal-referee';
    })()`);
    if (!refereeSelected) throw new Error('Missing seeded internal referee scenario');
    await click('Рассчитать матч');
    await waitText('Матч рассчитан. Результат пока не записан.');
    await click('Подтвердить и сохранить матч');
    await waitText('Матч подтверждён, независимо перепроверен и сохранён');
    const refereeEvidence = await evaluate(`new Promise((resolve, reject) => {
      const opening = indexedDB.open('footclubsim-m1-v8', 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction('result-journals', 'readonly');
        const request = tx.objectStore('result-journals').get('m0-ui-initial-career');
        let result = null;
        request.onsuccess = () => {
          const journal = request.result;
          result = journal?.revision === 3 ? {
            revision: journal.revision,
            commands: journal.results[2]?.source.plannedCommands,
            medical: journal.results[2]?.source.medicalActions,
          } : null;
        };
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    })`);
    if (refereeEvidence?.revision !== 3 ||
        !Array.isArray(refereeEvidence.commands) ||
        !Array.isArray(refereeEvidence.medical) ||
        refereeEvidence.medical.length !== 0 ||
        refereeEvidence.commands.some(cmd =>
          !['caution', 'direct-red', 'injury-withdrawal'].includes(cmd.kind))) {
      throw new Error('Native CAS did not preserve a valid internal referee event source');
    }
    await send('Page.reload', { ignoreCache: true });
    await waitText('Выберите вымышленный клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await click('Начать или продолжить M1');
    await waitText('Сохранено матчей выбранного клуба: 3 из 30.');
    await assertNondefaultCareer('M1 seeded internal referee browser restart');
    console.log('PASS: browser persisted modelled in-game referee source in CAS revision 3');

    // Recover a valid initial career after clearing IndexedDB in a disposable
    // browser profile. Clearing site data is NOT organic eviction or real quota.
    const savedJson = await evaluate(`new Promise((resolve, reject) => {
      const open = indexedDB.open('footclubsim-m0', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        let value;
        const tx = db.transaction('initial-careers', 'readonly');
        const get = tx.objectStore('initial-careers').get('m0-ui-initial-career');
        get.onsuccess = () => { value = get.result; };
        tx.oncomplete = () => { db.close(); resolve(value); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    })`);
    if (typeof savedJson !== 'string' || !savedJson.includes('footclubsim-initial-career')) {
      throw new Error('Could not read valid initial-career backup from isolated browser');
    }
    if (savedJson !== downloadedJson) {
      throw new Error('Actual browser-downloaded JSON does not match the stored career');
    }
    const backupPath = downloadedPath;
    await send('Storage.clearDataForOrigin', {
      origin: new URL(targetUrl).origin, storageTypes: 'indexeddb',
    });
    await send('Page.reload', { ignoreCache: true });
    await waitText('Выберите вымышленный клуб');
    await click('Восстановить из браузера');
    await waitText('Восстановление отклонено: NOT_FOUND');
    const documentTree = await send('DOM.getDocument');
    const fileInput = await send('DOM.querySelector', {
      nodeId: documentTree.root.nodeId, selector: '#import-file',
    });
    if (!fileInput.nodeId) throw new Error('Import file input missing');
    await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [backupPath] });
    await waitText('Стартовая карьера проверена и загружена в память');
    await assertNondefaultCareer('downloaded backup import');

    // A correctly checksummed different career cannot be persisted by this
    // deliberately single-career M0 shell, because its Restore ID is fixed.
    const another = JSON.parse(savedJson);
    const otherPayload = JSON.parse(another.payload);
    otherPayload.careerId = 'another-valid-initial-career';
    another.payload = JSON.stringify(otherPayload);
    another.checksum = createHash('sha256').update(another.payload).digest('hex');
    const differentIdPath = join(profile, 'm0-foreign-career-id.json');
    await writeFile(differentIdPath, JSON.stringify(another), 'utf8');
    await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [differentIdPath] });
    await waitText('Импорт отклонён: идентификатор карьеры отличается');
    if (!await evaluate("Boolean(document.querySelector('.career-info'))")) {
      throw new Error('Foreign career ID import erased the active M0 career');
    }

    // Pack/version strings alone do not prove that a club exists in this shell.
    const foreignClub = JSON.parse(savedJson);
    const foreignPayload = JSON.parse(foreignClub.payload);
    const selected = foreignPayload.catalog.clubs.find(club => club.id === foreignPayload.selectedClubId);
    selected.id = 'foreign-valid-club';
    foreignPayload.selectedClubId = selected.id;
    foreignClub.payload = JSON.stringify(foreignPayload);
    foreignClub.checksum = createHash('sha256').update(foreignClub.payload).digest('hex');
    const foreignClubJson = JSON.stringify(foreignClub);
    const foreignClubPath = join(profile, 'm0-foreign-club.json');
    await writeFile(foreignClubPath, foreignClubJson, 'utf8');
    await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [foreignClubPath] });
    await waitText('Импорт отклонён: клуб отсутствует в тестовой базе');
    await assertNondefaultCareer('foreign club import rejection');

    const storedForeignClub = await evaluate(`new Promise((resolve, reject) => {
      const open = indexedDB.open('footclubsim-m0', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('initial-careers', 'readwrite');
        tx.objectStore('initial-careers').add(${JSON.stringify(foreignClubJson)}, 'm0-ui-initial-career');
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    })`);
    if (!storedForeignClub) throw new Error('Could not set foreign-club restore fixture');
    await click('Восстановить из браузера');
    await waitText('Восстановление отклонено: клуб отсутствует в тестовой базе');
    await assertNondefaultCareer('foreign club restore rejection');
    await send('Storage.clearDataForOrigin', {
      origin: new URL(targetUrl).origin, storageTypes: 'indexeddb',
    });
    console.log('PASS: checksum-valid foreign clubs cannot replace or crash the active M0 shell');

    // A backup whose payload changed without a matching checksum cannot replace
    // the just-recovered career, even after browser site data was removed.
    const corruptedJson = savedJson.replace('fictional-1', 'fictional-X');
    if (corruptedJson === savedJson) throw new Error('Missing synthetic corruption fixture');
    const invalidPath = join(profile, 'm0-corrupted.json');
    await writeFile(invalidPath, corruptedJson, 'utf8');
    await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [invalidPath] });
    await waitText('Импорт отклонён: INTEGRITY_ERROR');
    if (!await evaluate("Boolean(document.querySelector('.career-info'))")) {
      throw new Error('Corrupted backup import erased the active career');
    }
    await click('Сохранить в браузере');
    await waitText('Начальная карьера записана в IndexedDB');
    console.log('PASS: isolated browser recovers from cleared IndexedDB through file import');

    // A real application-process restart with the SAME isolated profile must
    // preserve the committed revision-0 save. InPrivate mode is tested separately.
    void send('Browser.close').catch(() => {});
    await until(
      () => browser.exitCode !== null || browser.signalCode !== null,
      'graceful Chrome/Edge process exit', 15_000,
    );
    socket?.close();
    ({ browser, port } = await startBrowser(profile));
    const secondTarget = await until(async () => {
      const response = await fetch('http://127.0.0.1:' + port + '/json/list');
      if (!response.ok) return null;
      const pages = await response.json();
      return pages.find(page => page.type === 'page' && page.webSocketDebuggerUrl);
    }, 'second Chrome/Edge page target');
    socket = await openSocket(secondTarget.webSocketDebuggerUrl);
    send = cdpClient(socket);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: targetUrl });
    await waitText('Начало карьеры');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await assertNondefaultCareer('normal profile restore');
    console.log('PASS: initial M0 career survives complete browser restart with same profile');


    // Simulate an IndexedDB open quota rejection in a real browser process.
    // This validates UI/error recovery, not real disk-quota or eviction behavior.
    await evaluate(`(() => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: {
        open() {
          const request = { error: new DOMException('Full', 'QuotaExceededError') };
          queueMicrotask(() => request.onerror?.());
          return request;
        }
      } });
      return true;
    })()`);
    await click('Сохранить в браузере');
    await waitText('Недостаточно места в хранилище браузера');
    if (!await evaluate("Boolean(document.querySelector('.career-info'))")) {
      throw new Error('Active career lost after simulated storage quota rejection');
    }

    // A blocked/disabled storage API must not silently drop the open career.
    await evaluate("(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined }); return true; })()");
    await click('Сохранить в браузере');
    await waitText('Сохранение отклонено: UNAVAILABLE');
    const stillActive = await evaluate("Boolean(document.querySelector('.career-info'))");
    if (!stillActive) throw new Error('Active career lost after IndexedDB became unavailable');

    console.log('PASS: browser initial career survives reload, duplicate save, and unavailable storage');
  } finally {
    socket?.close();
    browser.kill();
    await delay(500);
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 500 });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

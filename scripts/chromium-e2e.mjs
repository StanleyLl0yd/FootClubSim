#!/usr/bin/env node
// Chromium DevTools Protocol smoke: native browser, no DOM emulator or extra packages.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { exercisePlayableSeason } from './playable-season-ui.mjs';

const executable = process.argv[2];
const targetUrl = process.argv[3] ?? 'http://127.0.0.1:4173/';
const fullSeason = process.argv[4] === '--playable-season';
const privateFlag = fullSeason ? null : process.argv[4] ?? null;
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
    }, fullSeason && method === 'Runtime.evaluate' ? 10 * 60_000 : 20_000);
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
        const button = Array.from(document.querySelectorAll(${JSON.stringify(label === 'Рассчитать матч' ? '.technical-tests button' : 'button')})).find(
          element => element.textContent.trim() === ${JSON.stringify(label)}
        );
        if (!button || button.disabled) return false;
        const details = button.closest('details.technical-tests');
        if (details) details.open = true;
        button.click();
        return true;
      })()`);
      if (found !== true) throw new Error('Unavailable browser button: ' + label);
    }

    async function clickSeason(label) {
      const found = await evaluate(`(() => {
        const button = Array.from(document.querySelectorAll('.season-panel button'))
          .find(element => element.textContent.trim() === ${JSON.stringify(label)});
        if (!button || button.disabled) return false;
        button.click();
        return true;
      })()`);
      if (found !== true) throw new Error('Unavailable season button: ' + label);
    }
    async function setupManager(name, custom = false) {
      const selected = await evaluate(`(() => {
        const input = document.querySelector('#manager-name');
        if (!input || !document.querySelector('#club-select')?.disabled) return false;
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setValue.call(input, ${JSON.stringify(name)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (${custom}) document.querySelectorAll('input[name=manager-origin]')[2].click();
        return true;
      })()`);
      if (!selected) throw new Error('Club selection opened before manager confirmation');
      let biography;
      if (custom) {
        async function setSkill(key, value) {
          const changed = await evaluate(`(() => {
            const input = document.querySelector(${JSON.stringify('#manager-skill-' + key)});
            if (!input) return false;
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
              .call(input, ${JSON.stringify(value)});
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          })()`);
          if (!changed) throw new Error('Custom skill control missing: ' + key);
        }
        await setSkill('tacticalKnowledge', '15');
        await waitText('Снимите очков: 5');
        const blocked = await evaluate(`Array.from(document.querySelectorAll('button'))
          .find(button => button.textContent.trim() === 'Показать биографию')?.disabled`);
        if (!blocked) throw new Error('Over-budget custom manager can be confirmed');
        await setSkill('mediaCommunication', '5');
        await waitText('Осталось распределить очков: 0');
      }
      await click('Показать биографию');
      if (custom) {
        const profile = () => evaluate(`({
          biography: document.querySelector('.manager-timeline')?.textContent,
          skills: Array.from(document.querySelectorAll('.manager-skills input')).map(input => input.value),
        })`);
        const before = await profile();
        await click('Сгенерировать заново');
        const after = await profile();
        if (!after.biography || before.biography === after.biography ||
            JSON.stringify(before.skills) !== JSON.stringify(after.skills))
          throw new Error('Biography regeneration lost its independence from skills');
        biography = after.biography;
      }
      await click('Подтвердить тренера');
      await waitText('Тренер подтверждён. Теперь выберите клуб.');
      return biography;
    }

    await send('Page.navigate', { url: targetUrl });
    if (fullSeason) {
      await exercisePlayableSeason({
        evaluate,
        reload: () => send('Page.reload', { ignoreCache: true }),
        browser: process.platform + ' ' + executable.split(/[\\/]/u).at(-1),
        download: async ({ click, waitPage, filename }) => {
          await send('Browser.setDownloadBehavior', {
            behavior: 'allow', downloadPath: profile, eventsEnabled: true,
          });
          await click('Скачать полную карьеру');
          await waitPage('Полный архив создан: стартовая карьера', 10 * 60_000);
          const path = join(profile, filename);
          const json = await until(async () => {
            const contents = await readFile(path, 'utf8');
            return contents.endsWith('}') ? contents : null;
          }, 'native browser full-season archive download');
          return { filename, json, path };
        },
        importArchive: async ({ path, filename, json }) => {
          let uploadPath = path;
          if (!uploadPath) {
            if (filename !== 'footclubsim-tampered-full-career.json' ||
                typeof json !== 'string')
              throw new Error('Invalid synthetic corrupt-archive test input');
            uploadPath = join(profile, filename);
            await writeFile(uploadPath, json, 'utf8');
          }
          const doc = await send('DOM.getDocument');
          const input = await send('DOM.querySelector', {
            nodeId: doc.root.nodeId, selector: '#import-full-file',
          });
          if (!input.nodeId) throw new Error('Full-career input unavailable');
          await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [uploadPath] });
        },
      });
      return;
    }
    const body = await waitText('Начните свою карьеру');
    for (const text of ['Календарь', 'Сохранения', '368', '240']) {
      if (!body.includes(text)) throw new Error('Missing M0 UI text: ' + text);
    }

    // The real player-facing preview starts with approved fictional clubs.
    // Old M0 fixtures remain available only through the technical pack mode.
    if (!privateFlag) {
      const managerName = 'Тренер Проверки';
      const biography = await setupManager(managerName, true);
      const verifyManager = async () => {
        const restored = await evaluate(`({
          manager: document.querySelector('.manager-saved summary')?.textContent,
          biography: document.querySelector('.manager-saved .manager-timeline')?.textContent,
        })`);
        if (!restored.manager?.includes(managerName) || restored.biography !== biography)
          throw new Error('Saved career changed its manager or confirmed biography');
      };
      const initialClub = await evaluate(
        "document.querySelector('#club-select')?.value");
      if (initialClub !== 'lp-nadir') {
        throw new Error('Approved Liga Prikolov was not the default club pack');
      }
      await click('Создать стартовую карьеру');
      await waitText('Карьера создана. При запуске сезона она автоматически сохранится в браузере.');
      await click('Сохранить в браузере');
      await waitText('Начальная карьера записана в IndexedDB');
      if(!(await evaluate("Boolean(document.querySelector('#import-full-file'))")))
        throw new Error('Full backup import is absent from player UI');
      await clickSeason('Начать или продолжить сезон');
      await waitText('Сезон проверен и загружен. Сыграно матчей: 0 из 240.');
      const overview=await evaluate(`(() => ({
        squad: document.querySelectorAll('.season-squad tbody tr').length,
        clubFixtures: document.querySelectorAll('.season-own-calendar li').length,
        club: document.querySelector('.season-club-summary')?.textContent ?? '',
      }))()`);
      if(overview.squad!==23||overview.clubFixtures!==30||
          !overview.club.includes('Надир')) {
        throw new Error('Player cannot inspect club roster and 30-match calendar');
      }
      await clickSeason('Настроить стартовый состав');
      const eleven=await evaluate(
        "document.querySelectorAll('.season-xi-grid input:checked').length");
      if(eleven!==11)throw new Error('Manual XI default is invalid');
      const formationShown=await evaluate(
        "document.querySelector('#season-formation')?.value");
      if(formationShown!=='4-2-3-1')
        throw new Error('Default formation selection missing');
      // Prevent fields, formation pitch or labels from overlapping after
      // resizing the same real browser to mobile, tablet and desktop widths.
      for(const width of [390,768,1280]){
        await send('Emulation.setDeviceMetricsOverride',{
          width,height:900,deviceScaleFactor:1,mobile:false,
        });
        const layout=await evaluate(`(() => {
          const root=document.querySelector('.season-substitution');
          const labels=[...root.querySelectorAll('.season-tactics-grid > label')];
          const box=node=>node.getBoundingClientRect();
          const intersects=(a,b)=>{
            const x=box(a),y=box(b);
            return x.left<y.right-1&&y.left<x.right-1&&
              x.top<y.bottom-1&&y.top<x.bottom-1;
          };
          const controls=labels.map(label=>label.querySelector('select,input'));
          const outside=labels.some((label,index)=>{
            const a=box(label),b=box(controls[index]);
            return b.left<a.left-1||b.right>a.right+1;
          });
          return{
            overlap:labels.some((label,index)=>labels.slice(index+1)
              .some(other=>intersects(label,other))),
            outside,
            overflow:document.documentElement.scrollWidth>window.innerWidth+2,
            pitch:root.querySelector('.season-formation-pitch')
              .getBoundingClientRect().width,
            grid:root.querySelector('.season-xi-grid')
              .getBoundingClientRect().width,
          };
        })()`);
        if(layout.overlap||layout.outside||layout.overflow||
            layout.pitch<=0||layout.grid<=0)
          throw new Error('XI layout overlap at '+width+'px: '+
            JSON.stringify(layout));
      }
      await send('Emulation.clearDeviceMetricsOverride');
      await clickSeason('Рассчитать матч');
      await waitText('Стартовый состав и тактика выбраны тренером');
      await waitText('Результат рассчитан. Подтвердите запись');
      await clickSeason('Подтвердить и сохранить');
      const firstCommit=await until(async()=>{
        const value=await evaluate(
          "document.querySelector('.season-panel > p[role=status]')?.innerText ?? ''");
        if(value.includes('Запись не подтверждена')||
           value.includes('Автоматический расчёт не завершён'))
          throw new Error('Manual XI commit failed: '+value);
        const own=await evaluate(
          "document.querySelectorAll('.season-own-calendar .season-played').length");
        return own===1&&value.includes('Теперь очередь вашего клуба')?
          value:null;
      },'managed XI commit and automatic opponents');
      if(!firstCommit.includes('Теперь очередь вашего клуба'))
        throw new Error('Automatic opponent calculation did not complete');
      const firstSeasonRevision=await evaluate(
        "Number(document.querySelector('.season-progress')?.value)");
      if(firstSeasonRevision<=1||firstSeasonRevision>=240)
        throw new Error('Opponent fixtures were not automatically committed');
      const reportMatches=await evaluate(
        "document.querySelectorAll('.season-match-centre select option').length");
      if(reportMatches!==1)
        throw new Error('First own match lacks a persisted report');
      const shotsVisible=await evaluate(
        "document.querySelectorAll('.season-report-stat').length");
      if(shotsVisible!==7)
        throw new Error('Verified match statistics not rendered');

      await send('Page.reload', { ignoreCache: true });
      await waitText('Создайте тренера, выберите клуб');
      const ligaId = await until(async () => evaluate(`(() => {
        const select = document.querySelector('#career-saved-select');
        if (!select) return null;
        const option = Array.from(select.options).find(
          value => value.value.startsWith('lp-career-'));
        if (!option) return null;
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype, 'value').set;
        setter.call(select, option.value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return option.value;
      })()`), 'saved Liga Prikolov career listing');
      if (!ligaId) throw new Error('Liga Prikolov save not discoverable');
      await click('Восстановить из браузера');
      await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
      await verifyManager();
      const restoredClub = await evaluate(
        "document.querySelector('#club-select')?.value");
      if (restoredClub !== 'lp-nadir') {
        throw new Error('Approved fictional club not restored');
      }
      await clickSeason('Начать или продолжить сезон');
      await waitText('Сезон проверен и загружен. Сыграно матчей: '+
        firstSeasonRevision+' из 240.');
      console.log('PASS: approved Liga Prikolov synthetic club career persisted and restored');

      // A downloaded full archive must bring back the ACTUAL v188 season
      // after deleting BOTH underlying databases, not merely the M0 header.
      await send('Browser.setDownloadBehavior',{
        behavior:'allow',downloadPath:profile,eventsEnabled:true,
      });
      await click('Скачать полную карьеру');
      await waitText('Полный архив создан: стартовая карьера');
      const fullPath=join(profile,'footclubsim-'+ligaId+'-full-career.json');
      const fullJson=await until(async()=>{
        const contents=await readFile(fullPath,'utf8');
        return contents.includes('footclubsim-v188-full-career')?
          contents:null;
      },'full source journal actual browser download');
      const fullEnvelope=JSON.parse(fullJson);
      const savedFullJournal=JSON.parse(fullEnvelope.journalPayload);
      const savedManager = JSON.parse(JSON.parse(fullEnvelope.initialPayload).payload).managerProfile;
      if (savedManager?.skills.tacticalKnowledge !== 15 ||
          savedManager.skills.mediaCommunication !== 5 || savedManager.origin !== 'custom')
        throw new Error('Full archive lost custom manager skills');
      if(savedFullJournal.entries[0]?.source?.managedXI?.tactics?.formation!==
           '4-2-3-1')
        throw new Error('Default formation not saved in v188 full archive');
      if(savedFullJournal.revision!==firstSeasonRevision||
         fullEnvelope.careerId!==ligaId||
         savedFullJournal.entries.length!==firstSeasonRevision)
        throw new Error('Export skipped automatically played fixtures or changed career ID');
      await send('Storage.clearDataForOrigin',{
        origin:new URL(targetUrl).origin,storageTypes:'indexeddb',
      });
      await send('Page.reload',{ignoreCache:true});
      await waitText('Создайте тренера, выберите клуб');
      const fullDoc=await send('DOM.getDocument');
      const fullInput=await send('DOM.querySelector',{
        nodeId:fullDoc.root.nodeId,selector:'#import-full-file',
      });
      if(!fullInput.nodeId)throw new Error('Full-archive import input missing');
      await send('DOM.setFileInputFiles',{
        nodeId:fullInput.nodeId,files:[fullPath],
      });
      await waitText('Полная карьера восстановлена. Сыграно матчей: '+
        firstSeasonRevision+' из 240.');
      await verifyManager();
      await clickSeason('Начать или продолжить сезон');
      await waitText('Сезон проверен и загружен. Сыграно матчей: '+
        firstSeasonRevision+' из 240.');
      const corruptedFull={...fullEnvelope,journalChecksum:'0'.repeat(64)};
      const corruptedPath=join(profile,'full-career-corrupted.json');
      await writeFile(corruptedPath,JSON.stringify(corruptedFull),'utf8');
      await send('DOM.setFileInputFiles',{
        nodeId:fullInput.nodeId,files:[corruptedPath],
      });
      await waitText('Импорт полного архива отклонён:');
      const stillOne=await evaluate(
        "document.querySelectorAll('.season-own-calendar .season-played').length");
      if(stillOne!==1)
        throw new Error('Tampered full archive damaged active season');
      console.log('PASS: native full-v188 archive roundtrip across both IndexedDB stores, tamper rejected');


      // A second independently saved Liga career must not overwrite
      // either the first career or its already played match.
      await click('Новая карьера');
      await setupManager('Второй тренер');
      await click('Создать стартовую карьеру');
      await waitText('Карьера создана. При запуске сезона она автоматически сохранится в браузере.');
      await click('Сохранить в браузере');
      await waitText('Начальная карьера записана в IndexedDB');
      const bothPresent = await until(async () => evaluate(`(() => {
        const ids = Array.from(document.querySelector('#career-saved-select')?.options ?? [])
          .map(option => option.value).filter(value => value.startsWith('lp-career-'));
        return ids.length === 2 && new Set(ids).size === 2;
      })()`), 'two independent fictional-club career saves');
      if (!bothPresent) throw new Error('Independent Liga career overwritten');
      await send('Page.reload', { ignoreCache: true });
      await waitText('Создайте тренера, выберите клуб');
      const firstStillAvailable = await until(async () => evaluate(`(() => {
        const select = document.querySelector('#career-saved-select');
        if (!select || !Array.from(select.options).some(option => option.value === ${JSON.stringify(ligaId)}))
          return false;
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype, 'value').set;
        setter.call(select, ${JSON.stringify(ligaId)});
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`), 'first saved career after independent save');
      if (!firstStillAvailable) throw new Error('First Liga career was lost');
      await click('Восстановить из браузера');
      await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
      await clickSeason('Начать или продолжить сезон');
      await waitText('Сезон проверен и загружен. Сыграно матчей: '+
        firstSeasonRevision+' из 240.');
      console.log('PASS: two independent Liga careers coexist without losing first season history');
      await click('Новая карьера');
      await setupManager('Тренер деморежима');
      const clubChanged=await evaluate(`(() => {
        const select=document.querySelector('#club-select');
        if(!select || !Array.from(select.options).some(x=>x.value==='lp-vagon'))
          return false;
        const setter=Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,'value').set;
        setter.call(select,'lp-vagon');
        select.dispatchEvent(new Event('change',{bubbles:true}));
        return true;
      })()`);
      if(!clubChanged)throw new Error('Cannot select another fictional club');
      await waitText('Выбран другой клуб. Создайте новую карьеру');
      if(await evaluate("Boolean(document.querySelector('.career-info'))"))
        throw new Error('Old active career remained attached to another club');
      const stillSaved=await evaluate(`(() =>
        Array.from(document.querySelector('#career-saved-select')?.options ?? [])
          .filter(option=>option.value.startsWith('lp-career-')).length
      )()`);
      if(stillSaved!==2)
        throw new Error('Changing club unexpectedly erased saved careers');
      console.log('PASS: switching clubs never mutates another active career');

    }
    if (privateFlag) await setupManager('Тренер деморежима');
    const packSwitched = await evaluate(`(() => {
      const select = document.querySelector('#pack-select');
      if (!select || !Array.from(select.options).some(x => x.value === 'demo'))
        return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'demo');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    if (!packSwitched) throw new Error('Legacy demonstration mode missing');
    await waitText('Старый синтетический набор сохраняется');
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
    await waitText('Карьера создана. При запуске сезона она автоматически сохранится в браузере.');
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
        await waitText('Эта карьера уже сохранена в браузере. Данные не перезаписывались.');
        await send('Page.reload', { ignoreCache: true });
        await waitText('Создайте тренера, выберите клуб');
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
    await waitText('Эта карьера уже сохранена в браузере. Данные не перезаписывались.');

    await send('Page.reload', { ignoreCache: true });
    await waitText('Создайте тренера, выберите клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await assertNondefaultCareer('normal profile restore');

    // Player-facing career: automatic opponent game, owned-team
    // halftime coaching decision, verified two-team table and durable reload.
    await clickSeason('Начать или продолжить сезон');
    await waitText('Теперь очередь вашего клуба. Остальные матчи сохранены.');
    if(await evaluate("Boolean(document.querySelector('.season-advance'))"))
      throw new Error('Opponent fixture not automatically finished on season open');
    const tablePlayed = await evaluate(`(() => {
      return Array.from(document.querySelectorAll('.season-table tbody tr'))
        .filter(row => Number(row.querySelectorAll('td')[1]?.textContent) === 1)
        .length;
    })()`);
    if (tablePlayed !== 2) {
      throw new Error('Automatic opponent fixture did not update both table rows');
    }
    await clickSeason('Настроить замену');
    await waitText('Замена в перерыве вашего матча');
    const seasonChoice = await evaluate(`(() => ({
      outgoing: document.querySelector('#season-sub-out')?.value,
      incoming: document.querySelector('#season-sub-in')?.value,
    }))()`);
    if (!seasonChoice.outgoing || !seasonChoice.incoming ||
        seasonChoice.outgoing === seasonChoice.incoming) {
      throw new Error('No valid manual halftime substitution available');
    }
    await clickSeason('Рассчитать с заменой');
    await waitText('Замена в перерыве включена в расчёт матча.');
    const scoreVisible = await evaluate(
      "document.querySelector('.season-preview-score')?.innerText ?? ''");
    if (!scoreVisible.includes(':')) {
      throw new Error('Player-facing v188 preview did not show a score');
    }
    await clickSeason('Подтвердить и сохранить');
    // The previous 'your turn' status may still be visible during async CAS.
    // Wait for both the committed managed match and the next opponent batch.
    const secondSeasonRevision=await until(async()=>{
      const result=await evaluate(`(() => ({
        revision: Number(document.querySelector('.season-progress')?.value),
        own: document.querySelectorAll('.season-own-calendar .season-played').length,
        status: document.querySelector('.season-panel > p[role=status]')?.textContent ?? '',
      }))()`);
      if(result.status.startsWith('Автоматический расчёт не завершён'))
        throw new Error(result.status);
      return result.own===1&&result.revision>2&&
        result.status.startsWith('Теперь очередь вашего клуба.')?
          result.revision:null;
    },'owned halftime result and automatic opponents complete');
    const storedChange = await evaluate(`new Promise((resolve, reject) => {
      const opening = indexedDB.open('footclubsim-m1-v188', 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction('full-league-source-journals', 'readonly');
        const request = tx.objectStore('full-league-source-journals')
          .get('m0-ui-initial-career');
        let result = null;
        request.onsuccess = () => {
          const journal = request.result;
          result = {
            revision: journal?.revision,
            change: journal?.entries?.[1]?.source?.plannedCommands
              ?.find(cmd => cmd.kind === 'substitute-normal') ?? null,
          };
        };
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    })`);
    if (storedChange?.revision !== secondSeasonRevision ||
        storedChange.change?.outPlayerId !== seasonChoice.outgoing ||
        storedChange.change?.inPlayerId !== seasonChoice.incoming ||
        storedChange.change?.elapsedSeconds !== 2700) {
      throw new Error('Player halftime choice not saved in canonical league');
    }
    await send('Page.reload', { ignoreCache: true });
    await waitText('Создайте тренера, выберите клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await clickSeason('Начать или продолжить сезон');
    await waitText('Сезон проверен и загружен. Сыграно матчей: '+
      secondSeasonRevision+' из 240.');
    await assertNondefaultCareer('v188 game season CAS and reload');
    console.log('PASS: own halftime substitution, opponent autopilot, table and reload');

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
    await waitText('Создайте тренера, выберите клуб');
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
    const selectedTime = await evaluate(`(() => {
      const select = document.querySelector('#m1-substitution-checkpoint');
      if (!select || !Array.from(select.options).some(option => option.value === '900')) {
        return false;
      }
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype, 'value').set;
      setter.call(select, '900');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value === '900';
    })()`);
    if (!selectedTime) throw new Error('Missing virtual substitution time selector');
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
        applied?.inPlayerId !== participants.in ||
        applied?.elapsedSeconds !== 900 ||
        applied?.stoppage !== 'referee-authorized') {
      throw new Error('Browser CAS did not preserve the user-selected substitution');
    }
    await send('Page.reload', { ignoreCache: true });
    await waitText('Создайте тренера, выберите клуб');
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
    await waitText('Создайте тренера, выберите клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await click('Начать или продолжить M1');
    await waitText('Сохранено матчей выбранного клуба: 3 из 30.');
    await assertNondefaultCareer('M1 seeded internal referee browser restart');
    console.log('PASS: browser persisted modelled in-game referee source in CAS revision 3');

    // Verify a goalkeeper can be legally replaced by a named reserve keeper
    // with the same v8 replay, virtual clock and browser CAS path.
    const goalkeeperScenario = await evaluate(`(() => {
      const select = document.querySelector('#m1-playtest-scenario');
      if (!select) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'normal-substitution');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value === 'normal-substitution';
    })()`);
    if (!goalkeeperScenario) throw new Error('Goalkeeper substitution scenario unavailable');
    await waitText('Уходит с поля');
    const oldBench = await evaluate(
      "document.querySelector('#m1-player-in')?.options[0]?.value ?? ''");
    const keeperOut = await evaluate(`(() => {
      const out = document.querySelector('#m1-player-out');
      if (!out || !out.options.length) return null;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype, 'value').set;
      setter.call(out, out.options[0].value);
      out.dispatchEvent(new Event('change', { bubbles: true }));
      return out.value;
    })()`);
    if (!keeperOut) throw new Error('Starting goalkeeper not selectable');
    const keeperIn = await until(async () => {
      const candidate = await evaluate(
        "document.querySelector('#m1-player-in')?.options[0]?.value ?? ''");
      return candidate && candidate !== oldBench ? candidate : null;
    }, 'reserve goalkeeper in the named bench');
    const keeperTime = await evaluate(`(() => {
      const select = document.querySelector('#m1-substitution-checkpoint');
      if (!select) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype, 'value').set;
      setter.call(select, '2700');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return select.value === '2700';
    })()`);
    if (!keeperTime) throw new Error('Goalkeeper half-time selector missing');
    await click('Рассчитать матч');
    await waitText('Матч рассчитан. Результат пока не записан.');
    await click('Подтвердить и сохранить матч');
    await waitText('Матч подтверждён, независимо перепроверен и сохранён');
    const keeperSource = await evaluate(`new Promise((resolve, reject) => {
      const opening = indexedDB.open('footclubsim-m1-v8', 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction('result-journals', 'readonly');
        const request = tx.objectStore('result-journals').get('m0-ui-initial-career');
        let result = null;
        request.onsuccess = () => {
          const journal = request.result;
          result = journal?.revision === 4 ?
            journal.results[3]?.source.plannedCommands[0] : null;
        };
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    })`);
    if (keeperSource?.outPlayerId !== keeperOut ||
        keeperSource?.inPlayerId !== keeperIn ||
        keeperSource?.elapsedSeconds !== 2700 ||
        keeperSource?.stoppage !== 'half-time') {
      throw new Error('Native CAS did not retain keeper substitution');
    }
    await send('Page.reload', { ignoreCache: true });
    await waitText('Создайте тренера, выберите клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await click('Начать или продолжить M1');
    await waitText('Сохранено матчей выбранного клуба: 4 из 30.');
    await assertNondefaultCareer('M1 keeper substitution browser restart');
    console.log('PASS: keeper substitution retained through actual browser restart');

    // Separate v120 namespace: actual native transaction + restart replay.
    await click('Создать или загрузить отдельный v120');
    await waitText('v120: проверен и загружен отдельный журнал, матчей: 0.');
    await click('Рассчитать и сохранить следующий матч v120');
    await waitText('v120: плотный матч атомарно записан, 270 PRNG draws, ревизия 1 из 30.');
    const denseEvidence = await evaluate(`new Promise((resolve, reject) => {
      const opening = indexedDB.open('footclubsim-m1-v120', 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction('dense-result-journals', 'readonly');
        const get = tx.objectStore('dense-result-journals').get('m0-ui-initial-career');
        let evidence = null;
        get.onsuccess = () => {
          const journal = get.result;
          evidence = journal ? {
            schemaVersion: journal.schemaVersion, revision: journal.revision,
            draws: journal.entries[0]?.result?.rngDraws,
            denseEvents: journal.entries[0]?.result?.events?.length,
            v8Independent: journal.entries[0]?.source?.prematch?.catalog === undefined,
          } : null;
        };
        tx.oncomplete = () => { db.close(); resolve(evidence); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    })`);
    if (denseEvidence?.schemaVersion !== 120 ||
        denseEvidence?.revision !== 1 ||
        denseEvidence?.draws !== 270 ||
        !Number.isSafeInteger(denseEvidence?.denseEvents) ||
        denseEvidence.denseEvents < 1 ||
        denseEvidence?.v8Independent !== true) {
      throw new Error('v120 dense native journal not atomically stored');
    }
    await send('Page.reload', { ignoreCache: true });
    await waitText('Создайте тренера, выберите клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await click('Создать или загрузить отдельный v120');
    await waitText('v120: проверен и загружен отдельный журнал, матчей: 1.');
    await assertNondefaultCareer('v120 independent dense journal browser restart');
    console.log('PASS: native v120 replay-CAS survives browser restart without mutating v8');

    await click('Рассчитать и сохранить следующий матч v120');
    await waitText('v120: плотный матч атомарно записан, 270 PRNG draws, ревизия 2 из 30.');
    await send('Page.reload', { ignoreCache: true });
    await waitText('Создайте тренера, выберите клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await click('Создать или загрузить отдельный v120');
    await waitText('v120: проверен и загружен отдельный журнал, матчей: 2.');
    console.log('PASS: separate v120 dense career advances and replays successive fixtures');

    // Commit a real generated v124 virtual-referee fixture through the React
    // button and verify its separate v120 CAS journal across a browser reload.
    await click('Рассчитать следующий матч с виртуальным арбитром');
    await waitText('v120: виртуальный арбитр, плотный матч атомарно записан, 270 PRNG draws, ревизия 3 из 30.');
    const virtualDenseEvidence = await evaluate(`new Promise((resolve, reject) => {
      const opening = indexedDB.open('footclubsim-m1-v120', 1);
      opening.onerror = () => reject(opening.error);
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction('dense-result-journals', 'readonly');
        const req = tx.objectStore('dense-result-journals').get('m0-ui-initial-career');
        let evidence = null;
        req.onsuccess = () => {
          const journal = req.result;
          const entry = journal?.entries?.[2];
          evidence = journal?.revision === 3 && entry ? {
            commandId: entry.commandId, fixtureId: entry.fixtureId,
            commands: entry.source.plannedCommands,
            rngDraws: entry.result.rngDraws,
          } : null;
        };
        tx.oncomplete = () => { db.close(); resolve(evidence); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    })`);
    if (!virtualDenseEvidence ||
        virtualDenseEvidence.commandId !==
          'v124-virtual-referee-' + virtualDenseEvidence.fixtureId ||
        virtualDenseEvidence.rngDraws !== 270 ||
        !Array.isArray(virtualDenseEvidence.commands) ||
        virtualDenseEvidence.commands.some(command =>
          !['caution','direct-red','injury-withdrawal'].includes(command.kind) ||
          !['trusted-referee','trusted-medical'].includes(command.origin))) {
      throw new Error('Native v120 CAS did not preserve exact virtual referee source');
    }
    await send('Page.reload', { ignoreCache: true });
    await waitText('Создайте тренера, выберите клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
    await click('Создать или загрузить отдельный v120');
    await waitText('v120: проверен и загружен отдельный журнал, матчей: 3.');
    const holdView = await evaluate(
      "document.querySelector('[aria-label=\"Вымышленные межматчевые ограничения\"]')?.innerText ?? ''");
    if (!holdView.includes('Проверено вымышленных событий: ' +
        virtualDenseEvidence.commands.length) ||
        !holdView.includes('Активных ограничений:')) {
      throw new Error('v126 hold projection missing after native browser restart');
    }
    await assertNondefaultCareer('v124 fictional referee dense journal browser restart');
    if (virtualDenseEvidence.commands.length > 0) {
      await click('Рассчитать и сохранить следующий матч v120');
      await waitText('v120: сохранение отклонено: PREVIOUS_EXCEPTION_NOT_SUPPORTED');

      // Manual fictional continuation retains source-verified controlled-club
      // bans and withdrawals, never inferring real opponent medical history.
      const held=new Set(),yellows=new Map();
      for(const command of virtualDenseEvidence.commands){
        if(command.teamId!=='fictional-2')continue;
        if(command.kind==='direct-red'||command.kind==='injury-withdrawal')
          held.add(command.playerId);
        if(command.kind==='caution'){
          const count=(yellows.get(command.playerId)??0)+1;
          yellows.set(command.playerId,count);
          if(count===2)held.add(command.playerId);
        }
      }
      await click('Продолжить с вымышленными ограничениями');
      await waitText('v120: модельное продолжение, плотный матч атомарно записан, 270 PRNG draws, ревизия 4 из 30.');
      const continued=await evaluate(`new Promise((resolve,reject)=>{
        const opening=indexedDB.open('footclubsim-m1-v120',1);
        opening.onerror=()=>reject(opening.error);
        opening.onsuccess=()=>{
          const db=opening.result;
          const tx=db.transaction('dense-result-journals','readonly');
          const get=tx.objectStore('dense-result-journals').get('m0-ui-initial-career');
          let result=null;
          get.onsuccess=()=>{
            const journal=get.result,entry=journal?.entries?.[3];
            if(journal?.revision===4&&entry){
              const source=entry.source.prematch;
              result={revision:4,commandId:entry.commandId,fixtureId:entry.fixtureId,
                lineup:source.fixture.homeClubId==='fictional-2'?
                  source.homeLineup:source.awayLineup};
            }
          };
          tx.oncomplete=()=>{db.close();resolve(result);};
          tx.onabort=()=>{db.close();reject(tx.error);};
        };
      })`);
      if(!continued||continued.commandId!==
          'v128-fictional-continuation-'+continued.fixtureId||
          !Array.isArray(continued.lineup?.starters)||
          !Array.isArray(continued.lineup?.bench)||
          [...held].some(id=>continued.lineup.starters.includes(id)||
            continued.lineup.bench.includes(id))){
        throw new Error('Manual v128 continuation bypassed a source-verified hold');
      }
      await send('Page.reload',{ignoreCache:true});
      await waitText('Создайте тренера, выберите клуб');
      await click('Восстановить из браузера');
      await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
      await click('Создать или загрузить отдельный v120');
      await waitText('v120: проверен и загружен отдельный журнал, матчей: 4.');
      await assertNondefaultCareer('v128 source-held manual continuation restart');
      console.log('PASS: manual v128 next-match XI/bench excludes verified holds');

      // A second generated virtual-referee fixture must use the same exact
      // v124 source namespace after source-verified v128 held-player admission.
      await click('Следующий матч с виртуальным арбитром и ограничениями');
      await waitText('v120: повторный виртуальный арбитр, плотный матч атомарно записан, 270 PRNG draws, ревизия 5 из 30.');
      const secondVirtual=await evaluate(`new Promise((resolve,reject)=>{
        const opening=indexedDB.open('footclubsim-m1-v120',1);
        opening.onerror=()=>reject(opening.error);
        opening.onsuccess=()=>{
          const db=opening.result,tx=db.transaction('dense-result-journals','readonly');
          const get=tx.objectStore('dense-result-journals').get('m0-ui-initial-career');
          let evidence=null;
          get.onsuccess=()=>{
            const journal=get.result,entry=journal?.entries?.[4];
            if(journal?.revision===5&&entry){
              const source=entry.source.prematch;
              evidence={revision:5,fixtureId:entry.fixtureId,
                commandId:entry.commandId,commands:entry.source.plannedCommands,
                rngDraws:entry.result.rngDraws,
                lineup:source.fixture.homeClubId==='fictional-2'?
                  source.homeLineup:source.awayLineup};
            }
          };
          tx.oncomplete=()=>{db.close();resolve(evidence);};
          tx.onabort=()=>{db.close();reject(tx.error);};
        };
      })`);
      if(!secondVirtual||
          secondVirtual.commandId!=='v124-virtual-referee-'+secondVirtual.fixtureId||
          secondVirtual.rngDraws!==270||
          !Array.isArray(secondVirtual.commands)||
          [...held].some(id=>secondVirtual.lineup.starters.includes(id)||
            secondVirtual.lineup.bench.includes(id))){
        throw new Error('Repeated virtual referee bypassed historical hold or source namespace');
      }
      await send('Page.reload',{ignoreCache:true});
      await waitText('Создайте тренера, выберите клуб');
      await click('Восстановить из браузера');
      await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
      await click('Создать или загрузить отдельный v120');
      await waitText('v120: проверен и загружен отдельный журнал, матчей: 5.');
      await assertNondefaultCareer('v130 repeated virtual referee restart');
      console.log('PASS: second virtual referee source verified after injury/discipline holds');

      // The human manager chooses an actual named outfield player, reserve,
      // and virtual time on the dense 100-second source, preserving both
      // the historic referee holds and exact v120 source-CAS identity.
      const denseOut=await evaluate(`(() => {
        const select=document.querySelector('#m1-dense-sub-out');
        if(!select||select.options.length<3)return null;
        const setter=Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,'value').set;
        setter.call(select,select.options[select.options.length-1].value);
        select.dispatchEvent(new Event('change',{bubbles:true}));
        return select.value;
      })()`);
      if(!denseOut)throw new Error('Dense manager outfield chooser missing');
      const denseIn=await until(async()=>{
        const id=await evaluate(`(() => {
          const select=document.querySelector('#m1-dense-sub-in');
          if(!select||!select.options.length)return '';
          const setter=Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,'value').set;
          setter.call(select,select.options[select.options.length-1].value);
          select.dispatchEvent(new Event('change',{bubbles:true}));
          return select.value;
        })()`);
        return id||null;
      },'eligible dense selected reserve');
      const checkpointChosen=await evaluate(`(() => {
        const select=document.querySelector('#m1-dense-sub-time');
        if(!select||!Array.from(select.options).some(o=>o.value==='2700'))
          return false;
        const setter=Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,'value').set;
        setter.call(select,'2700');
        select.dispatchEvent(new Event('change',{bubbles:true}));
        return select.value==='2700';
      })()`);
      if(!checkpointChosen)throw new Error('Dense substitution clock missing');
      await click('Провести выбранную замену в плотном матче');
      await waitText('v120: выбранная замена, плотный матч атомарно записан, 270 PRNG draws, ревизия 6 из 30.');
      const denseSub=await evaluate(`new Promise((resolve,reject)=>{
        const opening=indexedDB.open('footclubsim-m1-v120',1);
        opening.onerror=()=>reject(opening.error);
        opening.onsuccess=()=>{
          const db=opening.result;
          const tx=db.transaction('dense-result-journals','readonly');
          const get=tx.objectStore('dense-result-journals').get('m0-ui-initial-career');
          let command=null;
          get.onsuccess=()=>{
            const journal=get.result;
            command=journal?.revision===6?
              journal.entries[5]?.source.plannedCommands[0]:null;
          };
          tx.oncomplete=()=>{db.close();resolve(command);};
          tx.onabort=()=>{db.close();reject(tx.error);};
        };
      })`);
      if(denseSub?.kind!=='substitute-normal'||
          denseSub?.outPlayerId!==denseOut||
          denseSub?.inPlayerId!==denseIn||
          denseSub?.elapsedSeconds!==2700||
          denseSub?.actor?.kind!=='player'||
          denseSub?.stoppage!=='half-time')
        throw new Error('Dense CAS lost manager-selected substitution participants/time');
      await send('Page.reload',{ignoreCache:true});
      await waitText('Создайте тренера, выберите клуб');
      await click('Восстановить из браузера');
      await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
      await click('Создать или загрузить отдельный v120');
      await waitText('v120: проверен и загружен отдельный журнал, матчей: 6.');
      await assertNondefaultCareer('v132 manager substitution with earlier holds');
      console.log('PASS: dense manager-selected legal substitute/time through source-CAS/restart');
      // Commit two distinct selected substitutions using the same native v120 CAS.
      const doubleChoice=await evaluate(`(() => {
        const a=document.querySelector('#m1-dense-sub-out');
        const b=document.querySelector('#m1-dense-sub-in');
        const c=document.querySelector('#m1-dense-sub-out-2');
        const d=document.querySelector('#m1-dense-sub-in-2');
        if(!a?.value||!b?.value||!c?.value||!d?.value)return null;
        if(a.value===c.value||b.value===d.value)return null;
        return {out1:a.value,in1:b.value,out2:c.value,in2:d.value};
      })()`);
      if(!doubleChoice)throw new Error('Second dense substitution chooser missing');
      await click('Провести две выбранные замены в плотном матче');
      await waitText('v120: две выбранные замены, плотный матч атомарно записан, 270 PRNG draws, ревизия 7 из 30.');
      const doubleStored=await evaluate(`new Promise((resolve,reject)=>{
        const opening=indexedDB.open('footclubsim-m1-v120',1);
        opening.onerror=()=>reject(opening.error);
        opening.onsuccess=()=>{
          const db=opening.result;
          const tx=db.transaction('dense-result-journals','readonly');
          const get=tx.objectStore('dense-result-journals').get('m0-ui-initial-career');
          let value=null;
          get.onsuccess=()=>{
            const journal=get.result;
            if(journal?.revision===7)value=journal.entries[6]?.source.plannedCommands;
          };
          tx.oncomplete=()=>{db.close();resolve(value);};
          tx.onabort=()=>{db.close();reject(tx.error);};
        };
      })`);
      if(!Array.isArray(doubleStored)||doubleStored.length!==2||
          doubleStored[0].outPlayerId!==doubleChoice.out1||
          doubleStored[0].inPlayerId!==doubleChoice.in1||
          doubleStored[1].outPlayerId!==doubleChoice.out2||
          doubleStored[1].inPlayerId!==doubleChoice.in2||
          doubleStored[0].commandId===doubleStored[1].commandId)
        throw new Error('Dense double-substitution source-CAS identity mismatch');
      await send('Page.reload',{ignoreCache:true});
      await waitText('Создайте тренера, выберите клуб');
      await click('Восстановить из браузера');
      await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
      await click('Создать или загрузить отдельный v120');
      await waitText('v120: проверен и загружен отдельный журнал, матчей: 7.');
      await assertNondefaultCareer('v136 two substitutions source-CAS/restart');
      console.log('PASS: double substitution source-replayed after native browser restart');

      // Commit a third named change and verify native journal source identity.
      const thirdChoice=await evaluate(`(() => {
        const out=document.querySelector('#m1-dense-multi-out-3');
        const incoming=document.querySelector('#m1-dense-multi-in-3');
        const time=document.querySelector('#m1-dense-multi-time-3');
        if(!out?.value||!incoming?.value||!time?.value)return null;
        return {out:out.value,incoming:incoming.value,time:Number(time.value)};
      })()`);
      if(!thirdChoice)throw new Error('Dense five-substitution chooser missing');
      await click('Провести 3–5 выбранных замен в плотном матче');
      await waitText('v120: от трёх до пяти замен, плотный матч атомарно записан, 270 PRNG draws, ревизия 8 из 30.');
      const multiStored=await evaluate(`new Promise((resolve,reject)=>{
        const opening=indexedDB.open('footclubsim-m1-v120',1);
        opening.onerror=()=>reject(opening.error);
        opening.onsuccess=()=>{
          const db=opening.result;
          const tx=db.transaction('dense-result-journals','readonly');
          const get=tx.objectStore('dense-result-journals').get('m0-ui-initial-career');
          let commands=null;
          get.onsuccess=()=>{
            const journal=get.result;
            if(journal?.revision===8)
              commands=journal.entries[7]?.source.plannedCommands;
          };
          tx.oncomplete=()=>{db.close();resolve(commands);};
          tx.onabort=()=>{db.close();reject(tx.error);};
        };
      })`);
      if(!Array.isArray(multiStored)||multiStored.length!==3||
          multiStored[2].outPlayerId!==thirdChoice.out||
          multiStored[2].inPlayerId!==thirdChoice.incoming||
          multiStored[2].elapsedSeconds!==thirdChoice.time)
        throw new Error('Dense third substitution source-CAS identity mismatch');
      await send('Page.reload',{ignoreCache:true});
      await waitText('Создайте тренера, выберите клуб');
      await click('Восстановить из браузера');
      await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
      await click('Создать или загрузить отдельный v120');
      await waitText('v120: проверен и загружен отдельный журнал, матчей: 8.');
      await assertNondefaultCareer('v138 third substitution CAS/restart');
      console.log('PASS: up-to-five normal substitution source-CAS/restart');

      // A previously introduced outfield substitute may legally be replaced.
      const substitutedSubstitute=await evaluate(`(() => {
        const secondIn=document.querySelector('#m1-dense-sub-in-2');
        const thirdOut=document.querySelector('#m1-dense-multi-out-3');
        const thirdTime=document.querySelector('#m1-dense-multi-time-3');
        if(!secondIn?.value||!thirdOut||!thirdTime||
            !Array.from(thirdOut.options).some(o=>o.value===secondIn.value)||
            !Array.from(thirdTime.options).some(o=>o.value==='2700'))
          return null;
        const setter=Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,'value').set;
        setter.call(thirdOut,secondIn.value);
        thirdOut.dispatchEvent(new Event('change',{bubbles:true}));
        setter.call(thirdTime,'2700');
        thirdTime.dispatchEvent(new Event('change',{bubbles:true}));
        return secondIn.value;
      })()`);
      if(!substitutedSubstitute)
        throw new Error('Incoming substitute not available for later replacement');
      await until(async()=>await evaluate(`(() => {
        return document.querySelector('#m1-dense-multi-out-3')?.value===
          ${JSON.stringify(substitutedSubstitute)} &&
          document.querySelector('#m1-dense-multi-time-3')?.value==='2700';
      })()`),'substitute-of-substitute selector state');
      await click('Провести 3–5 выбранных замен в плотном матче');
      await waitText('v120: от трёх до пяти замен, плотный матч атомарно записан, 270 PRNG draws, ревизия 9 из 30.');
      const reSubbed=await evaluate(`new Promise((resolve,reject)=>{
        const opening=indexedDB.open('footclubsim-m1-v120',1);
        opening.onerror=()=>reject(opening.error);
        opening.onsuccess=()=>{
          const db=opening.result;
          const tx=db.transaction('dense-result-journals','readonly');
          const get=tx.objectStore('dense-result-journals').get('m0-ui-initial-career');
          get.onsuccess=()=>{
            const journal=get.result;
            resolve(journal?.revision===9?journal.entries[8]?.source.plannedCommands:null);
          };
          get.onerror=()=>reject(get.error);
          tx.oncomplete=()=>db.close();
          tx.onabort=()=>{db.close();reject(tx.error);};
        };
      })`);
      if(!Array.isArray(reSubbed)||reSubbed.length!==3||
          reSubbed[1].inPlayerId!==substitutedSubstitute||
          reSubbed[2].outPlayerId!==substitutedSubstitute||
          reSubbed[2].elapsedSeconds!==2700)
        throw new Error('Substitute-of-substitute source was not committed');
      await send('Page.reload',{ignoreCache:true});
      await waitText('Создайте тренера, выберите клуб');
      await click('Восстановить из браузера');
      await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
      await click('Создать или загрузить отдельный v120');
      await waitText('v120: проверен и загружен отдельный журнал, матчей: 9.');
      await assertNondefaultCareer('replacement of previous substitute CAS/reload');
      console.log('PASS: substitute-of-substitute source CAS/reload');

      // Select two legal outfield reserves with the outgoing starter's
      // competition foreigner status; no mid-chain cap violations.
      const byPlayer=new Map(JSON.parse(JSON.parse(downloadedJson).payload)
        .catalog.players.map(p=>[p.id,p]));
      const firstCandidates=await evaluate(`Array.from(
        document.querySelector('#m1-dense-sub-out')?.options??[]
      ).map(option=>option.value)`);
      let firstIncoming=null,secondIncoming=null;
      for(const outgoing of firstCandidates){
        const starter=byPlayer.get(outgoing);
        if(!starter||starter.primaryPosition==='GK')continue;
        await evaluate(`(() => {
          const el=document.querySelector('#m1-dense-sub-out');
          const setter=Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,'value').set;
          setter.call(el,${JSON.stringify(outgoing)});
          el.dispatchEvent(new Event('change',{bubbles:true}));
        })()`);
        await delay(150);
        const options=await evaluate(`Array.from(
          document.querySelector('#m1-dense-sub-in')?.options??[]
        ).map(option=>option.value)`);
        const matching=options.filter(id=>{
          const p=byPlayer.get(id);
          return p?.primaryPosition!=='GK'&&
            p?.foreignerForCompetition===starter.foreignerForCompetition;
        });
        if(matching.length>=2){
          [firstIncoming,secondIncoming]=matching;
          break;
        }
      }
      if(!firstIncoming||!secondIncoming)
        throw new Error('No foreigner-cap-safe double-change candidate');
      const choseFirst=await evaluate(`(() => {
        const el=document.querySelector('#m1-dense-sub-in');
        if(!Array.from(el?.options??[])
          .some(x=>x.value===${JSON.stringify(firstIncoming)}))return false;
        const setter=Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,'value').set;
        setter.call(el,${JSON.stringify(firstIncoming)});
        el.dispatchEvent(new Event('change',{bubbles:true}));
        return true;
      })()`);
      if(!choseFirst)throw new Error('First legal reserve not selectable');
      await until(async()=>await evaluate(`(() => {
        const second=document.querySelector('#m1-dense-sub-out-2');
        return document.querySelector('#m1-dense-sub-in')?.value===
          ${JSON.stringify(firstIncoming)}&&
          Array.from(second?.options??[])
            .some(x=>x.value===${JSON.stringify(firstIncoming)});
      })()`),'first incoming becomes second outgoing option');
      await evaluate(`(() => {
        const second=document.querySelector('#m1-dense-sub-out-2');
        const setter=Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,'value').set;
        setter.call(second,${JSON.stringify(firstIncoming)});
        second.dispatchEvent(new Event('change',{bubbles:true}));
      })()`);
      await until(async()=>await evaluate(`(() => {
        const second=document.querySelector('#m1-dense-sub-out-2');
        const reserve=document.querySelector('#m1-dense-sub-in-2');
        return second?.value===${JSON.stringify(firstIncoming)}&&
          Array.from(reserve?.options??[])
            .some(x=>x.value===${JSON.stringify(secondIncoming)});
      })()`),'second same-status reserve selectable');
      await evaluate(`(() => {
        const el=document.querySelector('#m1-dense-sub-in-2');
        const setter=Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,'value').set;
        setter.call(el,${JSON.stringify(secondIncoming)});
        el.dispatchEvent(new Event('change',{bubbles:true}));
      })()`);
      await until(async()=>await evaluate(`(() => {
        return document.querySelector('#m1-dense-sub-out-2')?.value===
          ${JSON.stringify(firstIncoming)}&&
          document.querySelector('#m1-dense-sub-in-2')?.value===
          ${JSON.stringify(secondIncoming)};
      })()`),'double substitute-of-substitute selector');
      await click('Провести две выбранные замены в плотном матче');
      try{
        await waitText('v120: две выбранные замены, плотный матч атомарно записан, 270 PRNG draws, ревизия 10 из 30.');
      }catch(error){
        const detail=await evaluate(`(() => ({
          status:document.querySelector('#m1-dense-title')?.closest('.panel')?.querySelector('[role="status"]')?.textContent,
          buttonDisabled:document.querySelector('#m1-dense-sub-out-2')?.closest('fieldset')?.querySelector('button')?.disabled,
          out1:document.querySelector('#m1-dense-sub-out')?.value,
          in1:document.querySelector('#m1-dense-sub-in')?.value,
          out2:document.querySelector('#m1-dense-sub-out-2')?.value,
          in2:document.querySelector('#m1-dense-sub-in-2')?.value,
          time1:document.querySelector('#m1-dense-sub-time')?.value,
          time2:document.querySelector('#m1-dense-sub-time-2')?.value
        }))()`);
        throw new Error('Double-chain browser result: '+
          JSON.stringify(detail)+'; '+String(error));
      }
      const chainStored=await evaluate(`new Promise((resolve,reject)=>{
        const req=indexedDB.open('footclubsim-m1-v120',1);
        req.onerror=()=>reject(req.error);
        req.onsuccess=()=>{
          const db=req.result;
          const tx=db.transaction('dense-result-journals','readonly');
          const get=tx.objectStore('dense-result-journals').get('m0-ui-initial-career');
          get.onsuccess=()=>{
            const journal=get.result;
            resolve(journal?.revision===10?journal.entries[9]?.source.plannedCommands:null);
          };
          get.onerror=()=>reject(get.error);
          tx.oncomplete=()=>db.close();
          tx.onabort=()=>{db.close();reject(tx.error);};
        };
      })`);
      if(!Array.isArray(chainStored)||chainStored.length!==2||
          chainStored[0].inPlayerId!==firstIncoming||
          chainStored[1].outPlayerId!==firstIncoming)
        throw new Error('Double substitute-of-substitute source-CAS mismatch');
      await send('Page.reload',{ignoreCache:true});
      await waitText('Создайте тренера, выберите клуб');
      await click('Восстановить из браузера');
      await waitText('Стартовая карьера восстановлена и проверена по SHA-256');
      await click('Создать или загрузить отдельный v120');
      await waitText('v120: проверен и загружен отдельный журнал, матчей: 10.');
      await assertNondefaultCareer('double substitute-of-substitute CAS/reload');
      console.log('PASS: exactly two chained normal changes source-CAS/reload');




    }
    console.log('PASS: v124 virtual referee CAS/reload, source commands=' +
      virtualDenseEvidence.commands.length + ', verified v126 hold UI');


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
    await waitText('Создайте тренера, выберите клуб');
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

    // A valid checksum plus unchanged pack/version strings must not permit
    // a forged club catalog. Validate the entire canonical pack instead.
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
    await waitText('Импорт отклонён: неизвестная версия игрового набора');
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
    await waitText('Восстановление отклонено: неизвестная или изменённая версия игрового набора');
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
    try {
      await until(
        () => browser.exitCode !== null || browser.signalCode !== null,
        'graceful Chrome/Edge process exit', 12_000,
      );
    } catch (error) {
      // A stuck test-only browser shutdown must not prevent the crash-
      // recovery check. Require the process to exit before reopening its
      // profile; a failed restart or save restore still fails this test.
      if (browser.exitCode === null && browser.signalCode === null) {
        console.warn('Browser.close stalled; terminating isolated test browser before profile restart');
        browser.kill();
        await until(
          () => browser.exitCode !== null || browser.signalCode !== null,
          'forced isolated browser process exit', 15_000,
        );
      } else {
        throw error;
      }
    }
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
    await waitText('Начните свою карьеру');
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
    await waitText('Недостаточно места в браузере');
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

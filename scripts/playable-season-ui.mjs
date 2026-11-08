import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const managerName = 'Тренер полного сезона';
const clubId = 'lp-vagon';
const TOTAL = 240;
const OWN = 30;
const COLD_REPLAY_TIMEOUT = 10 * 60_000;

async function waitFor(read, label, timeout = 75_000) {
  const deadline = Date.now() + timeout;
  let last;
  do {
    last = await read();
    if (last) return last;
    await sleep(250);
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for ' + label);
}

// Evaluated in the real application page by CDP or Safari WebDriver.
function seasonState() {
  const panel = document.querySelector('.season-panel');
  if (!panel) return null;
  const buttons = [...panel.querySelectorAll('button')];
  return {
    revision: panel.querySelector('progress')?.value ?? null,
    own: panel.querySelectorAll('.season-own-calendar .season-played').length,
    ownNext: buttons.some(button => button.textContent.trim() === 'Настроить стартовый состав'),
    automatic: buttons.some(button => button.textContent.trim() === 'Перейти к своему матчу'),
    stopping: buttons.some(button => button.textContent.trim() === 'Остановить переход'),
    status: panel.querySelector(':scope > [role=status]')?.textContent.trim() ?? '',
  };
}

function finalSnapshot() {
  const text = node => node.textContent.trim().replace(/\s+/g, ' ');
  const rows = (selector, cells) => [...document.querySelectorAll(selector)]
    .map(row => [...row.querySelectorAll(cells)].map(text));
  return {
    manager: text(document.querySelector('.manager-saved summary')),
    biography: [...document.querySelectorAll('.manager-saved .manager-timeline li')].map(text),
    club: document.querySelector('#club-select').value,
    table: rows('.season-columns .season-table tbody tr', 'td, th'),
    own: rows('.season-own-calendar li', ':scope > span, :scope > strong'),
    finalRound: rows('.season-fixtures li', ':scope > span, :scope > strong'),
    complete: Boolean(document.querySelector('.season-complete')),
  };
}

function verifyArchive(json, careerId, snapshot) {
  const envelope = JSON.parse(json);
  const initial = JSON.parse(JSON.parse(envelope.initialPayload).payload);
  const journal = JSON.parse(envelope.journalPayload);
  assert.equal(envelope.format, 'footclubsim-v188-full-career');
  assert.equal(envelope.careerId, careerId);
  assert.equal(initial.careerId, careerId);
  assert.equal(initial.selectedClubId, clubId);
  assert.equal(initial.managerProfile.displayName, managerName);
  assert.equal(initial.managerProfile.origin, 'custom');
  assert.equal(initial.managerProfile.skills.tacticalKnowledge, 15);
  assert.equal(initial.managerProfile.skills.mediaCommunication, 5);
  assert.equal(journal.revision, TOTAL);
  assert.equal(journal.entries.length, TOTAL);
  assert.equal(new Set(journal.entries.map(entry => entry.fixtureId)).size, TOTAL);

  const clubs = new Map(initial.catalog.clubs.map(club => [club.id, {
    id: club.id, name: club.displayName, played: 0, goals: 0, difference: 0, points: 0,
  }]));
  const calendar = [];
  const finalRound = [];
  let ownWithTactics = 0;
  for (const entry of journal.entries) {
    const fixture = entry.source.prematch.fixture;
    const home = clubs.get(fixture.homeClubId);
    const away = clubs.get(fixture.awayClubId);
    const hg = entry.result.report.home.goals;
    const ag = entry.result.report.away.goals;
    home.played++;
    away.played++;
    home.goals += hg;
    away.goals += ag;
    home.difference += hg - ag;
    away.difference += ag - hg;
    home.points += hg > ag ? 3 : Number(hg === ag);
    away.points += ag > hg ? 3 : Number(hg === ag);
    if (fixture.homeClubId === clubId || fixture.awayClubId === clubId) {
      const atHome = fixture.homeClubId === clubId;
      calendar.push(['Тур ' + entry.round,
        atHome ? 'Дома: ' + away.name : 'В гостях: ' + home.name,
        (atHome ? hg + ' : ' + ag : ag + ' : ' + hg)]);
      if (entry.source.managedXI?.tactics.mentality === 1) ownWithTactics++;
    }
    if (entry.round === 30) finalRound.push([home.name + ' — ' + away.name, hg + ' : ' + ag]);
  }
  assert.equal(calendar.length, OWN);
  assert.equal(ownWithTactics, 1);
  assert.equal(finalRound.length, 8);
  assert.equal(clubs.size, 16);
  assert.ok([...clubs.values()].every(row => row.played === OWN));
  const table = [...clubs.values()].sort((a, b) =>
    b.points - a.points || b.difference - a.difference || b.goals - a.goals ||
    a.id.localeCompare(b.id)).map((row, index) => [
    String(index + 1), row.name, String(row.played),
    (row.difference > 0 ? '+' : '') + row.difference, String(row.points),
  ]);
  assert.deepEqual(snapshot.table, table);
  assert.deepEqual(snapshot.own, calendar);
  assert.deepEqual(snapshot.finalRound, finalRound);
}

export async function exercisePlayableSeason({ evaluate, reload, download, importArchive, browser }) {
  const run = (fn, ...args) => evaluate('(' + fn.toString() + ')(...' + JSON.stringify(args) + ')');
  const state = () => run(seasonState);
  const pageStatus = () => evaluate('document.querySelector(".shell > .status")?.textContent.trim() ?? ""');
  const waitPage = (prefix, timeout, previousStatus) => waitFor(async () => {
    const status = await pageStatus();
    if (status.startsWith(prefix)) return status;
    if (status === previousStatus) return null;
    if (/^(Ошибка|Импорт .* отклонён|Полный экспорт не выполнен|Сохранение отклонено|Восстановление отклонено)/u.test(status))
      throw new Error(status);
    return null;
  }, prefix, timeout);
  const waitSeason = (predicate, label, timeout) => waitFor(async () => {
    const current = await state();
    if (current && /^(Не удалось|Не подтверждено|Запись не подтверждена|Матч пока невозможно|Переход остановлен:)/u.test(current.status))
      throw new Error('At revision ' + current.revision + ': ' + current.status);
    return current && predicate(current) ? current : null;
  }, label, timeout);

  async function click(label, scope = '.shell') {
    assert.equal(await run((name, region) => {
      const button = [...document.querySelectorAll(region + ' button')]
        .find(item => item.textContent.trim() === name);
      if (!button || button.disabled) return false;
      button.click();
      return true;
    }, label, scope), true, 'Unavailable button: ' + label);
  }
  const seasonClick = label => click(label, '.season-panel');
  async function setValue(selector, value) {
    assert.equal(await run((query, next) => {
      const element = document.querySelector(query);
      if (!element || element.disabled) return false;
      const select = element instanceof HTMLSelectElement;
      const prototype = select ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, next);
      if (element.value !== next) return false;
      element.dispatchEvent(new Event(select ? 'change' : 'input', { bubbles: true }));
      return true;
    }, selector, value), true, 'Unavailable input: ' + selector);
  }
  async function openSeason(revision) {
    await seasonClick('Начать или продолжить сезон');
    return waitSeason(current => current.revision === revision && current.status.includes('Сезон проверен'),
      'verified IndexedDB revision ' + revision, COLD_REPLAY_TIMEOUT);
  }

  const started = Date.now();
  await waitPage('Создайте тренера, выберите клуб');
  assert.equal(await evaluate('document.querySelector("#club-select").disabled'), true);
  await setValue('#manager-name', managerName);
  await evaluate('document.querySelectorAll("input[name=manager-origin]")[2].click()');
  await setValue('#manager-skill-tacticalKnowledge', '15');
  await setValue('#manager-skill-mediaCommunication', '5');
  await click('Показать биографию');
  await click('Подтвердить тренера');
  await setValue('#club-select', clubId);
  await click('Создать стартовую карьеру');
  await click('Сохранить в браузере');
  await waitPage('Начальная карьера записана в IndexedDB');
  const careerId = await evaluate('document.querySelector("#career-saved-select").value');
  assert.match(careerId, /^lp-career-/u);
  let current = await openSeason(0);
  let pausedAt = null;
  let tacticalFixture = false;

  while (current.revision < TOTAL) {
    const before = current;
    if (before.automatic) {
      const shouldPause = pausedAt === null && before.revision >= 80 &&
        await evaluate('Number(document.querySelector(".season-advance p").textContent.match(/\\d+/u)[0]) >= 3');
      if (shouldPause) {
        // Click Stop after the first opponent result is visibly committed.
        await run(revision => {
          const panel = document.querySelector('.season-panel');
          const observer = new MutationObserver(() => {
            if (panel.querySelector('progress').value <= revision) return;
            const stop = [...panel.querySelectorAll('button')]
              .find(button => button.textContent.trim() === 'Остановить переход');
            if (stop && !stop.disabled) {
              observer.disconnect();
              stop.click();
            }
          });
          observer.observe(panel, { childList: true, subtree: true, attributes: true });
        }, before.revision);
      }
      await seasonClick('Перейти к своему матчу');
      current = await waitSeason(value => value.revision > before.revision &&
        !value.stopping && value.status.startsWith(shouldPause ? 'Переход остановлен.' : 'Теперь очередь вашего клуба.'),
      'saved automatic opponents after revision ' + before.revision);
      assert.equal(current.own, before.own, 'Automatic advance skipped a managed fixture');
      if (shouldPause) {
        assert.ok(current.automatic, 'Pause did not interrupt the batch');
        pausedAt = current.revision;
        await reload();
        await waitPage('Создайте тренера, выберите клуб');
        await waitFor(() => run(id => [...document.querySelector('#career-saved-select').options]
          .some(option => option.value === id), careerId), 'saved career selector after interruption');
        await setValue('#career-saved-select', careerId);
        await click('Восстановить из браузера');
        await waitPage('Стартовая карьера восстановлена');
        current = await openSeason(pausedAt);
        assert.equal(current.own, before.own);
        console.log(browser + ': interrupted after saved fixture ' + pausedAt + ' and resumed after reload');
      }
    } else {
      if (before.ownNext && !tacticalFixture) {
        await seasonClick('Настроить стартовый состав');
        await setValue('.season-tactics-grid select', '1');
        tacticalFixture = true;
      }
      await seasonClick('Рассчитать матч');
      await waitSeason(value => value.status.startsWith('Результат рассчитан'), 'match preview');
      await seasonClick('Подтвердить и сохранить');
      current = await waitSeason(value => value.revision === before.revision + 1 &&
        value.status.startsWith('Матч №' + (before.revision + 1) + ' записан'), 'explicit match commit');
      assert.equal(current.own, before.own + Number(before.ownNext), 'Wrong managed-club calendar progression');
    }
    if (Math.floor(current.revision / 40) > Math.floor(before.revision / 40))
      console.log(browser + ': committed ' + current.revision + '/' + TOTAL + ' fixtures through the UI');
  }

  assert.ok(pausedAt !== null, 'No interruption was exercised');
  assert.equal(current.own, OWN);
  const before = await run(finalSnapshot);
  assert.ok(before.complete);
  assert.equal(before.club, clubId);
  assert.equal(before.biography.length, 3);
  const expectedName = 'footclubsim-' + careerId + '-full-career.json';
  const archive = await download({ click, waitPage, filename: expectedName });
  assert.equal(archive.filename, expectedName);
  verifyArchive(archive.json, careerId, before);

  // Remove only the two databases created by this test on its isolated origin.
  assert.equal(await evaluate('Promise.all(["footclubsim-m0","footclubsim-m1-v188"].map(name => new Promise(resolve => {' +
    'const request = indexedDB.deleteDatabase(name); request.onsuccess = () => resolve(true); ' +
    'request.onerror = request.onblocked = () => resolve(false); }))).then(results => results.every(Boolean))'), true);
  await reload();
  await waitPage('Создайте тренера, выберите клуб');
  await click('Восстановить из браузера');
  const missing = 'Восстановление отклонено: NOT_FOUND';
  await waitFor(async () => (await pageStatus()) === missing, 'empty IndexedDB after deletion');
  await importArchive(archive);
  await waitPage('Полная карьера восстановлена. Сыграно матчей: 240 из 240.', COLD_REPLAY_TIMEOUT, missing);
  await openSeason(TOTAL);
  assert.deepEqual(await run(finalSnapshot), before, 'Restored profile, standings or results differ from the finished season');
  console.log('PASS: ' + JSON.stringify({
    browser, fixtures: TOTAL, own: OWN, opponents: TOTAL - OWN, pausedAt,
    restoredRevision: TOTAL, tableRows: before.table.length, archiveBytes: Buffer.byteLength(archive.json),
    elapsedSeconds: Math.round((Date.now() - started) / 1000),
  }));
}

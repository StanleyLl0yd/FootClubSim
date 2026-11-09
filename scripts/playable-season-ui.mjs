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
    automatic: Boolean(panel.querySelector('.season-advance')),
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

function managerWizardSnapshot() {
  const root = document.querySelector('.manager-setup');
  if (!root) return null;
  const skills = [...root.querySelectorAll('.manager-skills li strong')]
    .map(node => Number(node.textContent.trim()));
  const show = [...root.querySelectorAll('button')]
    .find(button => button.textContent.trim() === 'Показать биографию');
  return {
    skills,
    remaining: root.querySelector('[aria-live="polite"]')?.textContent.trim() ?? null,
    canPreview: Boolean(show && !show.disabled),
    biography: [...root.querySelectorAll('.m1-preview .manager-timeline li')]
      .map(node => node.textContent.trim().replace(/\s+/gu, ' ')),
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
  let ownWithHalfTime = 0;
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
      if (entry.source.plannedCommands.some(command => command?.kind === 'substitute-normal' &&
        command.actor?.kind === 'player' && command.teamId === clubId &&
        command.elapsedSeconds === 2700)) ownWithHalfTime++;
    }
    if (entry.round === 30) finalRound.push([home.name + ' — ' + away.name, hg + ' : ' + ag]);
  }
  assert.equal(calendar.length, OWN);
  assert.equal(ownWithTactics, 1);
  assert.equal(ownWithHalfTime, 1, 'Halftime manager substitution missing from canonical journal');
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
    if (current && /^(Не удалось|Не подтверждено|Запись не подтверждена|Матч пока невозможно|Автоматический расчёт не завершён:)/u.test(current.status))
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
  async function openSeason(minimumRevision) {
    await seasonClick('Начать или продолжить сезон');
    return waitSeason(current => current.revision >= minimumRevision &&
      !current.automatic && !current.stopping &&
      /^(Сезон проверен|Теперь очередь вашего клуба|Сезон завершён)/u.test(current.status),
    'automatic opponents complete after loading revision ' + minimumRevision,
    COLD_REPLAY_TIMEOUT);
  }

  const started = Date.now();
  await waitPage('Создайте тренера, выберите клуб');
  assert.equal(await evaluate('document.querySelector("#club-select").disabled'), true);
  await setValue('#manager-name', managerName);
  const wizard = () => run(managerWizardSnapshot);
  const origin = async index => {
    assert.equal(await run(i => {
      const input = document.querySelectorAll('input[name="manager-origin"]')[i];
      if (!input) return false;
      input.click();
      return true;
    }, index), true);
    return waitFor(async () => {
      const current = await wizard();
      return current?.skills.length === 12 && current.skills.every(value =>
        Number.isInteger(value) && value >= 5 && value <= 15) &&
        current.skills.reduce((sum, value) => sum + value, 0) === 120 &&
        current.canPreview && current.biography.length === 0 ? current : null;
    }, 'valid 12-skill profile');
  };
  for (const index of [0, 1]) {
    const profile = await origin(index);
    assert.equal(profile.skills.reduce((sum, value) => sum + value, 0), 120);
    await click('Показать биографию');
    await waitFor(async () => (await wizard())?.biography.length === 3,
      'three biography events for origin ' + index);
    await click('Сгенерировать заново');
    const regenerated = await wizard();
    assert.deepEqual(regenerated.skills, profile.skills,
      'Biography regeneration changed preset manager skills');
    assert.equal(regenerated.biography.length, 3);
  }
  await origin(2);
  await setValue('#manager-skill-tacticalKnowledge', '15');
  await waitFor(async () => (await wizard())?.remaining === 'Снимите очков: 5',
    'custom skill over-budget feedback');
  assert.equal((await wizard()).canPreview, false, 'Over-budget profile accepted');
  await setValue('#manager-skill-mediaCommunication', '5');
  await waitFor(async () => (await wizard())?.remaining === 'Осталось распределить очков: 0',
    'custom skill exact-budget feedback');
  await click('Сбросить навыки');
  assert.deepEqual((await wizard()).skills, Array(12).fill(10), 'Reset does not restore 120 points');
  await setValue('#manager-skill-tacticalKnowledge', '15');
  await setValue('#manager-skill-mediaCommunication', '5');
  const custom = await waitFor(async () => {
    const current = await wizard();
    return current?.canPreview && current.remaining === 'Осталось распределить очков: 0' ?
      current : null;
  }, 'custom manager within 120-point budget');
  await click('Показать биографию');
  await waitFor(async () => (await wizard())?.biography.length === 3,
    'custom biography preview');
  await click('Сгенерировать заново');
  assert.deepEqual((await wizard()).skills, custom.skills,
    'Biography regeneration changed custom manager skills');
  await click('Подтвердить тренера');
  await setValue('#club-select', clubId);
  await click('Создать стартовую карьеру');
  const careerId = await evaluate('document.querySelector("#career-saved-select").value');
  assert.match(careerId, /^lp-career-/u);
  // Regression: launch directly after career creation without manual save.
  // The app must commit the initial snapshot, and must not replace it on retry.
  let current = await openSeason(0);
  await waitFor(() => run(id => [...document.querySelector('#career-saved-select').options]
    .some(option => option.value === id && option.textContent.includes('Лига приколов')),
  careerId), 'automatically saved career appears in stored selector');
  await click('Сохранить в браузере');
  await waitPage('Эта карьера уже сохранена в браузере. Данные не перезаписывались.');
  let pausedAt = null;
  let tacticalFixture = false;

  while (current.revision < TOTAL) {
    const before = current;
    assert.equal(before.automatic,false,
      'Opponent fixture remains exposed for manual action');
    {
      const useHalfTime = before.ownNext && !tacticalFixture;
      const shouldPause=pausedAt===null && before.revision>=80 && before.revision<200;

      if (useHalfTime) {
        await seasonClick('Настроить стартовый состав');
        await setValue('.season-tactics-grid select', '1');
        await seasonClick('Настроить замену');
        assert.equal(await run(() => {
          const out = document.querySelector('#season-sub-out');
          const incoming = document.querySelector('#season-sub-in');
          return Boolean(out?.value && incoming?.value && out.value !== incoming.value);
        }), true, 'No eligible halftime substitution pair');
        await seasonClick('Рассчитать с заменой');
        tacticalFixture = true;
      } else {
        await seasonClick('Рассчитать матч');
      }
      await waitSeason(value => value.status.startsWith('Результат рассчитан'), 'match preview');
      if (useHalfTime) {
        assert.equal(await run(() => [...document.querySelectorAll('.season-preview p')]
          .some(node => node.textContent.includes('Замена в перерыве включена'))), true,
        'No visible halftime-substitution confirmation');
      }
      if(shouldPause){
        // Interruption is optional for the player, but automatic results must
        // remain durable after reload. Stop after the first opponent commit.
        await run(revision => {
          const panel=document.querySelector('.season-panel');
          const observer=new MutationObserver(()=>{
            if(panel.querySelector('progress')?.value<=revision)return;
            const button=[...panel.querySelectorAll('button')]
              .find(element=>element.textContent.trim()==='Остановить переход');
            if(button&&!button.disabled){
              observer.disconnect();
              button.click();
            }
          });
          observer.observe(panel,{childList:true,subtree:true,attributes:true});
        },before.revision+1);
      }
      await seasonClick('Подтвердить и сохранить');
      current = await waitSeason(value => value.revision > before.revision &&
        value.own===before.own+1 && !value.stopping &&
        (value.status.startsWith(shouldPause?
          'Автоматический расчёт остановлен.':'Теперь очередь вашего клуба.') ||
         value.status.startsWith('Сезон завершён.')),
      'own match committed and opponents automatically resolved');
      assert.equal(current.own,before.own+1,
        'Opponent autopilot skipped or duplicated a managed fixture');
      if(shouldPause){
        assert.ok(current.automatic,'Stop did not leave pending opponents');
        pausedAt=current.revision;
        await reload();
        await waitPage('Создайте тренера, выберите клуб');
        await waitFor(()=>run(id=>[...document.querySelector('#career-saved-select').options]
          .some(option=>option.value===id),careerId),
        'saved career selector after interruption');
        await setValue('#career-saved-select',careerId);
        await click('Восстановить из браузера');
        await waitPage('Стартовая карьера восстановлена');
        current=await openSeason(pausedAt);
        assert.equal(current.own,before.own+1);
        console.log(browser+': automatic opponent batch interrupted after '+
          pausedAt+' and recovered after reload');
      }
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

  // A syntactically valid payload with an invalid SHA-256 must not overwrite
  // an already healthy saved career. Exercise the real browser file-input path.
  const tampered = JSON.parse(archive.json);
  tampered.journalPayload += ' ';
  await importArchive({
    filename: 'footclubsim-tampered-full-career.json',
    json: JSON.stringify(tampered),
  });
  await waitFor(async () => {
    const status = await pageStatus();
    return status.startsWith('Импорт полного архива отклонён:') &&
      status.includes('INVALID_BACKUP');
  }, 'corrupt full archive rejected before any write');
  await reload();
  await waitPage('Создайте тренера, выберите клуб');
  await waitFor(() => run(id => [...document.querySelector('#career-saved-select').options]
    .some(option => option.value === id), careerId), 'existing saved career after corrupt import');
  await setValue('#career-saved-select', careerId);
  await click('Восстановить из браузера');
  await waitPage('Стартовая карьера восстановлена');
  await openSeason(TOTAL);
  assert.deepEqual(await run(finalSnapshot), before,
    'Tampered archive damaged a healthy persisted career');

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

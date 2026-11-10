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
  const text = node => {
    // Original SVG badge glyphs are artwork, not part of table cell text.
    const clone=node.cloneNode(true);
    clone.querySelectorAll('svg').forEach(svg=>svg.remove());
    return clone.textContent.trim().replace(/\s+/g, ' ');
  };
  const rows = (selector, cells) => [...document.querySelectorAll(selector)]
    .map(row => [...row.querySelectorAll(cells)].map(text));
  return {
    manager: text(document.querySelector('.manager-saved summary')),
    biography: [...document.querySelectorAll('.manager-saved .manager-timeline li')].map(text),
    club: document.querySelector('#club-select').value,
    table: rows('.season-columns .season-table tbody tr', 'td, th'),
    own: rows('.season-own-calendar li', ':scope > span, :scope > strong'),
    finalRound: rows('.season-fixtures li', ':scope > span, :scope > strong'),
    lastOwnScoreboard: text(document.querySelector(
      '.season-scoreboard > div:nth-child(2)')),
    tableBadges:document.querySelectorAll(
      '.season-columns .season-table tbody tr svg[role=img]').length,
    fixtureBadges:document.querySelectorAll(
      '.season-fixtures li svg[role=img]').length,
    complete: Boolean(document.querySelector('.season-complete')),
    title: document.querySelector('.season-champion')?.textContent.trim()??null,
    report: {
      options:document.querySelectorAll('.season-match-centre select option').length,
      score:text(document.querySelector('.season-match-centre .season-preview-score')),
      clubBadges:[...document.querySelectorAll(
        '.season-match-centre .season-report-score svg[role=img]')]
        .map(svg=>svg.getAttribute('aria-label')),
      actorBadges:[...document.querySelectorAll(
        '.season-report-events li .season-event-player svg[role=img]')]
        .map(svg=>svg.getAttribute('aria-label')),
      actorTeams:[...document.querySelectorAll(
        '.season-report-events li .season-event-player .liga-club-label')]
        .map(node=>text(node)),
      rows:rows('.season-report-stat','strong, span'),
      events:[...document.querySelectorAll('.season-report-events li')]
        .map(node=>node.textContent.trim().replace(/\s+/g,' ')),
    },
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

  // New single-user preview careers must truly use the new source across
  // every fixture. The accepted speculative decisions are validated inside
  // both the source result and the full downloaded career archive.
  assert.ok(journal.entries.every(entry=>
    entry.source.specialGoalSourceVersion===2),
  'New career silently fell back to pre-special-goal source');
  let penalties=0,ownGoals=0,scoredPenalties=0;
  for(const entry of journal.entries){
    const accepted=entry.result.events.filter(event=>
      event.type==='adjudication');
    assert.equal(entry.result.specialDecisionCount,accepted.length,
      'Recorded special events must reconcile with replay report');
    for(const side of ['home','away']){
      const report=entry.result.report[side];
      assert.equal(report.goals,
        report.openPlayGoals+report.penaltyGoals+report.ownGoalsFor,
        'No unaccounted goals in a versioned source match');
      assert.ok(report.penaltyGoals<=report.penaltiesTaken,
        'Scored penalties cannot exceed penalty attempts');
      penalties+=report.penaltiesTaken;
      ownGoals+=report.ownGoalsFor;
      scoredPenalties+=report.penaltyGoals;
    }
  }
  assert.ok(penalties>0,
    '240-match experimental source never produced a valid penalty');
  assert.ok(ownGoals>0,
    '240-match experimental source never produced a valid own goal');
  console.log('NEW_CAREER_SPECIAL_GOALS_CENSUS '+JSON.stringify({
    matches:TOTAL,penalties,scoredPenalties,ownGoals,
    rules:'v191 shot hypothesis and synthetic special goals, not calibrated',
  }));

  const clubs = new Map(initial.catalog.clubs.map(club => [club.id, {
    id: club.id, name: club.displayName, played: 0,won: 0,drawn: 0,lost: 0,
    goals: 0, difference: 0, points: 0,
  }]));
  const calendar = [];
  const finalRound = [];
  let ownWithTactics = 0;
  let ownWithFormation = 0;
  let ownWithHalfTime = 0;
  let ownWithRememberedPlan = 0;
  let lastOwn=null;
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
    if(hg>ag){home.won++;away.lost++;}
    else if(hg<ag){away.won++;home.lost++;}
    else{home.drawn++;away.drawn++;}
    if (fixture.homeClubId === clubId || fixture.awayClubId === clubId) {
      const atHome = fixture.homeClubId === clubId;
      calendar.push(['Тур ' + entry.round,
        atHome ? 'Дома: ' + away.name : 'В гостях: ' + home.name,
        (atHome ? hg + ' : ' + ag : ag + ' : ' + hg)]);
      lastOwn=entry;
      if (entry.source.managedXI?.tactics.mentality === 1) ownWithTactics++;
      if(entry.source.managedXI?.tactics.pressing===70&&
         entry.source.managedXI?.tactics.tempo===80)ownWithRememberedPlan++;
      if (entry.source.managedXI?.tactics.formation === '4-4-2')
        ownWithFormation++;
      if (entry.source.plannedCommands.some(command => command?.kind === 'substitute-normal' &&
        command.actor?.kind === 'player' && command.teamId === clubId &&
        command.elapsedSeconds === 2700)) ownWithHalfTime++;
    }
    if (entry.round === 30) finalRound.push([home.name + ' — ' + away.name, hg + ' : ' + ag]);
  }
  assert.equal(calendar.length, OWN);
  assert.equal(ownWithTactics, OWN);
  assert.equal(ownWithFormation,OWN,'Formation not retained for every own match');
  assert.equal(ownWithRememberedPlan,OWN,
    'Pressing and tempo were reset between managed fixtures');
  assert.equal(ownWithHalfTime, 1, 'Halftime manager substitution missing from canonical journal');
  assert.equal(finalRound.length, 8);
  assert.equal(clubs.size, 16);
  assert.ok([...clubs.values()].every(row => row.played === OWN));
  const table = [...clubs.values()].sort((a, b) =>
    b.points - a.points || b.difference - a.difference || b.goals - a.goals ||
    a.id.localeCompare(b.id)).map((row, index) => [
    String(index + 1), row.name, String(row.played),String(row.won),
    String(row.drawn),String(row.lost),
    (row.difference > 0 ? '+' : '') + row.difference, String(row.points),
  ]);
  assert.deepEqual(snapshot.table, table);
  assert.deepEqual(snapshot.own, calendar);
  assert.deepEqual(snapshot.finalRound, finalRound);
  assert.equal(snapshot.tableBadges,16,
    'The standings must use all approved fictional club badges');
  assert.equal(snapshot.fixtureBadges,16,
    'Each final-round fixture must show both clubs');
  assert.equal(snapshot.report.options,OWN);
  const lastPrematch=lastOwn.source.prematch.fixture;
  const lastResult=lastOwn.result.report;
  assert.ok(snapshot.lastOwnScoreboard.includes(
    'Последний матч вашего клуба · тур '+lastOwn.round),
    'Scoreboard must identify the most recently played own-club fixture');
  assert.ok(snapshot.lastOwnScoreboard.includes(
    clubs.get(lastPrematch.homeClubId).name));
  assert.ok(snapshot.lastOwnScoreboard.includes(
    clubs.get(lastPrematch.awayClubId).name));
  assert.ok(snapshot.lastOwnScoreboard.includes(
    lastResult.home.goals+' : '+lastResult.away.goals),
    'Scoreboard cannot show another club’s most recent league fixture');
  const expectedScore=[lastPrematch.homeClubId,lastPrematch.awayClubId].map(id=>
    clubs.get(id).name);
  assert.ok(snapshot.report.score.includes(expectedScore[0])&&
    snapshot.report.score.includes(expectedScore[1]));
  assert.ok(snapshot.report.score.includes(
    lastResult.home.goals+' : '+lastResult.away.goals));
  assert.deepEqual(snapshot.report.clubBadges,
    expectedScore.map(name=>'Эмблема: '+name),
    'Match centre must identify both clubs');
  assert.equal(snapshot.report.actorBadges.length,snapshot.report.events.length);
  assert.equal(snapshot.report.actorTeams.length,snapshot.report.events.length);
  assert.ok(snapshot.report.actorTeams.every(name=>expectedScore.includes(name)),
    'Every event actor must have an identifiable club');
  assert.ok(snapshot.report.actorBadges.every(label=>
    expectedScore.some(name=>label==='Эмблема: '+name)),
  'Every event actor must have an approved club badge');
  assert.deepEqual(snapshot.report.rows[0],[
    String(lastResult.home.shots),'Удары',String(lastResult.away.shots)]);
  assert.deepEqual(snapshot.report.rows[1],[
    String(lastResult.home.shotsOnTarget),'В створ',
    String(lastResult.away.shotsOnTarget)]);
  const players=new Map(initial.catalog.players.map(p=>[p.id,p.displayName]));
  for(const event of lastOwn.result.events){
    if(event.type==='source'&&event.source.type==='shot'&&
       event.source.outcome==='goal')
      assert.ok(snapshot.report.events.some(text=>
        text.includes(players.get(event.source.playerId))),
      'Scorer name missing from match timeline');
  }
  const ranked=[...clubs.values()].sort((a,b)=>
    b.points-a.points||b.difference-a.difference||
    b.goals-a.goals||a.id.localeCompare(b.id));
  const leader=ranked[0],runner=ranked[1];
  const winsPoints=leader.points>runner.points;
  const provisionalWinner=leader.points===runner.points&&(
    leader.difference>runner.difference||
    leader.difference===runner.difference&&leader.goals>runner.goals);
  if(leader.id===clubId&&winsPoints){
    assert.ok(snapshot.title?.includes('чемпион'),'No title celebration');
  }else if(leader.id===clubId&&provisionalWinner){
    assert.ok(snapshot.title?.includes('первый в «Лиге приколов»'),
      'Goal-difference or goals-scored winner must be congratulated');
    assert.ok(snapshot.title?.includes('предварительной таблице'),
      'Tie-break must not be advertised as official RPL champion');
  }else if(leader.id===clubId){
    assert.ok(snapshot.title?.includes(
      'Первое место в предварительной таблице'),
    'Unresolved all-equal tie must not invent official champion');
  }else assert.equal(snapshot.title,null);
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
  assert.deepEqual(await run(() => ({
    selected:document.querySelector('.workspace-tabs [aria-selected="true"]')?.textContent.trim(),
    seasonDisabled:document.querySelector('#workspace-season-tab')?.disabled,
    setupHidden:document.querySelector('#workspace-setup')?.hidden,
  })),{selected:'Тренер и клуб',seasonDisabled:true,setupHidden:false});
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
  // A created career opens the season; tab switching does not reload it.
  assert.equal(await evaluate('document.querySelector("#workspace-setup").hidden'),true);
  assert.equal(await evaluate('document.querySelector("#workspace-season").hidden'),false);
  await click('Тренер и клуб','.workspace-tabs');
  assert.equal(await evaluate('document.querySelector("#workspace-setup").hidden'),false);
  await click('Сезон','.workspace-tabs');
  assert.equal(await evaluate('document.querySelector("#workspace-season").hidden'),false);
  assert.equal(await run(() => {
    const storage=document.querySelector('.workspace-storage');
    storage.querySelector('summary').click();
    return storage.open;
  }),true,'Save/restore controls not accessible from season workspace');
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
  let rememberedVerified=false;

  while (current.revision < TOTAL) {
    const before = current;
    assert.equal(before.automatic,false,
      'Opponent fixture remains exposed for manual action');
    {
      const useHalfTime = before.ownNext && !tacticalFixture;
      const shouldPause=pausedAt===null && before.revision>=80 && before.revision<200;

      if(before.own===1){
        await click('Тренер и клуб','.workspace-tabs');
        assert.equal(await evaluate('document.querySelector("#workspace-season").hidden'),true);
        await click('Сезон','.workspace-tabs');
        assert.equal((await state()).revision,before.revision,
          'Switching workspace remounted or reset the running season');
      }
      if (useHalfTime) {
        await seasonClick('Настроить стартовый состав');
        await setValue('.season-tactics-grid select', '1');
        await setValue('#season-formation','4-4-2');
        await setValue('.season-tactics-grid label:nth-child(3) input','70');
        await setValue('.season-tactics-grid label:nth-child(4) input','80');
        assert.equal(await evaluate(
          "document.querySelectorAll('.season-formation-line').length"),4,
        'Selected 4-4-2 is not displayed on pitch');
        await seasonClick('Подобрать XI под схему');
        const suggested=await run(()=>({
          selected:document.querySelectorAll(
            '.season-xi-grid input:checked').length,
          fit:document.querySelector(
            '.season-xi-advice [aria-live=polite]')?.textContent??'',
        }));
        assert.equal(suggested.selected,11,
          'Formation adviser must choose eleven eligible players');
        assert.match(suggested.fit,/Совпадение линий с амплуа: \d+%/,
          'Formation adviser must show v2 role fit');
        await seasonClick('Настроить замену');
        assert.equal(await run(() => {
          const out = document.querySelector('#season-sub-out');
          const incoming = document.querySelector('#season-sub-in');
          return Boolean(out?.value && incoming?.value && out.value !== incoming.value);
        }), true, 'No eligible halftime substitution pair');
        await seasonClick('Рассчитать с заменой');
        tacticalFixture = true;
      } else {
        if(!rememberedVerified && before.own===1){
          await seasonClick('Настроить стартовый состав');
          const restored=await run(()=>({
            formation:document.querySelector('#season-formation')?.value,
            pressing:document.querySelector(
              '.season-tactics-grid label:nth-child(3) input')?.value,
            tempo:document.querySelector(
              '.season-tactics-grid label:nth-child(4) input')?.value,
            starters:document.querySelectorAll('.season-xi-grid input:checked').length,
          }));
          assert.deepEqual(restored,{
            formation:'4-4-2',pressing:'70',tempo:'80',starters:11,
          },'Previous match preferences not restored');
          rememberedVerified=true;
        }
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
        assert.equal(await evaluate('document.querySelector("#workspace-season").hidden'),false);
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
  assert.equal(rememberedVerified,true,'Last XI was not checked');
  assert.equal(current.own, OWN);
  const before = await run(finalSnapshot);
  assert.ok(before.complete);
  assert.equal(before.club, clubId);
  assert.equal(before.biography.length, 3);
  const expectedName = 'footclubsim-' + careerId + '-full-career.json';
  const archive = await download({ click, waitPage, filename: expectedName });
  assert.equal(archive.filename, expectedName);
  verifyArchive(archive.json, careerId, before);

  // The separate OS-selected verification control must verify the actual
  // downloaded file (Chrome/Edge) or a Safari WebDriver File fixture without
  // restoring or modifying any journal. Safari OS download remains manual.
  await importArchive({...archive,selector:'#verify-full-file'});
  await waitPage('Выбранный полный архив проверен: 240 из 240 матчей.',COLD_REPLAY_TIMEOUT);
  assert.deepEqual(await run(finalSnapshot),before,
    'Read-only archive verification changed the running career');

  // A syntactically valid payload with an invalid SHA-256 must not overwrite
  // an already healthy saved career. Exercise the real browser file-input path.
  const tampered = JSON.parse(archive.json);
  tampered.journalPayload += ' ';
  await importArchive({
    filename:'footclubsim-tampered-full-career.json',
    json:JSON.stringify(tampered),selector:'#verify-full-file',
  });
  await waitFor(async()=>{
    const status=await pageStatus();
    return status.startsWith('Проверка полного архива отклонена:')&&
      status.includes('INVALID_BACKUP');
  },'read-only verification rejects corrupted archive');
  assert.deepEqual(await run(finalSnapshot),before,
    'Rejected archive inspection changed the running career');
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
  assert.equal(await evaluate('document.querySelector("#workspace-season").hidden'),false);
  await openSeason(TOTAL);
  assert.deepEqual(await run(finalSnapshot), before, 'Restored profile, standings or results differ from the finished season');
  console.log('PASS: ' + JSON.stringify({
    browser, fixtures: TOTAL, own: OWN, opponents: TOTAL - OWN, pausedAt,
    restoredRevision: TOTAL, tableRows: before.table.length, archiveBytes: Buffer.byteLength(archive.json),
    elapsedSeconds: Math.round((Date.now() - started) / 1000),
  }));
}

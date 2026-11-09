import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch} from '../dist/core/m1-v188-league-source-journal.js';
import {deriveM1V188MatchDetails}
  from '../dist/core/m1-v188-match-details.js';

test('match centre is derived only from v188 source goals and verified score',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  for(let seed=1;seed<=8;seed++){
    const initial=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v188-readonly-report-'+seed);
    const zero=startM1V188LeagueJournal(initial);
    assert.equal(zero.ok,true);
    const prepared=prepareM1V188LeagueMatch(initial,zero.journal);
    assert.equal(prepared?.ok,true);
    const updated=applyM1V188LeagueMatch(initial,zero.journal,prepared.request);
    assert.equal(updated.ok,true);
    const entry=updated.journal.entries[0];
    const before=JSON.stringify(entry);
    const details=deriveM1V188MatchDetails(entry);
    assert.ok(details);
    assert.equal(details.home.goals,entry.result.report.home.goals);
    assert.equal(details.away.goals,entry.result.report.away.goals);
    assert.equal(details.home.shots,entry.result.report.home.shots);
    assert.equal(details.away.shots,entry.result.report.away.shots);
    assert.equal(details.home.shotsOnTarget,entry.result.report.home.shotsOnTarget);
    assert.equal(details.away.shotsOnTarget,entry.result.report.away.shotsOnTarget);
    const goalEvents=details.incidents.filter(e=>
      ['goal','own-goal','penalty-goal'].includes(e.kind));
    assert.equal(goalEvents.length,details.home.goals+details.away.goals);
    assert.equal(JSON.stringify(entry),before);
    const tampered=structuredClone(entry);
    tampered.result.report.home.goals++;
    assert.equal(deriveM1V188MatchDetails(tampered),null);
  }
});

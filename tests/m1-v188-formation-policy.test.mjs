import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';

test('formation v2 is accepted, source replayed and never rewrites legacy v1',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  for(const seed of [42,77]){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v188-formation-v2-'+seed);
    const first=startM1V188LeagueJournal(career);
    assert.equal(first.ok,true);
    const automatic=prepareM1V188LeagueMatch(career,first.journal);
    assert.equal(automatic?.ok,true);
    assert.equal(automatic.selectedClubFixture,true);
    const pm=automatic.request.prematch;
    const home=pm.fixture.homeClubId===career.selectedClubId;
    const lineup=home?pm.homeLineup:pm.awayLineup;
    const tactics=home?pm.homeTactics:pm.awayTactics;
    const choice=(version,formation)=>({
      schemaVersion:1,clubId:career.selectedClubId,
      starters:[...lineup.starters],
      tactics:{...tactics,schemaVersion:version,formation},
    });
    const legacy=prepareM1V188LeagueMatch(career,first.journal,
      [],undefined,undefined,choice(1,'4-4-2'));
    assert.equal(legacy?.ok,true);
    const legacySaved=applyM1V188LeagueMatch(
      career,first.journal,legacy.request);
    assert.equal(legacySaved.ok,true);
    assert.equal(validateM1V188LeagueJournal(
      career,legacySaved.journal).ok,true);
    const revised=prepareM1V188LeagueMatch(career,first.journal,
      [],undefined,undefined,choice(2,'4-3-3'));
    assert.equal(revised?.ok,true,JSON.stringify(revised));
    assert.equal((home?revised.request.prematch.homeTactics:
      revised.request.prematch.awayTactics).schemaVersion,2);
    const saved=applyM1V188LeagueMatch(
      career,first.journal,revised.request);
    assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,240));
    assert.equal(validateM1V188LeagueJournal(
      career,saved.journal).ok,true);
    assert.equal(saved.journal.entries[0].source.managedXI
      .tactics.schemaVersion,2);
    assert.equal(legacySaved.journal.entries[0].source.managedXI
      .tactics.schemaVersion,1);
    assert.deepEqual(prepareM1V188LeagueMatch(career,first.journal,
      [],undefined,undefined,choice(3,'4-3-3')),
    {ok:false,error:'UNAUTHORIZED_MANAGER'});
    const altered=structuredClone(saved.journal);
    altered.entries[0].source.managedXI.tactics.formation='4-4-2';
    assert.equal(validateM1V188LeagueJournal(career,altered).ok,false);
  }
});

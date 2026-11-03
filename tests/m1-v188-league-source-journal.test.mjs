import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal,
  inspectM1V188LeagueCalendar}
  from '../dist/core/m1-v188-league-source-journal.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const initial=createInitialCareer(
  catalog,catalog.clubs[0].id,11,'v188-two-team-career');
test('v188 schedule has 240 distinct fixtures with both team histories',()=>{
  const cal=inspectM1V188LeagueCalendar(initial);
  assert.equal(cal.ok,true);
  assert.equal(cal.fixtureCount,240);
  assert.equal(cal.roundCount,30);
  assert.equal(new Set(cal.fixtures.map(f=>f.id)).size,240);
  for(const club of catalog.clubs){
    assert.equal(cal.fixtures.filter(f=>
      f.homeClubId===club.id).length,15);
    assert.equal(cal.fixtures.filter(f=>
      f.awayClubId===club.id).length,15);
  }
  for(let round=1;round<=30;round++){
    const matchday=cal.fixtures.filter(f=>f.round===round);
    assert.equal(matchday.length,8);
    assert.equal(new Set(matchday.flatMap(f=>
      [f.homeClubId,f.awayClubId])).size,16);
  }
});
test('v188 verifies successive canonical fixtures and refuses tampering',()=>{
  let sample=null;
  for(let seed=1;seed<=24&&!sample;seed++){
    const start=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v188-test-'+seed);
    const zero=startM1V188LeagueJournal(start);
    if(!zero.ok)continue;
    const first=prepareM1V188LeagueMatch(start,zero.journal);
    if(!first?.ok)continue;
    const one=applyM1V188LeagueMatch(start,zero.journal,first.request);
    if(!one.ok)continue;
    const next=prepareM1V188LeagueMatch(start,one.journal);
    if(!next?.ok)continue;
    const two=applyM1V188LeagueMatch(start,one.journal,next.request);
    if(two.ok)sample={start,zero,first,one,next,two};
  }
  assert.ok(sample,'no two-fixture source-replayed league seed');
  const {start,zero,first,one,next,two}=sample;
  assert.equal(two.journal.revision,2);
  assert.equal(two.remainingFixtures,238);
  assert.equal(two.completeHistory,false);
  assert.equal(two.bothTeamsEligibilityApplied,true);
  assert.equal(validateM1V188LeagueJournal(start,two.journal).ok,true);
  assert.notEqual(first.fixture.id,next.fixture.id);
  assert.deepEqual(applyM1V188LeagueMatch(
    start,one.journal,first.request),
    {ok:false,error:'STALE_REVISION'});
  const forged=structuredClone(first.request);
  forged.commandId='v188-league-wrong';
  assert.deepEqual(applyM1V188LeagueMatch(
    start,zero.journal,forged),
    {ok:false,error:'WRONG_FIXTURE'});
  const fake=structuredClone(first.request);
  fake.checkpointMedical=[{kind:'treatment-return',
    playerId:'forged'}];
  assert.equal(applyM1V188LeagueMatch(
    start,zero.journal,fake).ok,false);
  const mutated=structuredClone(two.journal);
  mutated.entries[0].source.prematch.rngSeed=7;
  assert.equal(validateM1V188LeagueJournal(start,mutated).ok,false);
  assert.equal(validateM1V188LeagueJournal(start,two.journal).ok,true);
  assert.equal(prepareM1V188LeagueMatch(
    start,one.journal,[{kind:'substitute-normal'}]).ok,false);
});

test('v188 manager selects a real halftime XI change in the league source',()=>{
  let accepted=null;
  const players=new Map(catalog.players.map(p=>[p.id,p]));
  for(let seed=1;seed<=24&&!accepted;seed++){
    const initial=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v188-real-manager-'+seed);
    const zero=startM1V188LeagueJournal(initial);
    if(!zero.ok)continue;
    const ordinary=prepareM1V188LeagueMatch(initial,zero.journal);
    if(!ordinary?.ok||!ordinary.selectedClubFixture)continue;
    const prematch=ordinary.request.prematch;
    const own=prematch.fixture.homeClubId===initial.selectedClubId?
      prematch.homeLineup:prematch.awayLineup;
    const outgoing=own.starters.filter(id=>
      players.get(id)?.primaryPosition!=='GK').slice(0,3);
    const incoming=own.bench.filter(id=>
      players.get(id)?.primaryPosition!=='GK').slice(0,3);
    for(const outPlayerId of outgoing){
      for(const inPlayerId of incoming){
        const manual=prepareM1V188LeagueMatch(initial,zero.journal,[{
          outPlayerId,inPlayerId,elapsedSeconds:2700,
        }]);
        if(!manual?.ok)continue;
        const applied=applyM1V188LeagueMatch(
          initial,zero.journal,manual.request);
        if(applied.ok){
          accepted={initial,manual,applied,outPlayerId,inPlayerId};
          break;
        }
      }
      if(accepted)break;
    }
  }
  assert.ok(accepted,'no legal manager-selected v188 source match');
  const {initial,manual,applied,outPlayerId,inPlayerId}=accepted;
  assert.equal(manual.request.plannedCommands.filter(c=>
    c.kind==='substitute-normal').length,1);
  assert.ok(manual.request.plannedCommands.some(c=>
    c.commandId==='v184-sub-'+manual.fixture.id+'-0'&&
    c.outPlayerId===outPlayerId&&c.inPlayerId===inPlayerId));
  assert.ok(manual.request.result.events.some(e=>
    e.type==='source'&&e.source.type==='physical-transition'&&
    e.source.source.type==='availability'&&
    e.source.source.source.entry.action.kind==='substitute-normal'&&
    e.source.source.source.entry.action.inPlayerId===inPlayerId));
  assert.equal(validateM1V188LeagueJournal(
    initial,applied.journal).ok,true);
  const spoofed=structuredClone(manual.request);
  const cmd=spoofed.plannedCommands.find(c=>
    c.kind==='substitute-normal');
  cmd.commandId='v158-sub-'+manual.fixture.id+'-0';
  assert.equal(applyM1V188LeagueMatch(
    initial,startM1V188LeagueJournal(initial).journal,spoofed).ok,false);
  assert.deepEqual(prepareM1V188LeagueMatch(
    initial,startM1V188LeagueJournal(initial).journal,[{
      outPlayerId,inPlayerId,elapsedSeconds:2700,
      sourceAuthority:'forged',
    }]),{ok:false,error:'UNAUTHORIZED_MANAGER'});
});

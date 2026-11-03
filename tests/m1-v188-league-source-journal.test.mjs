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

test('v188 exact-byte replay cache fails closed on post-commit mutations',()=>{
  const career=createInitialCareer(
    catalog,catalog.clubs[0].id,15,'v188-replay-cache-seed15');
  const zero=startM1V188LeagueJournal(career);
  assert.equal(zero.ok,true);
  const proposed=prepareM1V188LeagueMatch(career,zero.journal);
  assert.equal(proposed?.ok,true);
  const one=applyM1V188LeagueMatch(
    career,zero.journal,proposed.request);
  assert.equal(one.ok,true);
  for(let i=0;i<3;i++){
    const clone=structuredClone(one.journal);
    assert.equal(validateM1V188LeagueJournal(career,clone).ok,true);
  }
  const changed=structuredClone(one.journal);
  changed.entries[0].result.report.home.goals++;
  assert.deepEqual(validateM1V188LeagueJournal(career,changed),
    {ok:false,error:'INVALID_JOURNAL'});
  const changedSeed=structuredClone(one.journal);
  changedSeed.entries[0].source.prematch.rngSeed=1;
  assert.equal(validateM1V188LeagueJournal(
    career,changedSeed).ok,false);
  const changedOrder=structuredClone(one.journal);
  changedOrder.entries[0].commandId='v188-league-forged';
  assert.equal(validateM1V188LeagueJournal(
    career,changedOrder).ok,false);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(one.journal)).ok,true);
  const second=prepareM1V188LeagueMatch(
    career,structuredClone(one.journal));
  assert.equal(second?.ok,true);
  const two=applyM1V188LeagueMatch(
    career,structuredClone(one.journal),second.request);
  assert.equal(two.ok,true);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(two.journal)).ok,true);
  const broken=structuredClone(two.journal);
  broken.entries[1].source.policy.home.availableStaffIds=['fake'];
  assert.deepEqual(validateM1V188LeagueJournal(career,broken),
    {ok:false,error:'INVALID_JOURNAL'});
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(two.journal)).ok,true);
});

test('v188 cached schedule is isolated from mutated returned fixture aliases',()=>{
  const career=createInitialCareer(
    catalog,catalog.clubs[0].id,11,'v188-cache-schedule-alias');
  const zero=startM1V188LeagueJournal(career);
  assert.equal(zero.ok,true);
  const original=prepareM1V188LeagueMatch(career,zero.journal);
  assert.equal(original?.ok,true);
  const correctId=original.fixture.id;
  const correctHome=original.fixture.homeClubId;
  // A caller may mutate an object despite TypeScript readonly declarations.
  original.fixture.id='a-forged-calendar-identity';
  original.fixture.homeClubId='injected-foreign-club';
  assert.equal(original.request.prematch.fixture.id,
    'a-forged-calendar-identity');
  const again=prepareM1V188LeagueMatch(career,zero.journal);
  assert.equal(again?.ok,true);
  assert.equal(again.fixture.id,correctId);
  assert.equal(again.fixture.homeClubId,correctHome);
  assert.deepEqual(applyM1V188LeagueMatch(
    career,zero.journal,original.request),
    {ok:false,error:'WRONG_FIXTURE'});
  const valid=applyM1V188LeagueMatch(
    career,zero.journal,again.request);
  assert.equal(valid.ok,true);
  assert.equal(validateM1V188LeagueJournal(
    career,valid.journal).ok,true);
});

test('P3-1: v188 publishes one source-replayed clock and live goalkeepers',()=>{
  const sample=createInitialCareer(
    catalog,catalog.clubs[0].id,7,'v188-p3-1-goalkeeper');
  const start=startM1V188LeagueJournal(sample);
  assert.equal(start.ok,true);
  const prepared=prepareM1V188LeagueMatch(sample,start.journal);
  assert.equal(prepared?.ok,true);
  assert.equal(prepared.clock.sourceReplayRequired,true);
  assert.equal(prepared.clock.runningFullTimeSeconds,5400);
  assert.ok(prepared.clock.wallFullTimeSeconds>=6300);
  assert.equal(prepared.clock.snapshots.length,
    prepared.request.result.events.length);
  const pos=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
  for(let n=0;n<prepared.request.result.events.length;n++){
    const e=prepared.request.result.events[n];
    if(e.type!=='source'||e.source.type!=='shot')continue;
    const snap=prepared.clock.snapshots[n];
    const own=e.source.teamId===prepared.fixture.homeClubId?
      snap.homePresent:snap.awayPresent;
    const opposite=e.source.teamId===prepared.fixture.homeClubId?
      snap.awayPresent:snap.homePresent;
    assert.ok(own.includes(e.source.playerId),
      'source-attacker must remain physically present');
    assert.equal(opposite.filter(id=>pos.get(id)==='GK').length,1,
      'there must be exactly one physically present goalkeeper');
  }
  const applied=applyM1V188LeagueMatch(
    sample,start.journal,prepared.request);
  assert.equal(applied.ok,true);
  assert.equal(validateM1V188LeagueJournal(
    sample,applied.journal).ok,true);
  const changed=structuredClone(prepared.request);
  const index=changed.result.events.findIndex(e=>
    e.type==='source'&&e.source.type==='shot');
  assert.ok(index>=0);
  changed.result.events[index].source.playerId='forged-absent-shooter';
  assert.deepEqual(applyM1V188LeagueMatch(
    sample,start.journal,changed),
    {ok:false,error:'SOURCE_MISMATCH'});
});

test('P3-1: ten-player live restart and unsourced in-play stop fail closed',()=>{
  let witness=null;
  const positions=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
  for(let seed=1;seed<=80&&!witness;seed++){
    const initial=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v188-p3-1-ten-'+seed);
    const zero=startM1V188LeagueJournal(initial);
    if(!zero.ok)continue;
    const proposal=prepareM1V188LeagueMatch(initial,zero.journal);
    if(!proposal?.ok)continue;
    const events=proposal.request.result.events;
    for(let n=1;n<events.length-1;n++){
      const e=events[n];
      if(e.type!=='source'||e.source.type!=='physical-transition'||
          e.source.source.type!=='availability'||
          e.source.source.source.entry.action.kind!=='direct-red')
        continue;
      const clubId=e.source.source.source.entry.action.teamId;
      const side=clubId===proposal.fixture.homeClubId?
        'homePresent':'awayPresent';
      const before=proposal.clock.snapshots[n-1][side];
      const after=proposal.clock.snapshots[n][side];
      if(before.length!==11||after.length!==10)continue;
      if(!events.slice(n+1).some(x=>
          x.type==='source'&&x.source.type==='shot'))continue;
      const offender=e.source.source.source.entry.action.playerId;
      assert.ok(before.includes(offender));
      assert.ok(!after.includes(offender));
      for(let k=n+1;k<events.length;k++){
        const shot=events[k];
        if(shot.type!=='source'||shot.source.type!=='shot')continue;
        const snap=proposal.clock.snapshots[k];
        const attackers=shot.source.teamId===proposal.fixture.homeClubId?
          snap.homePresent:snap.awayPresent;
        const defenders=shot.source.teamId===proposal.fixture.homeClubId?
          snap.awayPresent:snap.homePresent;
        assert.ok(attackers.includes(shot.source.playerId));
        assert.equal(defenders.filter(id=>
          positions.get(id)==='GK').length,1);
      }
      witness={initial,zero,proposal};
      break;
    }
  }
  assert.ok(witness,'no generated 10-player restart with subsequent shot');
  const {initial,zero,proposal}=witness;
  const own=proposal.fixture.homeClubId===initial.selectedClubId?
    proposal.request.prematch.homeLineup:
    proposal.request.prematch.awayLineup;
  const out=own.starters.find(id=>positions.get(id)!=='GK');
  const incoming=own.bench.find(id=>positions.get(id)!=='GK');
  assert.ok(out&&incoming);
  const noWhistle=Array.from({length:17},(_,i)=>(i+1)*300)
    .find(t=>t!==2700&&
      !proposal.clock.managerStopsFromSource.includes(t));
  assert.ok(noWhistle);
  const forbidden=prepareM1V188LeagueMatch(
    initial,zero.journal,[{outPlayerId:out,inPlayerId:incoming,
      elapsedSeconds:noWhistle}]);
  assert.equal(forbidden?.ok,false,
    'user may not fabricate a referee-authorized substitution');
});

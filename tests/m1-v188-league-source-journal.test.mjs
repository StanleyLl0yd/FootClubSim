import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal,
  inspectM1V188LeagueCalendar}
  from '../dist/core/m1-v188-league-source-journal.js';

import {simulateM1V29CausalMedicalSource}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {regenerateM1V184CausalSource}
  from '../dist/core/m1-v182-unified-source.js';
import {M1_MODELLED_GOAL_STOP_SECONDS,
  M1_MODELLED_FOUL_STOP_SECONDS,
  M1_MODELLED_HALF_TIME_STOP_SECONDS}
  from '../dist/core/m1-clock.js';

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

test('P3-1: actual scored goal admits a lawful source-replayed substitute',()=>{
  let witness=null;
  const positions=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
  for(let seed=1;seed<=48&&!witness;seed++){
    const career=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v188-p3-1-goal-'+seed);
    const start=startM1V188LeagueJournal(career);
    if(!start.ok)continue;
    const automatic=prepareM1V188LeagueMatch(career,start.journal);
    if(!automatic?.ok)continue;
    const goalTimes=automatic.request.result.events.filter(e=>
      e.type==='source'&&e.source.type==='shot'&&
      e.source.outcome==='goal'&&e.elapsedSeconds%300===299&&
      e.elapsedSeconds<5099).map(e=>e.elapsedSeconds+1);
    const own=automatic.fixture.homeClubId===career.selectedClubId?
      automatic.request.prematch.homeLineup:
      automatic.request.prematch.awayLineup;
    for(const time of goalTimes){
      if(witness)break;
      for(const outPlayerId of own.starters.filter(
        id=>positions.get(id)!=='GK').slice(0,5)){
        if(witness)break;
        for(const inPlayerId of own.bench.filter(
          id=>positions.get(id)!=='GK').slice(0,5)){
          const manual=prepareM1V188LeagueMatch(
            career,start.journal,[{outPlayerId,inPlayerId,
              elapsedSeconds:time}]);
          if(!manual?.ok)continue;
          const physical=manual.request.result.events.find(e=>
            e.type==='source'&&e.source.type==='physical-transition'&&
            e.source.source.type==='availability'&&
            e.source.source.source.entry.action.kind==='substitute-normal'&&
            e.elapsedSeconds===time&&
            e.source.source.source.entry.action.inPlayerId===inPlayerId);
          if(!physical)continue;
          const saved=applyM1V188LeagueMatch(
            career,start.journal,manual.request);
          if(!saved.ok)continue;
          witness={career,start,automatic,manual,saved,
            outPlayerId,inPlayerId,time};
          break;
        }
      }
    }
  }
  assert.ok(witness,'no legal ordinary seeded-goal substitute in 48 seeds');
  const {career,start,automatic,manual,saved,
    outPlayerId,inPlayerId,time}=witness;
  assert.ok(automatic.clock.managerStopsFromSource.includes(time),
    'the original seeded source must actually contain the goal whistle');
  assert.ok(manual.clock.managerStopsFromSource.includes(time));
  assert.ok(manual.request.result.events.some(e=>
    e.type==='source'&&e.source.type==='shot'&&
    e.source.outcome==='goal'&&e.elapsedSeconds===time-1),
    'the same actual goal must precede the substituted restart');
  assert.equal(validateM1V188LeagueJournal(career,saved.journal).ok,true);
  const move=manual.clock.snapshots.find(s=>
    s.runningSeconds===time&&
    ([...s.homePresent,...s.awayPresent].includes(inPlayerId))&&
    ![...s.homePresent,...s.awayPresent].includes(outPlayerId));
  assert.ok(move,'the substitute must enter the saved physical XI');
  const noStop=Array.from({length:17},(_,i)=>(i+1)*300)
    .find(t=>t!==2700&&
      !automatic.clock.managerStopsFromSource.includes(t));
  assert.ok(noStop);
  const forged=prepareM1V188LeagueMatch(career,start.journal,[{
    outPlayerId,inPlayerId,elapsedSeconds:noStop,
  }]);
  assert.equal(forged?.ok,false,
    'absence of seeded whistle must never authorize a substitution');
  const forgedResult=structuredClone(manual.request);
  const goal=forgedResult.result.events.find(e=>
    e.type==='source'&&e.source.type==='shot'&&
    e.elapsedSeconds===time-1&&e.source.outcome==='goal');
  assert.ok(goal);
  goal.source.outcome='saved';
  assert.deepEqual(applyM1V188LeagueMatch(
    career,start.journal,forgedResult),
    {ok:false,error:'SOURCE_MISMATCH'});
});

test('P3-1: referee and physical v188 source share one stopped-time clock',()=>{
  let witnessed=0;
  for(let seed=1;seed<=12;seed++){
    const initial=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v188-clock-cross-source-'+seed);
    const zero=startM1V188LeagueJournal(initial);
    assert.equal(zero.ok,true);
    const prepared=prepareM1V188LeagueMatch(initial,zero.journal);
    if(!prepared?.ok)continue;
    const generated=simulateM1V29CausalMedicalSource(
      prepared.request.prematch,prepared.request.policy,[],[],true);
    assert.equal(generated.ok,true);
    assert.equal(generated.match.goalPauseWallSeconds,
      M1_MODELLED_GOAL_STOP_SECONDS);
    assert.equal(generated.match.foulStoppageWallSeconds,
      M1_MODELLED_FOUL_STOP_SECONDS);
    assert.equal(generated.match.halfTimeWallSeconds,
      M1_MODELLED_HALF_TIME_STOP_SECONDS);
    const physicalShots=prepared.request.result.events.flatMap((e,n)=>
      e.type==='source'&&e.source.type==='shot'?
        [{e,wall:prepared.clock.snapshots[n].wallSeconds}]:[]);
    const refereeShots=generated.match.events.filter(e=>e.kind==='shot');
    assert.equal(refereeShots.length,physicalShots.length,
      'source and referee must share actual shots');
    for(let i=0;i<refereeShots.length;i++){
      assert.equal(refereeShots[i].runningSeconds,
        physicalShots[i].e.elapsedSeconds);
      assert.equal(refereeShots[i].playerId,
        physicalShots[i].e.source.playerId);
      assert.equal(refereeShots[i].wallSeconds,physicalShots[i].wall,
        'the same physical shot must have one stopped clock');
    }
    assert.equal(prepared.clock.wallFullTimeSeconds,
      generated.match.events.at(-1).wallSeconds,
      'referee and physical full-time clocks must agree');
    if(generated.generatedIncidents.some(e=>
        e.sanction!=='injury-withdrawal')&&
        physicalShots.some(x=>x.e.source.outcome==='goal'))witnessed++;
  }
  assert.ok(witnessed>0,'a seeded goal+foul witness is required');
});

test('P3-1: old v188 source may be replayed but never mint new authority',()=>{
  const career=createInitialCareer(
    catalog,catalog.clubs[0].id,12,'v188-old-read-new-write');
  const zero=startM1V188LeagueJournal(career);
  assert.equal(zero.ok,true);
  const proposal=prepareM1V188LeagueMatch(career,zero.journal);
  assert.equal(proposal?.ok,true);
  const legacy=regenerateM1V184CausalSource(
    proposal.request.prematch,proposal.request.policy,[]);
  assert.equal(legacy.ok,true);
  const request={...proposal.request,
    plannedCommands:legacy.plannedCommands,
    checkpointMedical:legacy.checkpointMedical,result:legacy.result};
  const {catalog:_catalog,...prematch}=request.prematch;
  void _catalog;
  const historical={...zero.journal,revision:1,entries:[{
    fixtureId:proposal.fixture.id,round:proposal.fixture.round,
    commandId:request.commandId,
    source:{prematch,policy:request.policy,
      plannedCommands:request.plannedCommands,
      checkpointMedical:request.checkpointMedical},
    result:request.result,
  }]};
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(historical)).ok,true,
    'old exact-result histories remain independently replayable');
  const dense=regenerateM1V184CausalSource(
    proposal.request.prematch,proposal.request.policy,[],true);
  assert.equal(dense.ok,true);
  // The persisted v105 result can be identical under both referee modes.
  // Source replay is not a cryptographic attestation of historical origin.
  assert.deepEqual(legacy.result,dense.result,
    'this deterministic witness has canonically equivalent saved events');
  const equivalent=structuredClone(historical);
  equivalent.entries[0].source.disciplinePolicyVersion=2;
  assert.equal(validateM1V188LeagueJournal(career,equivalent).ok,true,
    'identical dense-replayable events cannot reveal their prior generator');
  const forgedVersioned=structuredClone(equivalent);
  forgedVersioned.entries[0].result.events[0].id='forged-referee';
  assert.deepEqual(validateM1V188LeagueJournal(career,forgedVersioned),
    {ok:false,error:'INVALID_JOURNAL'},
    'versioned entries still reject inconsistent canonical source bytes');
  const damaged=structuredClone(historical);
  damaged.entries[0].result.report.home.goals++;
  assert.equal(validateM1V188LeagueJournal(career,damaged).ok,false);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(historical)).ok,true);
  // The final engine re-verifies incoming requests; a caller cannot
  // force a new legacy source version or append an altered result.
  const forged=structuredClone(request);
  forged.result.events[0].id='m1-v105-forged-old-referee';
  assert.deepEqual(applyM1V188LeagueMatch(career,zero.journal,forged),
    {ok:false,error:'SOURCE_MISMATCH'});
});

test('P3-3: versioned simple cautions preserve legacy replay and reject downgrade',()=>{
  const career=createInitialCareer(
    catalog,catalog.clubs[0].id,15,'v188-p3-3-caution-carry');
  const zero=startM1V188LeagueJournal(career);
  assert.equal(zero.ok,true);
  const first=prepareM1V188LeagueMatch(career,zero.journal);
  assert.equal(first?.ok,true);
  const one=applyM1V188LeagueMatch(career,zero.journal,first.request);
  assert.equal(one.ok,true);
  assert.equal(one.journal.entries[0].source.disciplinePolicyVersion,2);
  assert.equal(validateM1V188LeagueJournal(career,
    structuredClone(one.journal)).ok,true);
  const firstLegacy=structuredClone(one.journal);
  delete firstLegacy.entries[0].source.disciplinePolicyVersion;
  assert.equal(validateM1V188LeagueJournal(career,firstLegacy).ok,true,
    'previously saved exact-source fixtures keep their original policy');
  const resumed=prepareM1V188LeagueMatch(career,firstLegacy);
  assert.equal(resumed?.ok,true);
  const migrated=applyM1V188LeagueMatch(
    career,firstLegacy,resumed.request);
  assert.equal(migrated.ok,true);
  assert.equal(migrated.journal.entries[0].source.disciplinePolicyVersion,
    undefined);
  assert.equal(migrated.journal.entries[1].source.disciplinePolicyVersion,2);
  assert.equal(validateM1V188LeagueJournal(career,
    structuredClone(migrated.journal)).ok,true);
  const next=prepareM1V188LeagueMatch(career,one.journal);
  assert.equal(next?.ok,true);
  const two=applyM1V188LeagueMatch(career,one.journal,next.request);
  assert.equal(two.ok,true);
  assert.equal(validateM1V188LeagueJournal(career,
    structuredClone(two.journal)).ok,true);
  const downgraded=structuredClone(two.journal);
  delete downgraded.entries[1].source.disciplinePolicyVersion;
  assert.deepEqual(validateM1V188LeagueJournal(career,downgraded),
    {ok:false,error:'INVALID_JOURNAL'});
  const invented=structuredClone(one.journal);
  invented.entries[0].source.disciplinePolicyVersion=3;
  assert.equal(validateM1V188LeagueJournal(career,invented).ok,false);
  const unsolicited=structuredClone(one.journal);
  unsolicited.entries[0].source.externalKdkAuthenticated=true;
  assert.equal(validateM1V188LeagueJournal(career,unsolicited).ok,false);
});

test('P3-3: four distinct seeded cautions exclude the next own-team match',()=>{
  const career=createInitialCareer(
    catalog,catalog.clubs[0].id,11,'v188-p3-3-full-source');
  let journal=startM1V188LeagueJournal(career).journal;
  const cautions=new Map();
  const pending=[];
  let acceptedBan=0;
  for(let index=0;index<240&&acceptedBan===0;index++){
    const prepared=prepareM1V188LeagueMatch(career,journal);
    assert.equal(prepared?.ok,true,'all fixture sources must be playable');
    const fixture=prepared.fixture;
    for(let k=pending.length-1;k>=0;k--){
      const ban=pending[k];
      if(index<=ban.sourceIndex||
          ![fixture.homeClubId,fixture.awayClubId].includes(ban.clubId))
        continue;
      const lineup=fixture.homeClubId===ban.clubId?
        prepared.request.prematch.homeLineup:
        prepared.request.prematch.awayLineup;
      assert.equal([...lineup.starters,...lineup.bench].includes(
        ban.playerId),false,
      'four simple cautions must exclude starters AND bench');
      pending.splice(k,1);
      acceptedBan++;
    }
    const reds=new Set(prepared.request.plannedCommands.filter(c=>
      c.kind==='direct-red').map(c=>JSON.stringify([c.teamId,c.playerId])));
    const warnings=new Map();
    for(const c of prepared.request.plannedCommands){
      if(c.kind!=='caution')continue;
      const key=JSON.stringify([c.teamId,c.playerId]);
      warnings.set(key,(warnings.get(key)??0)+1);
    }
    for(const [key,count] of warnings){
      if(count!==1||reds.has(key))continue;
      const next=(cautions.get(key)??0)+1;
      cautions.set(key,next);
      if(next%4===0){
        const [clubId,playerId]=JSON.parse(key);
        pending.push({clubId,playerId,sourceIndex:index});
      }
    }
    const saved=applyM1V188LeagueMatch(
      career,journal,prepared.request);
    assert.equal(saved.ok,true);
    journal=saved.journal;
  }
  assert.ok(acceptedBan>0,
    'fixed seed must exercise a fourth caution and next-club-match ban');
  assert.equal(validateM1V188LeagueJournal(career,
    structuredClone(journal)).ok,true);
});

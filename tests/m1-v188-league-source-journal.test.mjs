import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal,
  inspectM1V188LeagueCalendar,inspectM1V188FictionalHolds}
  from '../dist/core/m1-v188-league-source-journal.js';

import {simulateM1V29CausalMedicalSource}
  from '../dist/core/m1-v23-temporary-treatment.js';
import {regenerateM1V184CausalSource}
  from '../dist/core/m1-v182-unified-source.js';
import {deriveM1V186Law5FromCausalSource}
  from '../dist/core/m1-v186-law5-causal.js';
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

test('P3-2: v188 opt-in keeper assessment is replay-bound and save compatible',()=>{
  let witness=null;
  for(let seed=1;seed<=128&&!witness;seed++){
    const career=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v188-p3-2-keeper-'+seed);
    const zero=startM1V188LeagueJournal(career);
    if(!zero.ok)continue;
    const proposal=prepareM1V188LeagueMatch(
      career,zero.journal,[],undefined,2);
    if(!proposal?.ok)continue;
    const source=proposal.sourceLaw5Evidence?.find(e=>
      e.exception==='goalkeeper-on-field-assessment');
    if(source)witness={career,zero,proposal,source};
  }
  assert.ok(witness,'no seeded source-bound on-field goalkeeper witness');
  const {career,zero,proposal,source}=witness;
  const legacy=prepareM1V188LeagueMatch(career,zero.journal);
  assert.equal(legacy?.ok,true);
  assert.equal(legacy.request.medicalPolicyVersion,undefined);
  assert.equal(proposal.request.medicalPolicyVersion,2);
  assert.equal(proposal.externalMedicalAuthorityAuthenticated,false);
  assert.equal(source.exitEventId,null);
  assert.equal(source.returnEventId,null);
  assert.equal(source.modelledDisposition,'may-remain-after-assessment');
  const keeper=catalog.players.find(p=>p.id===source.patientPlayerId);
  assert.equal(keeper?.primaryPosition,'GK');
  const seeded=simulateM1V29CausalMedicalSource(
    proposal.request.prematch,proposal.request.policy,[],[],true,true);
  assert.equal(seeded.ok,true);
  const inspected=deriveM1V186Law5FromCausalSource(
    seeded,proposal.request.result,proposal.request.prematch);
  assert.equal(inspected.ok,true);
  const poisoned=structuredClone(seeded);
  const keeperIndex=poisoned.causalAssessments.findIndex(a=>
    a.goalkeeperExceptionSource===true);
  assert.ok(keeperIndex>=0);
  const patientLineup=source.patientTeamId===proposal.fixture.homeClubId?
    proposal.request.prematch.homeLineup:
    proposal.request.prematch.awayLineup;
  const outfield=patientLineup.starters.find(id=>
    catalog.players.find(p=>p.id===id)?.primaryPosition!=='GK');
  assert.ok(outfield);
  poisoned.causalAssessments[keeperIndex].patientPlayerId=outfield;
  assert.deepEqual(deriveM1V186Law5FromCausalSource(
    poisoned,proposal.request.result,proposal.request.prematch),
    {ok:false,error:'UNSUPPORTED_LAW5_ORIGIN'},
    'non-keeper cannot claim the source-bound goalkeeper exception');
  const physicalCard=proposal.request.result.events.find(e=>
    e.type==='source'&&e.source.type==='physical-transition'&&
    e.source.source.type==='availability'&&
    e.elapsedSeconds===source.runningSeconds&&
    e.source.source.source.entry.action.teamId===
      source.offenderTeamId&&
    e.source.source.source.entry.action.playerId===
      source.offenderPlayerId);
  assert.ok(physicalCard,'a real seeded source decision must exist');
  const side=source.patientTeamId===proposal.fixture.homeClubId?
    'homePresent':'awayPresent';
  assert.ok(proposal.clock.snapshots.some(snapshot=>
    snapshot.runningSeconds===source.runningSeconds&&
    snapshot[side].includes(source.patientPlayerId)),
  'the keeper must remain present at the actual source event');
  assert.ok(proposal.clock.snapshots.at(-1)[side].includes(
    source.patientPlayerId),'the keeper must remain through full-time');
  const saved=applyM1V188LeagueMatch(
    career,zero.journal,proposal.request);
  assert.equal(saved.ok,true);
  assert.equal(saved.journal.entries[0].source.medicalPolicyVersion,2);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(saved.journal)).ok,true);
  const after=prepareM1V188LeagueMatch(career,saved.journal);
  assert.equal(after?.ok,true);
  assert.equal(after.request.medicalPolicyVersion,2,
    'no downgrade after a medical source policy entry');
  const second=applyM1V188LeagueMatch(
    career,saved.journal,after.request);
  assert.equal(second.ok,true);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(second.journal)).ok,true);
  const downgrade=structuredClone(second.journal);
  delete downgrade.entries[1].source.medicalPolicyVersion;
  assert.deepEqual(validateM1V188LeagueJournal(career,downgrade),
    {ok:false,error:'INVALID_JOURNAL'});
  const invented=structuredClone(saved.journal);
  invented.entries[0].source.medicalPolicyVersion=6;
  assert.deepEqual(validateM1V188LeagueJournal(career,invented),
    {ok:false,error:'INVALID_JOURNAL'});
  const forged=structuredClone(proposal.request);
  forged.sourceLaw5Evidence=[{externalMedicalAuthorityAuthenticated:true}];
  assert.deepEqual(applyM1V188LeagueMatch(
    career,zero.journal,forged),
    {ok:false,error:'INVALID_REQUEST'});
  const tampered=structuredClone(proposal.request);
  tampered.result.events[0].id='forged-medical-referee';
  assert.deepEqual(applyM1V188LeagueMatch(
    career,zero.journal,tampered),
    {ok:false,error:'SOURCE_MISMATCH'});
});

test('P3-2: v3 two patients share a seeded foul whistle and replay as physical source',()=>{
  let witness=null;
  for(let seed=1;seed<=192&&!witness;seed++){
    const career=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v188-p3-2-paired-'+seed);
    const zero=startM1V188LeagueJournal(career);
    if(!zero.ok)continue;
    const p=prepareM1V188LeagueMatch(career,zero.journal,[],undefined,3);
    if(!p?.ok)continue;
    const pair=p.sourceLaw5Evidence?.find(e=>
      e.sameWhistlePairOrdinal===2);
    const first=pair&&p.sourceLaw5Evidence?.find(e=>
      e.incidentId===pair.incidentId&&e.patientPlayerId!==pair.patientPlayerId);
    if(first&&pair)witness={career,zero,p,first,pair};
  }
  assert.ok(witness,'no positive source-bound paired patient whistle');
  const {career,zero,p,first,pair}=witness;
  assert.equal(p.request.medicalPolicyVersion,3);
  assert.equal(p.externalMedicalAuthorityAuthenticated,false);
  assert.equal(pair.sameWhistlePairOrdinal,2);
  assert.equal(first.incidentId,pair.incidentId);
  assert.equal(first.whistleEventId,pair.whistleEventId);
  assert.equal(first.restartEventId,pair.restartEventId);
  assert.equal(first.runningSeconds,pair.runningSeconds);
  assert.equal(first.patientTeamId,pair.patientTeamId);
  assert.notEqual(first.patientPlayerId,pair.patientPlayerId);
  const source=simulateM1V29CausalMedicalSource(
    p.request.prematch,p.request.policy,[],[],true,true,true);
  assert.equal(source.ok,true);
  const derived=deriveM1V186Law5FromCausalSource(
    source,p.request.result,p.request.prematch);
  assert.equal(derived.ok,true);
  assert.ok(derived.evidence.some(e=>
    e.incidentId===pair.incidentId&&e.sameWhistlePairOrdinal===2));
  const whistle=source.match.events.find(e=>e.id===pair.whistleEventId);
  assert.ok(whistle);
  const side=pair.patientTeamId===p.fixture.homeClubId?'home':'away';
  assert.ok(whistle.onField[side].includes(first.patientPlayerId));
  assert.ok(whistle.onField[side].includes(pair.patientPlayerId));
  const fake=structuredClone(source);
  const pairDraft=fake.causalAssessments.find(a=>
    a.sameWhistleSecondPatient===true);
  assert.ok(pairDraft);
  pairDraft.patientPlayerId=first.patientPlayerId;
  assert.deepEqual(deriveM1V186Law5FromCausalSource(
    fake,p.request.result,p.request.prematch),
    {ok:false,error:'UNSUPPORTED_LAW5_ORIGIN'});
  const noPair=structuredClone(source);
  delete noPair.causalAssessments.find(a=>
    a.sameWhistleSecondPatient===true).sameWhistleSecondPatient;
  assert.deepEqual(deriveM1V186Law5FromCausalSource(
    noPair,p.request.result,p.request.prematch),
    {ok:false,error:'UNSUPPORTED_LAW5_ORIGIN'});
  const illegal=structuredClone(source);
  illegal.causalAssessments.push(structuredClone(
    illegal.causalAssessments.find(a=>a.sameWhistleSecondPatient===true)));
  assert.deepEqual(deriveM1V186Law5FromCausalSource(
    illegal,p.request.result,p.request.prematch),
    {ok:false,error:'UNSUPPORTED_LAW5_ORIGIN'});
  const saved=applyM1V188LeagueMatch(career,zero.journal,p.request);
  assert.equal(saved.ok,true);
  assert.equal(saved.journal.entries[0].source.medicalPolicyVersion,3);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(saved.journal)).ok,true);
  assert.deepEqual(prepareM1V188LeagueMatch(
    career,saved.journal,[],undefined,2),
    {ok:false,error:'INVALID_REQUEST'});
  const second=prepareM1V188LeagueMatch(career,saved.journal);
  assert.equal(second?.ok,true);
  assert.equal(second.request.medicalPolicyVersion,3);
  const down=structuredClone(second.request);
  down.medicalPolicyVersion=2;
  assert.deepEqual(applyM1V188LeagueMatch(career,saved.journal,down),
    {ok:false,error:'SOURCE_MISMATCH'});
  const continued=applyM1V188LeagueMatch(
    career,saved.journal,second.request);
  assert.equal(continued.ok,true);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(continued.journal)).ok,true);
  const v2First=prepareM1V188LeagueMatch(
    career,zero.journal,[],undefined,2);
  assert.equal(v2First?.ok,true);
  const v2Saved=applyM1V188LeagueMatch(
    career,zero.journal,v2First.request);
  assert.equal(v2Saved.ok,true);
  const upgrade=prepareM1V188LeagueMatch(
    career,v2Saved.journal,[],undefined,3);
  assert.equal(upgrade?.ok,true);
  const promoted=applyM1V188LeagueMatch(
    career,v2Saved.journal,upgrade.request);
  assert.equal(promoted.ok,true);
  assert.equal(promoted.journal.entries[0].source.medicalPolicyVersion,2);
  assert.equal(promoted.journal.entries[1].source.medicalPolicyVersion,3);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(promoted.journal)).ok,true);
});

test('P3-2: v4 source proves same-team collision at actual referee whistle',()=>{
  let found=null;
  for(let seed=1;seed<=192&&!found;seed++){
    const career=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v188-p3-2-collision-'+seed);
    const zero=startM1V188LeagueJournal(career);
    if(!zero.ok)continue;
    const p=prepareM1V188LeagueMatch(
      career,zero.journal,[],undefined,4);
    if(!p?.ok)continue;
    const first=p.sourceLaw5Evidence?.find(e=>
      e.sourceCollisionEventId!==undefined&&
      e.sameWhistlePairOrdinal===undefined);
    const second=first&&p.sourceLaw5Evidence?.find(e=>
      e.sourceCollisionEventId===first.sourceCollisionEventId&&
      e.sameWhistlePairOrdinal===2);
    if(first&&second)found={career,zero,p,first,second};
  }
  assert.ok(found,'no first-fixture seeded source model collision');
  const {career,zero,p,first,second}=found;
  assert.equal(p.request.medicalPolicyVersion,4);
  assert.equal(p.externalMedicalAuthorityAuthenticated,false);
  assert.equal(first.sourceCollisionEventId,second.sourceCollisionEventId);
  assert.equal(first.whistleEventId,second.whistleEventId);
  assert.equal(first.restartEventId,second.restartEventId);
  assert.equal(first.patientTeamId,second.patientTeamId);
  assert.notEqual(first.patientPlayerId,second.patientPlayerId);
  const source=simulateM1V29CausalMedicalSource(
    p.request.prematch,p.request.policy,[],[],true,true,true,true);
  assert.equal(source.ok,true);
  const collision=source.match.events.find(e=>
    e.id===first.sourceCollisionEventId);
  assert.ok(collision);
  assert.equal(collision.kind,'synthetic-same-team-collision');
  assert.equal(collision.runningSeconds,first.runningSeconds);
  assert.equal(collision.teamId,first.patientTeamId);
  assert.equal(collision.playerId,first.patientPlayerId);
  assert.equal(collision.collisionPartnerPlayerId,second.patientPlayerId);
  const whistle=source.match.events.find(e=>
    e.id===first.whistleEventId);
  const card=source.match.events.find(e=>
    e.id===first.decisionEventId);
  assert.ok(whistle&&card);
  assert.ok(whistle.sequence<collision.sequence&&
    collision.sequence<card.sequence);
  assert.equal(collision.sourceEventId,card.sourceEventId);
  const present=collision.teamId===p.fixture.homeClubId?
    collision.onField.home:collision.onField.away;
  assert.ok(present.includes(first.patientPlayerId)&&
    present.includes(second.patientPlayerId));
  const keepers=[first.patientPlayerId,second.patientPlayerId]
    .filter(id=>catalog.players.find(p=>p.id===id)?.primaryPosition===
      'GK').length;
  const classification=keepers?
    'source-modelled-keeper-outfield-collision':
    'source-modelled-same-team-collision';
  assert.equal(first.exception,classification);
  assert.equal(second.exception,classification);
  const checked=deriveM1V186Law5FromCausalSource(
    source,p.request.result,p.request.prematch);
  assert.equal(checked.ok,true);
  assert.ok(checked.evidence.some(e=>
    e.sourceCollisionEventId===collision.id));
  for(const mutate of [
    broken=>{broken.match.events.find(e=>
      e.id===collision.id).sourceEventId='forged-card-origin';},
    broken=>{broken.match.events.find(e=>
      e.id===collision.id).collisionPartnerPlayerId=first.patientPlayerId;},
    broken=>{broken.causalAssessments.find(a=>
      a.collisionEventId===collision.id).collisionOriginSource=false;},
    broken=>{
      const event=broken.match.events.find(e=>e.id===collision.id);
      const side=event.teamId===p.fixture.homeClubId?'home':'away';
      const other=side==='home'?'away':'home';
      event.onField[side]=event.onField[side].filter(id=>
        id!==second.patientPlayerId);
      event.onField[other].push(second.patientPlayerId);
    },
  ]){
    const forged=structuredClone(source);
    mutate(forged);
    assert.deepEqual(deriveM1V186Law5FromCausalSource(
      forged,p.request.result,p.request.prematch),
      {ok:false,error:'UNSUPPORTED_LAW5_ORIGIN'},
      'caller-mutated collision facts may not create Law 5 authority');
  }
  const duplicated=structuredClone(source);
  duplicated.match.events.push(structuredClone(
    duplicated.match.events.find(e=>e.id===collision.id)));
  assert.deepEqual(deriveM1V186Law5FromCausalSource(
    duplicated,p.request.result,p.request.prematch),
    {ok:false,error:'INVALID_MEDICAL_CHRONOLOGY'},
    'extra collision event without distinct patients must be rejected');
  const recorded=applyM1V188LeagueMatch(
    career,zero.journal,p.request);
  assert.equal(recorded.ok,true);
  assert.equal(recorded.journal.entries[0].source.medicalPolicyVersion,4);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(recorded.journal)).ok,true);
  const next=prepareM1V188LeagueMatch(career,recorded.journal);
  assert.equal(next?.ok,true);
  assert.equal(next.request.medicalPolicyVersion,4);
  assert.deepEqual(prepareM1V188LeagueMatch(
    career,recorded.journal,[],undefined,3),
    {ok:false,error:'INVALID_REQUEST'});
  const forbidden=structuredClone(next.request);
  forbidden.medicalPolicyVersion=3;
  assert.deepEqual(applyM1V188LeagueMatch(
    career,recorded.journal,forbidden),
    {ok:false,error:'SOURCE_MISMATCH'});
  const forgedRequest=structuredClone(p.request);
  forgedRequest.sourceCollisionEventId=collision.id;
  assert.deepEqual(applyM1V188LeagueMatch(
    career,zero.journal,forgedRequest),
    {ok:false,error:'INVALID_REQUEST'});
  const savedNext=applyM1V188LeagueMatch(
    career,recorded.journal,next.request);
  assert.equal(savedNext.ok,true);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(savedNext.journal)).ok,true);
  const old=prepareM1V188LeagueMatch(
    career,zero.journal,[],undefined,3);
  assert.equal(old?.ok,true);
  const oldSaved=applyM1V188LeagueMatch(
    career,zero.journal,old.request);
  assert.equal(oldSaved.ok,true);
  const upgrade=prepareM1V188LeagueMatch(
    career,oldSaved.journal,[],undefined,4);
  assert.equal(upgrade?.ok,true);
  const promoted=applyM1V188LeagueMatch(
    career,oldSaved.journal,upgrade.request);
  assert.equal(promoted.ok,true);
  assert.deepEqual(promoted.journal.entries.map(e=>
    e.source.medicalPolicyVersion),[3,4]);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(promoted.journal)).ok,true);
});

test('P3-2: v5 independent collision produces own medical whistle, no card',()=>{
  let witness=null;
  for(let seed=1;seed<=96&&!witness;seed++){
    const career=createInitialCareer(
      catalog,catalog.clubs[0].id,seed,'v188-independent-p3-2-'+seed);
    const zero=startM1V188LeagueJournal(career);
    if(!zero.ok)continue;
    const p=prepareM1V188LeagueMatch(
      career,zero.journal,[],undefined,5);
    if(!p?.ok)continue;
    const first=p.sourceLaw5Evidence?.find(e=>
      e.decisionEventId===null&&
      e.sameWhistlePairOrdinal===undefined&&
      e.sourceCollisionEventId);
    const second=first&&p.sourceLaw5Evidence?.find(e=>
      e.incidentId===first.incidentId&&
      e.decisionEventId===null&&
      e.sameWhistlePairOrdinal===2);
    if(first&&second)witness={career,zero,p,first,second};
  }
  assert.ok(witness,'no autonomous collision in seeded first fixture');
  const {career,zero,p,first,second}=witness;
  assert.equal(p.request.medicalPolicyVersion,5);
  assert.equal(first.decisionEventId,null);
  assert.equal(first.offenderTeamId,null);
  assert.equal(first.offenderPlayerId,null);
  assert.equal(first.whistleEventId,second.whistleEventId);
  assert.equal(first.restartEventId,second.restartEventId);
  assert.equal(first.sourceCollisionEventId,second.sourceCollisionEventId);
  assert.equal(first.patientTeamId,second.patientTeamId);
  assert.notEqual(first.patientPlayerId,second.patientPlayerId);
  const keepers=[first.patientPlayerId,second.patientPlayerId]
    .filter(id=>catalog.players.find(p=>p.id===id)?.
      primaryPosition==='GK').length;
  const name=keepers?
    'independent-keeper-outfield-collision':
    'independent-same-team-collision';
  assert.equal(first.exception,name);
  assert.equal(second.exception,name);
  const source=simulateM1V29CausalMedicalSource(
    p.request.prematch,p.request.policy,[],[],true,true,true,true,true);
  assert.equal(source.ok,true);
  assert.equal(source.autonomousCollisions?.length,1);
  const claimed=source.autonomousCollisions[0];
  assert.deepEqual(p.request.autonomousMedicalOrigin,
    source.autonomousCollisions,
    'persisted v5 source must include the exact regenerated witness');
  assert.equal(first.incidentId,claimed.id);
  assert.equal(first.patientPlayerId,claimed.firstPlayerId);
  assert.equal(second.patientPlayerId,claimed.secondPlayerId);
  assert.ok(!source.generatedIncidents.some(i=>
    i.elapsedSeconds===claimed.elapsedSeconds),
    'standalone whistle must NOT be tied to an opponent offence');
  const events=source.match.events.filter(e=>e.sourceEventId===claimed.id);
  assert.equal(events.length,3);
  assert.deepEqual(events.map(e=>e.kind),[
    'synthetic-medical-whistle','synthetic-same-team-collision',
    'synthetic-medical-restart']);
  assert.equal(events[0].id,claimed.whistleEventId);
  assert.equal(events[1].id,claimed.collisionEventId);
  assert.equal(events[2].id,claimed.restartEventId);
  assert.ok(events[0].sequence<events[1].sequence&&
    events[1].sequence<events[2].sequence);
  assert.equal(events[0].runningSeconds,events[2].runningSeconds);
  assert.ok(events[2].wallSeconds>events[0].wallSeconds);
  const present=claimed.teamId===p.fixture.homeClubId?
    events[1].onField.home:events[1].onField.away;
  assert.ok(present.includes(first.patientPlayerId)&&
    present.includes(second.patientPlayerId));
  const checked=deriveM1V186Law5FromCausalSource(
    source,p.request.result,p.request.prematch);
  assert.equal(checked.ok,true);
  assert.equal(checked.evidence.filter(e=>
    e.incidentId===claimed.id).length,2);
  for(const mutation of [
    bad=>{bad.autonomousCollisions[0].firstPlayerId=
      bad.autonomousCollisions[0].secondPlayerId;},
    bad=>{bad.match.events.find(e=>
      e.id===claimed.collisionEventId).collisionPartnerPlayerId=
        'fabricated-player';},
    bad=>{bad.match.events.find(e=>
      e.id===claimed.whistleEventId).sourceEventId='untrusted';},
    bad=>{bad.match.events.find(e=>
      e.id===claimed.restartEventId).runningSeconds+=300;},
    bad=>{
      const e=bad.match.events.find(e=>
        e.id===claimed.collisionEventId);
      const side=claimed.teamId===p.fixture.homeClubId?'home':'away';
      e.onField[side]=e.onField[side].filter(id=>
        id!==claimed.secondPlayerId);
    },
  ]){
    const forged=structuredClone(source);
    mutation(forged);
    assert.deepEqual(deriveM1V186Law5FromCausalSource(
      forged,p.request.result,p.request.prematch),
      {ok:false,error:'UNSUPPORTED_LAW5_ORIGIN'},
      'an invented medical source must never grant a Law 5 exception');
  }
  const twice=structuredClone(source);
  twice.autonomousCollisions.push(
    structuredClone(twice.autonomousCollisions[0]));
  assert.deepEqual(deriveM1V186Law5FromCausalSource(
    twice,p.request.result,p.request.prematch),
    {ok:false,error:'INVALID_CAUSAL_SOURCE'});
  const malformed=structuredClone(source);
  malformed.autonomousCollisions={pretendTrusted:true};
  assert.deepEqual(deriveM1V186Law5FromCausalSource(
    malformed,p.request.result,p.request.prematch),
    {ok:false,error:'INVALID_CAUSAL_SOURCE'});
  const firstSave=applyM1V188LeagueMatch(
    career,zero.journal,p.request);
  assert.equal(firstSave.ok,true);
  assert.equal(firstSave.journal.entries[0].source.medicalPolicyVersion,5);
  assert.deepEqual(firstSave.journal.entries[0].source.autonomousMedicalOrigin,
    p.request.autonomousMedicalOrigin);
  const stripped=structuredClone(p.request);
  delete stripped.autonomousMedicalOrigin;
  assert.deepEqual(applyM1V188LeagueMatch(
    career,zero.journal,stripped),
    {ok:false,error:'INVALID_REQUEST'});
  const incorrect=structuredClone(p.request);
  incorrect.autonomousMedicalOrigin[0].secondPlayerId='invented';
  assert.deepEqual(applyM1V188LeagueMatch(
    career,zero.journal,incorrect),
    {ok:false,error:'SOURCE_MISMATCH'});
  const tampered=structuredClone(firstSave.journal);
  tampered.entries[0].source.autonomousMedicalOrigin[0].teamId='unverified';
  assert.deepEqual(validateM1V188LeagueJournal(career,tampered),
    {ok:false,error:'INVALID_JOURNAL'});
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(firstSave.journal)).ok,true);
  const follow=prepareM1V188LeagueMatch(career,firstSave.journal);
  assert.equal(follow?.ok,true);
  assert.equal(follow.request.medicalPolicyVersion,5);
  assert.deepEqual(prepareM1V188LeagueMatch(
    career,firstSave.journal,[],undefined,4),
    {ok:false,error:'INVALID_REQUEST'});
  const wrong=structuredClone(follow.request);
  wrong.medicalPolicyVersion=4;
  assert.deepEqual(applyM1V188LeagueMatch(
    career,firstSave.journal,wrong),
    {ok:false,error:'INVALID_REQUEST'},
    'v4 cannot smuggle v5-only origin fields');
  delete wrong.autonomousMedicalOrigin;
  assert.deepEqual(applyM1V188LeagueMatch(
    career,firstSave.journal,wrong),
    {ok:false,error:'SOURCE_MISMATCH'},
    'well-formed v4 downgrade still rejected by prior v5 policy');
  const secondSave=applyM1V188LeagueMatch(
    career,firstSave.journal,follow.request);
  assert.equal(secondSave.ok,true);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(secondSave.journal)).ok,true);
  const previous=prepareM1V188LeagueMatch(
    career,zero.journal,[],undefined,4);
  assert.equal(previous?.ok,true);
  const previousSaved=applyM1V188LeagueMatch(
    career,zero.journal,previous.request);
  assert.equal(previousSaved.ok,true);
  const labelOnly=structuredClone(previousSaved.journal);
  labelOnly.entries[0].source.medicalPolicyVersion=5;
  assert.deepEqual(validateM1V188LeagueJournal(career,labelOnly),
    {ok:false,error:'INVALID_JOURNAL'},
    'version-only label must not pass off an old v4 fixture as v5');
  const upgraded=prepareM1V188LeagueMatch(
    career,previousSaved.journal,[],undefined,5);
  assert.equal(upgraded?.ok,true);
  const migrated=applyM1V188LeagueMatch(
    career,previousSaved.journal,upgraded.request);
  assert.equal(migrated.ok,true);
  assert.deepEqual(migrated.journal.entries.map(e=>
    e.source.medicalPolicyVersion),[4,5]);
  assert.equal(validateM1V188LeagueJournal(
    career,structuredClone(migrated.journal)).ok,true);
});

test('P3-2: v5 independent medical stops keep strict clock across half-time',()=>{
  let firstHalf=0,secondHalf=0,compared=0;
  for(let seed=1;seed<=32;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,seed,
      'v188-independent-clock-boundary-'+seed);
    const zero=startM1V188LeagueJournal(career);
    assert.equal(zero.ok,true);
    const baseline=prepareM1V188LeagueMatch(
      career,zero.journal,[],undefined,4);
    if(!baseline.ok)continue;
    const generated=prepareM1V188LeagueMatch(
      career,zero.journal,[],undefined,5);
    assert.equal(generated.ok,true,
      'v5 must not lose a legal v4 fixture because of missing source shots');
    compared++;
    const evidence=generated.request.autonomousMedicalOrigin;
    assert.ok(Array.isArray(evidence)&&evidence.length<=1);
    if(!evidence.length)continue;
    const witness=evidence[0];
    const source=simulateM1V29CausalMedicalSource(
      generated.request.prematch,generated.request.policy,
      [],[],true,true,true,true,true);
    assert.equal(source.ok,true);
    const match=source.match.events;
    for(let n=1;n<match.length;n++){
      assert.ok(match[n].runningSeconds>=match[n-1].runningSeconds,
        'autonomous event must never rewind running time');
      assert.ok(match[n].wallSeconds>=match[n-1].wallSeconds,
        'autonomous event must never rewind stopped-wall time');
    }
    const medical=match.find(e=>e.id===witness.collisionEventId);
    const half=match.find(e=>e.kind==='half-time-whistle');
    const full=match.find(e=>e.kind==='full-time');
    assert.ok(medical&&half&&full&&
      medical.sequence<full.sequence,
      'standalone collision must be emitted before full-time');
    if(witness.elapsedSeconds<2700){
      firstHalf++;
      assert.ok(medical.sequence<half.sequence,
        'first-half collision cannot be emitted after half-time whistle');
    }else{
      secondHalf++;
      assert.ok(half.sequence<medical.sequence,
        'second-half collision must follow half-time whistle');
    }
  }
  assert.ok(compared>=16&&firstHalf>0&&secondHalf>0,
    'must sample source-valid v5 collisions on both sides of half-time');
});

test('P3-3: external claims and even an empty purported clearance fail closed',()=>{
  const career=createInitialCareer(
    catalog,catalog.clubs[0].id,8,'v188-no-external-kdk-attestation');
  const start=startM1V188LeagueJournal(career);
  assert.equal(start.ok,true);
  const proposal=prepareM1V188LeagueMatch(career,start.journal);
  assert.equal(proposal?.ok,true);
  const baseline=inspectM1V188FictionalHolds(career,start.journal);
  assert.equal(baseline.ok,true);
  assert.equal(baseline.externalKdkAuthenticated,false);
  assert.equal(baseline.officialClearanceAuthenticated,false);
  assert.deepEqual(baseline.holds,[]);
  for(const untrusted of [[],[{rulingId:'unverified-kdk-order'}],
    {appeal:'cancelled'},null]){
    assert.deepEqual(prepareM1V188LeagueMatch(
      career,start.journal,[],untrusted),
      {ok:false,error:'UNVERIFIED_EXTERNAL_DISCIPLINE'});
    assert.deepEqual(applyM1V188LeagueMatch(
      career,start.journal,proposal.request,untrusted),
      {ok:false,error:'UNVERIFIED_EXTERNAL_DISCIPLINE'});
  }
  const applied=applyM1V188LeagueMatch(
    career,start.journal,proposal.request);
  assert.equal(applied.ok,true,
    'fictional mode remains playable with no official attestation claim');
  assert.equal(inspectM1V188FictionalHolds(
    career,applied.journal).ok,true);
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
  const timeline=inspectM1V188FictionalHolds(
    career,structuredClone(journal));
  assert.equal(timeline.ok,true);
  assert.equal(timeline.journalRevision,journal.revision);
  assert.equal(timeline.externalKdkAuthenticated,false);
  assert.equal(timeline.officialClearanceAuthenticated,false);
  const four=timeline.holds.filter(h=>h.reason==='four-cautions');
  assert.ok(four.length>0,'replay must report source-derived bans');
  assert.ok(four.some(h=>h.remainingOwnFixtures===0),
    'at least one fourth-warning ban must be served');
  const fixtures=inspectM1V188LeagueCalendar(career).fixtures;
  for(const h of timeline.holds){
    const future=fixtures.slice(h.sourceIndex+1).filter(f=>
      f.homeClubId===h.clubId||f.awayClubId===h.clubId);
    const played=future.filter(f=>
      fixtures.indexOf(f)<journal.revision).length;
    assert.equal(h.servedOwnFixtures,
      Math.min(h.missedOwnFixtures,played));
    assert.equal(h.remainingOwnFixtures,
      Math.max(0,h.missedOwnFixtures-played));
    assert.equal(h.lastBlockedFixtureId,
      future[h.missedOwnFixtures-1]?.id??null);
    assert.equal(fixtures[h.sourceIndex].id,h.sourceFixtureId);
  }
  const forged=structuredClone(journal);
  forged.entries[0].result.report.home.goals++;
  assert.deepEqual(inspectM1V188FictionalHolds(career,forged),
    {ok:false,error:'INVALID_JOURNAL'});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V12GoalBoardRoster, verifyM1V12GoalBoardRoster }
  from '../dist/core/m1-v12-goal-board-roster.js';
import { simulateM1V10WithInternalGoalBoards }
  from '../dist/core/m1-v10-internal-referee-boards.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.awayClubId));
const lookup = new Map(catalog.players.map(p => [p.id, p]));
const eligible = ids => ids.filter(id => lookup.get(id).primaryPosition !== 'GK');
const outs = {home:eligible(home.starters),away:eligible(away.starters)};
const ins = {home:eligible(home.bench),away:eligible(away.bench)};
const policy = {
  home: {assignedActor:{kind:'player'},availableStaffIds:[]},
  away: {assignedActor:{kind:'player'},availableStaffIds:[]},
};
const input = (rngSeed = 645) => ({
  schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
  rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
  fixture,catalog,homeLineup:home,awayLineup:away,
  homeTactics:defaultTacticalPlan(fixture.homeClubId),
  awayTactics:defaultTacticalPlan(fixture.awayClubId),
  rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
  rngAlgorithmVersion:RNG_VERSION,rngSeed,
});
const command = (i,side='home') => ({
  schemaVersion:1,kind:'substitute-normal',
  fixtureId:fixture.id,commandId:'v12-change-'+side+'-'+i,
  teamId:side==='home'?fixture.homeClubId:fixture.awayClubId,
  elapsedSeconds:300,actor:{kind:'player'},
  stoppage:'referee-authorized',
  outPlayerId:outs[side][i],inPlayerId:ins[side][i],
});
const run = (commands=[],pause=7,seed=645) =>
  simulateM1V12GoalBoardRoster(input(seed),policy,commands,pause);
const yes = x => {
  assert.equal(x.ok,true,JSON.stringify(x).slice(0,350));
  return x;
};
const no = (x,error) => assert.equal(x.error,error,JSON.stringify(x).slice(0,350));

test('goal whistle, internal board, XI replacement and restart form ONE chronological stream',()=>{
  const commands=[command(0)];
  const output=yes(run(commands));
  const relevant=output.events.filter(x => x.runningSeconds===299);
  assert.deepEqual(relevant.map(x=>x.kind),[
    'source-shot','goal-whistle','board-signal',
    'substitution-applied','restart-kickoff',
  ]);
  assert.deepEqual(relevant.map(x=>x.wallSeconds),[299,299,299,299,306]);
  assert.equal(relevant[0].playerId!==null,true);
  assert.ok(relevant[0].onField.home.includes(outs.home[0]));
  assert.ok(!relevant[0].onField.home.includes(ins.home[0]));
  assert.ok(relevant[3].onField.home.includes(ins.home[0]));
  assert.ok(!relevant[3].onField.home.includes(outs.home[0]));
  assert.deepEqual(relevant[3].onField,relevant[4].onField);
  assert.equal(output.generatedSpecialEvents,false);
  assert.equal(output.lateSubstitutionPendingSupported,false);
  const old=simulateM1V10WithInternalGoalBoards(input(),policy,commands,[],[]);
  assert.equal(old.ok,true);
  assert.deepEqual(output.finalOnField,old.result.onFieldAtFullTime);
  assert.deepEqual(output.finalScore,{
    home:old.result.report.home.goals,
    away:old.result.report.away.goals,
  });
  assert.equal(output.rngDraws,old.result.rngDraws);
  assert.equal(output.rngState,old.result.rngState);
  assert.equal(verifyM1V12GoalBoardRoster(input(),policy,commands,7,output),true);
});

test('simultaneous boards for both clubs retain monotonic wall time and legal XI',()=>{
  const commands=[command(0),command(1),command(0,'away')];
  const source=structuredClone(commands);
  const output=yes(run(commands,7));
  const stop=output.events.filter(e=>e.runningSeconds===299);
  assert.deepEqual(stop.filter(e=>e.kind==='board-signal').length,3);
  assert.deepEqual(stop.filter(e=>e.kind==='substitution-applied').length,3);
  assert.ok(stop.every((e,i)=>i===0 || e.wallSeconds>=stop[i-1].wallSeconds));
  assert.ok(output.finalOnField.home.includes(ins.home[0]));
  assert.ok(output.finalOnField.home.includes(ins.home[1]));
  assert.ok(output.finalOnField.away.includes(ins.away[0]));
  assert.equal(output.finalOnField.home.length,11);
  assert.equal(output.finalOnField.away.length,11);
  assert.deepEqual(commands,source);
  assert.ok(output.events.every((e,i)=>
    i===0 || e.wallSeconds>=output.events[i-1].wallSeconds));
  for (const shot of output.events.filter(e=>e.kind==='source-shot')) {
    const side=shot.teamId===fixture.homeClubId?'home':'away';
    assert.ok(shot.onField[side].includes(shot.playerId));
  }
});

test('stoppage wall-time must cover the last internally issued board signal',()=>{
  no(run([command(0),command(1)],0),'STOPPAGE_TOO_SHORT');
  yes(run([command(0),command(1)],1));
  yes(run([command(0)],0));
  for (const pause of [-1,121,1.5,NaN,Infinity,null,'7']) {
    no(run([],pause),'INVALID_PAUSE');
  }
});

test('no-goal manager attempts fail, while an empty-command game replays old source',()=>{
  no(run([command(0)],7,49),'SOURCE_MATCH_REJECTED');
  const output=yes(run([],0,49));
  assert.equal(output.events.some(x=>x.kind==='board-signal'),false);
  assert.equal(output.events.at(-1).runningSeconds,5400);
  assert.equal(output.events.at(-1).wallSeconds,5400);
  assert.equal(verifyM1V12GoalBoardRoster(input(49),policy,[],0,output),true);
});

test('forged command, altered saved event, and getter refuse without evaluation',()=>{
  const correct=yes(run([command(0)]));
  for (const forged of [
    x=>{x.events[3].onField.home.push('forged-player');},
    x=>{x.events[4].wallSeconds+=1;},
    x=>{x.finalScore.home+=1;},
    x=>{x.pauseWallSeconds=10;},
    x=>{x.events[3].kind='source-shot';},
    x=>{x.rngState=0;},
  ]) {
    const changed=structuredClone(correct);
    forged(changed);
    assert.equal(verifyM1V12GoalBoardRoster(input(),policy,[command(0)],7,changed),false);
  }
  let calls=0;
  const malicious=structuredClone(correct);
  Object.defineProperty(malicious.events[0],'wallSeconds',{
    enumerable:true,get(){calls++;return 0;},
  });
  assert.equal(verifyM1V12GoalBoardRoster(
    input(),policy,[command(0)],7,malicious),false);
  assert.equal(calls,0);
  const cyclic=[command(0)];cyclic[0].recursive=cyclic;
  no(run(cyclic),'INVALID_SOURCE');
  no(run([{...command(0),kind:'set-tactics'}]),'UNSUPPORTED_COMMAND');
  no(run([{...command(0),outPlayerId:outs.away[0]}]),
    'SOURCE_MATCH_REJECTED');
});

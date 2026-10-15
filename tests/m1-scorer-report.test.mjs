import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveM1VerifiedScorerReport, M1_SCORER_REPORT_SCHEMA_VERSION,
} from '../dist/core/m1-scorer-report.js';
import { simulateM1V5Phases } from '../dist/core/m1-phases-v5.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
const homeLineup = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
const awayLineup = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
const players = new Map(catalog.players.map(p => [p.id, p]));
const homeOutfield = homeLineup.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const awayOutfield = awayLineup.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const homeBench = homeLineup.bench.filter(id => players.get(id).primaryPosition !== 'GK');
const awayBench = awayLineup.bench.filter(id => players.get(id).primaryPosition !== 'GK');
const prematch = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup, awayLineup,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'staff', staffId: 'away-coach' },
    availableStaffIds: ['away-coach'] },
};
const sub = (id, time, side='home') => ({
  schemaVersion: 1, commandId: id, fixtureId: fixture.id,
  teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
  elapsedSeconds: time, actor: side === 'home' ? {kind:'player'} :
    {kind:'staff', staffId:'away-coach'},
  kind: 'substitute-normal',
  outPlayerId: side === 'home' ? homeOutfield[0] : awayOutfield[0],
  inPlayerId: side === 'home' ? homeBench[0] : awayBench[0],
  stoppage: time === 2700 ? 'half-time' : 'referee-authorized',
});
function good(input, commands=[]) {
  const generated = simulateM1V5Phases(input, policy, commands);
  assert.equal(generated.ok, true);
  if (!generated.ok) throw Error(generated.error);
  const report = deriveM1VerifiedScorerReport(input, policy, commands, generated);
  assert.equal(report.ok, true, JSON.stringify(report).slice(0,300));
  if (!report.ok) throw Error(report.error);
  return { generated, report: report.report };
}

test('v5 scorer projection has separate v1 schema and no fabricated special goals', () => {
  assert.equal(M1_SCORER_REPORT_SCHEMA_VERSION, 1);
  const {generated, report} = good(prematch);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.status, 'SYNTHETIC_V5_OPEN_PLAY_ONLY');
  assert.equal(report.actionEngineVersion, '4');
  assert.equal(report.actionSchemaVersion, 5);
  assert.equal(report.fixtureId, fixture.id);
  assert.equal(report.rngSeed, 42);
  assert.deepEqual(report.match, generated.report);
  assert.equal(report.players.length, 22);
  assert.ok(report.players.every(p => p.started && p.enteredAtSeconds === 0 &&
    p.leftAtSeconds === 5400 && p.playedSeconds === 5400));
  assert.ok(report.goals.every(goal => goal.kind === 'synthetic-open-play-shot'));
});

test('every player shot, target, goal and xG equals the verified ledger', () => {
  for (let seed=1; seed<=80; seed++){
    const { generated, report } = good({...prematch, rngSeed: seed});
    const byId = new Map(report.players.map(p => [p.playerId,p]));
    const shots = generated.events.filter(e => e.type === 'shot');
    assert.equal(shots.length, report.players.reduce((n,p) => n+p.shots,0));
    assert.equal(shots.filter(e => e.outcome === 'goal').length, report.goals.length);
    assert.equal(shots.reduce((n,e)=>n+e.xgMilli,0),
      report.players.reduce((n,p)=>n+p.xgMilli,0));
    assert.equal(shots.filter(e => e.outcome === 'goal' || e.outcome === 'saved').length,
      report.players.reduce((n,p)=>n+p.shotsOnTarget,0));
    for(const goal of report.goals) {
      const shot = shots.find(s => s.id === goal.eventId);
      assert.equal(shot?.outcome, 'goal');
      assert.equal(goal.scorerId, shot.playerId);
      assert.equal(goal.teamId, shot.teamId);
      assert.equal(byId.get(goal.scorerId)?.teamId, shot.teamId);
    }
    assert.equal(report.players.reduce((n,p)=>n+p.playedSeconds,0), 22*5400);
  }
});

test('substitutions produce correct per-player participation without resurrecting old shooters', () => {
  const commands = [sub('h-1',300), sub('a-1',2700,'away')];
  const { generated, report } = good(prematch,commands);
  assert.equal(report.players.length, 24);
  const map = new Map(report.players.map(p=>[p.playerId,p]));
  assert.equal(map.get(homeOutfield[0]).playedSeconds, 300);
  assert.equal(map.get(homeOutfield[0]).leftAtSeconds,300);
  assert.equal(map.get(homeBench[0]).enteredAtSeconds,300);
  assert.equal(map.get(homeBench[0]).playedSeconds,5100);
  assert.equal(map.get(homeBench[0]).started,false);
  assert.equal(map.get(awayOutfield[0]).playedSeconds,2700);
  assert.equal(map.get(awayBench[0]).playedSeconds,2700);
  assert.ok(generated.events.filter(e=>e.type==='shot' && e.elapsedSeconds>=300)
    .every(e=>e.playerId!==homeOutfield[0]));
  assert.ok(generated.events.filter(e=>e.type==='shot' && e.elapsedSeconds>=2700)
    .every(e=>e.playerId!==awayOutfield[0]));
  assert.equal(report.players.filter(p=>p.teamId===fixture.homeClubId)
    .reduce((n,p)=>n+p.playedSeconds,0), 11*5400);
  assert.equal(report.players.filter(p=>p.teamId===fixture.awayClubId)
    .reduce((n,p)=>n+p.playedSeconds,0), 11*5400);
});

test('same source, seed and commands recreate identical JSON report after roundtrip', () => {
  const commands=[sub('half',2700)];
  const first=good(prematch,commands).report;
  const second=good(structuredClone(prematch),structuredClone(commands)).report;
  assert.equal(JSON.stringify(first),JSON.stringify(second));
  assert.deepEqual(JSON.parse(JSON.stringify(first)),first);
});

test('forged aggregate, claimed scorer, player, PRNG and original command fail closed', () => {
  const commands=[sub('h-1',300)];
  const goodRun=simulateM1V5Phases(prematch,policy,commands);
  assert.equal(goodRun.ok,true);
  if(!goodRun.ok)return;
  const changes=[
    null,{},[],
    {...goodRun, rngSeed:43},
    {...goodRun, rngState:7},
    {...goodRun, report:{...goodRun.report,home:{...goodRun.report.home,goals:99}}},
    {...goodRun, events:[...goodRun.events,{type:'goal'}]},
    {...goodRun, events:goodRun.events.slice(1)},
    {...goodRun, substitutions:{...goodRun.substitutions,
      teams:{...goodRun.substitutions.teams,home:{...goodRun.substitutions.teams.home,
        active:[...homeLineup.starters]}}}},
    {...goodRun, extra:undefined},
  ];
  for(const candidate of changes)
    assert.deepEqual(deriveM1VerifiedScorerReport(prematch,policy,commands,candidate),
      {ok:false,error:'INVALID_MATCH_INPUT'});
  assert.deepEqual(deriveM1VerifiedScorerReport(prematch,policy,[],goodRun),
    {ok:false,error:'INVALID_MATCH_INPUT'});
});

test('malformed pre-match or ineligible replacement cannot return an invented report', () => {
  const candidate=simulateM1V5Phases(prematch,policy);
  assert.equal(candidate.ok,true);
  assert.deepEqual(deriveM1VerifiedScorerReport({...prematch,rngSeed:0},policy,[],candidate),
    {ok:false,error:'INVALID_MATCH_INPUT'});
  assert.deepEqual(deriveM1VerifiedScorerReport(prematch,{},[],candidate),
    {ok:false,error:'INVALID_MATCH_INPUT'});
  const invalid=[{...sub('x',300),inPlayerId:'forged'}];
  assert.deepEqual(deriveM1VerifiedScorerReport(prematch,policy,invalid,candidate),
    {ok:false,error:'INVALID_MATCH_INPUT'});
});

test('original catalog, fixtures, player records and external result stay unchanged',()=>{
  const before=JSON.stringify(prematch);
  const candidate=simulateM1V5Phases(prematch,policy);
  const old=JSON.stringify(candidate);
  const out=deriveM1VerifiedScorerReport(prematch,policy,[],candidate);
  assert.equal(out.ok,true);
  assert.equal(JSON.stringify(prematch),before);
  assert.equal(JSON.stringify(candidate),old);
});

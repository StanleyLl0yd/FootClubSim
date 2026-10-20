import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V22FoulStoppageCoaching as simulate,
  verifyM1V22FoulStoppageCoaching as verify }
  from '../dist/core/m1-v22-inplay-foul-coaching.js';
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
const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
const homeOut = home.starters.filter(id => positions.get(id) !== 'GK');
const awayOut = away.starters.filter(id => positions.get(id) !== 'GK');
const homeBench = home.bench.filter(id => positions.get(id) !== 'GK');
const prematch = (seed = 645) => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const sub = (outPlayerId, inPlayerId, second = 2700) => ({
  schemaVersion: 1, kind: 'substitute-normal', fixtureId: fixture.id,
  commandId: 'v16-sub-' + second + '-' + outPlayerId,
  teamId: fixture.homeClubId, elapsedSeconds: second, actor: { kind: 'player' },
  stoppage: second === 2700 ? 'half-time' : 'referee-authorized',
  outPlayerId, inPlayerId,
});
const departure = (playerId, side = 'home', second = 0, id = 'v16-exit') => ({
  schemaVersion: 1, id, fixtureId: fixture.id,
  teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
  playerId, elapsedSeconds: second, kind: 'treatment-exit',
  reason: 'medical-staff-entered', restartAtRunningSeconds: second + 15,
});
const returning = (playerId, side = 'home', second = 300, id = 'v16-return') => ({
  schemaVersion: 1, id, fixtureId: fixture.id,
  teamId: side === 'home' ? fixture.homeClubId : fixture.awayClubId,
  playerId, elapsedSeconds: second, kind: 'treatment-return',
  returnContext: 'running-clock', ballInPlay: true, entryBoundary: 'touchline',
  refereeSignalId: 'claimed-v16-referee-signal',
});
const run = (seed = 645, half = [], inPlay = []) =>
  simulate(prematch(seed), policy, half, inPlay);
const ok = r => { assert.equal(r.ok, true, JSON.stringify(r).slice(0, 450)); return r; };
const bad = (r, error) => assert.equal(r.error, error, JSON.stringify(r));


test('seeded foul creates verifiable in-play substitution before later shots', () => {
  const initial = ok(run(645));
  const foul = initial.generatedIncidents.find(e =>
    e.sanction !== 'injury-withdrawal');
  assert.ok(foul, 'seed must generate at least one foul');
  const second = foul.elapsedSeconds;
  const before = initial.match.events.find(e =>
    e.id === foul.sourceEventId);
  assert.ok(before);
  const target = homeOut.find(id => before.onField.home.includes(id) &&
    id !== foul.playerId);
  assert.ok(target);
  const command = sub(target, homeBench[0], second);
  const result = ok(run(645, [], [command]));
  assert.equal(result.acceptedInPlayCommands, 1);
  assert.equal(result.inGameRefereeGenerated, true);
  assert.equal(result.inPlayCoachingAtGeneratedFoulSupported, true);
  const whistle = result.match.events.find(e =>
    e.kind === 'synthetic-foul-whistle' &&
    e.runningSeconds === second);
  const applied = result.match.events.find(e =>
    e.kind === 'substitution-applied' && e.runningSeconds === second &&
    e.playerId === target);
  const restart = result.match.events.find(e =>
    e.kind === 'synthetic-foul-restart' && e.runningSeconds === second);
  assert.ok(whistle, 'no internally sourced whistle');
  assert.ok(applied, 'substitution never reached physical XI');
  assert.ok(restart, 'no synthetic restart');
  assert.ok(whistle.sequence < applied.sequence);
  assert.ok(applied.sequence < restart.sequence);
  assert.equal(restart.wallSeconds - whistle.wallSeconds, 20);
  assert.equal(applied.onField.home.includes(target), false);
  assert.equal(applied.onField.home.includes(homeBench[0]), true);
  assert.equal(result.match.finalOnField.home.includes(target), false);
  assert.equal(result.match.finalOnField.home.includes(homeBench[0]), true);
  assert.equal(result.match.inPlayOpportunitiesUsed.home, 1);
  for (const shot of result.match.events.filter(e =>
    e.kind === 'shot' && e.runningSeconds > second &&
    e.teamId === fixture.homeClubId)) {
    assert.notEqual(shot.playerId, target);
    assert.ok(shot.onField.home.includes(shot.playerId));
  }
  assert.equal(result.match.refereeAuthorityAuthenticated, false);
  assert.equal(verify(prematch(645), policy, [], [command], result), true);
});

test('generated foul decisions and no-coaching source result remain seeded', async () => {
  const { simulateM1V20InternalReferee } =
    await import('../dist/core/m1-v20-referee-halftime-coaching.js');
  for (const seed of [1, 8, 645, 777]) {
    const result = ok(run(seed));
    const old = simulateM1V20InternalReferee(prematch(seed), policy);
    assert.equal(old.ok, true);
    assert.deepEqual(result.match.finalScore, old.match.finalScore);
    assert.deepEqual(result.match.finalOnField, old.match.finalOnField);
    assert.equal(result.match.rngState, old.match.rngState);
    assert.equal(result.refereeRngState, old.refereeRngState);
    assert.equal(result.refereeRngDraws, old.refereeRngDraws);
    assert.equal(result.generatedIncidents.length,
      old.generatedIncidents.length);
    assert.equal(result.acceptedInPlayCommands, 0);
    assert.equal(result.match.generatedFoulStoppages,
      result.generatedIncidents.filter(e =>
        e.sanction !== 'injury-withdrawal').length);
    assert.equal(verify(prematch(seed), policy, [], [], result), true);
  }
});

test('half-time and generated-foul in-play windows can coexist', () => {
  const original = ok(run(645));
  const foul = original.generatedIncidents.find(e =>
    e.sanction !== 'injury-withdrawal' && e.elapsedSeconds < 2700);
  assert.ok(foul);
  const forFoul = sub(homeOut[0], homeBench[0], foul.elapsedSeconds);
  const halfSub = sub(homeOut[1], homeBench[1], 2700);
  const result = ok(run(645, [halfSub], [forFoul]));
  assert.equal(result.acceptedHalfTimeCommands, 1);
  assert.equal(result.acceptedInPlayCommands, 1);
  assert.equal(result.match.inPlayOpportunitiesUsed.home, 1);
  assert.equal(result.match.halfTimeSubstitutions.home, 1);
  assert.equal(result.match.finalOnField.home.includes(homeBench[0]), true);
  assert.equal(result.match.finalOnField.home.includes(homeBench[1]), true);
  assert.equal(verify(prematch(645), policy, [halfSub], [forFoul], result), true);
});

test('arbitrary in-play whistle, wrong actor and illegal commands fail closed', () => {
  const standard = ok(run(645));
  const seconds = new Set(standard.generatedIncidents.filter(e =>
    e.sanction !== 'injury-withdrawal').map(e => e.elapsedSeconds));
  const noFoul = Array.from({length:17}, (_,i) => (i + 1) * 300)
    .find(t => t !== 2700 && !seconds.has(t));
  assert.ok(noFoul);
  bad(run(645, [], [sub(homeOut[0],homeBench[0],noFoul)]),
    'NO_GENERATED_FOUL_STOPPAGE');
  bad(run(645, [], [{...sub(homeOut[0],homeBench[0]),elapsedSeconds:300}]),
    'INVALID_INPLAY_COMMANDS');
  bad(run(645, [], [{...sub(homeOut[0],homeBench[0],300),
    actor:{kind:'staff',staffId:'ghost'}}]),
    'NO_GENERATED_FOUL_STOPPAGE');
  bad(run(645, [], [sub(homeOut[0],homeBench[0],2700)]),
    'INVALID_INPLAY_COMMANDS');
});

test('generated-source chronology and physical presence are replay-verified', () => {
  const a = ok(run(645));
  for (const event of a.match.events.filter(e => e.kind === 'shot')) {
    const side = event.teamId === fixture.homeClubId ? 'home' : 'away';
    assert.ok(event.onField[side].includes(event.playerId));
  }
  for (const edit of [
    x => { x.generatedIncidents[0].sourceEventId = 'forged'; },
    x => { x.match.events.find(e => e.kind === 'synthetic-foul-whistle')
      .teamId = 'forged'; },
    x => { x.match.inPlayOpportunitiesUsed.home++; },
    x => { x.match.finalScore.home++; },
    x => { x.acceptedInPlayCommands++; },
    x => { x.match.refereeAuthorityAuthenticated = true; },
  ]) {
    const forged = structuredClone(a);
    edit(forged);
    assert.equal(verify(prematch(645), policy, [], [], forged), false);
  }
  assert.equal(verify(prematch(777), policy, [], [], a), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V7Phases, verifyM1V7Result }
  from '../dist/core/m1-v7-adjudications.js';
import { deriveM1VerifiedV7AppearanceReport }
  from '../dist/core/m1-v7-appearance-report.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.awayClubId));
const players = new Map(catalog.players.map(p => [p.id, p]));
const homeField = home.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const awayField = away.starters.filter(id => players.get(id).primaryPosition !== 'GK');
const source = {
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
};
const policy = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
const commands = [{
  schemaVersion: 1, id: 'referee-red', fixtureId: fixture.id,
  teamId: fixture.homeClubId, playerId: homeField[2],
  elapsedSeconds: 1200, kind: 'direct-red', origin: 'trusted-referee',
}];
const decisions = [
  { schemaVersion: 1, decisionId: 'penalty', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: homeField[0],
    elapsedSeconds: 300, kind: 'penalty-kick', outcome: 'scored' },
  { schemaVersion: 1, decisionId: 'own-goal', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: awayField[0],
    elapsedSeconds: 600, kind: 'own-goal' },
];
const seeds = [...Array.from({ length: 24 }, (_, i) => i + 1),
  255, 65535, 0x7fffffff, 0xffffffff];
function run(seed, cmds = commands, rulings = decisions) {
  const prematch = { ...source, rngSeed: seed };
  const match = simulateM1V7Phases(prematch, policy, cmds, rulings);
  assert.equal(match.ok, true, JSON.stringify(match).slice(0, 180));
  return { prematch, match };
}

test('v7 mixed-event seeded cohort conserves PRNG and credited goal identities', () => {
  const baseline = JSON.stringify(source);
  const rulingBefore = JSON.stringify(decisions);
  for (const seed of seeds) {
    const { prematch, match } = run(seed);
    assert.deepEqual(simulateM1V7Phases(prematch, policy, commands, decisions), match);
    const attribution = deriveM1VerifiedV7AppearanceReport(
      prematch, policy, commands, decisions, match);
    assert.equal(attribution.ok, true, JSON.stringify(attribution).slice(0, 180));
    assert.ok(verifyM1V7Result(prematch, policy, commands, decisions, match));
    assert.equal(match.base.rngDraws, 90);
    const rng = new SeededRng(seed);
    for (let i = 0; i < 90; i++) rng.nextFloat();
    assert.equal(match.base.rngState, rng.snapshot());
    assert.equal(match.events.at(-1).source.type, 'full-time');
    assert.ok(match.events.every((event, index) => event.sequence === index + 1 &&
      (index === 0 || event.elapsedSeconds >= match.events[index - 1].elapsedSeconds)));
    assert.equal(match.report.home.penaltyGoals, 1);
    assert.equal(match.report.home.ownGoalsFor, 1);
    assert.equal(match.report.home.goals,
      match.base.report.home.goals + 2);
    assert.equal(attribution.report.goals.filter(g => g.kind === 'penalty').length, 1);
    assert.equal(attribution.report.goals.filter(g => g.kind === 'own-goal').length, 1);
    assert.ok(attribution.report.goals.some(g =>
      g.kind === 'own-goal' && g.defenderId === awayField[0]));
    const rows = attribution.report.appearances;
    assert.equal(rows.reduce((n, p) => n + p.goals, 0) +
      rows.reduce((n, p) => n + p.ownGoals, 0),
    match.report.home.goals + match.report.away.goals);
    assert.ok(match.events.filter(e => e.type === 'v6-event' &&
      e.source.type === 'shot' && e.elapsedSeconds >= 1200)
      .every(e => e.source.playerId !== homeField[2]));
  }
  assert.equal(JSON.stringify(source), baseline);
  assert.equal(JSON.stringify(decisions), rulingBefore);
});

test('v7 result mutation corpus rejects forgery without tampering source inputs', () => {
  for (const seed of [1, 7, 42, 0xffffffff]) {
    const { prematch, match } = run(seed);
    const original = JSON.stringify(match);
    const changes = [
      { ...match, schemaVersion: 6 },
      { ...match, engineVersion: '5' },
      { ...match, extra: undefined },
      { ...match, base: { ...match.base, rngState: 1 } },
      { ...match, events: match.events.slice(1) },
      { ...match, events: [...match.events, { type: 'unreviewed-var' }] },
      { ...match, events: match.events.map((e, i) =>
        i === 0 ? { ...e, sequence: 99 } : e) },
      { ...match, report: { ...match.report,
        home: { ...match.report.home, ownGoalsFor: 2 } } },
      { ...match, report: { ...match.report,
        home: { ...match.report.home, shotsOnTarget: 100 } } },
    ];
    for (const altered of changes) {
      assert.equal(verifyM1V7Result(prematch, policy,
        commands, decisions, altered), false);
    }
    assert.equal(verifyM1V7Result(prematch, policy,
      [...commands].reverse(), decisions, match), true);
    assert.equal(verifyM1V7Result(prematch, policy,
      commands, [], match), false);
    assert.equal(JSON.stringify(match), original);
  }
});

test('malformed, sparse and duplicate trusted inputs are typed failures', () => {
  const input = { ...source, rngSeed: 1 };
  for (const invalid of [
    [...decisions].reverse(),
    [decisions[0], { ...decisions[1], decisionId: 'penalty' }],
    [decisions[0], { ...decisions[1], elapsedSeconds: 300 }],
    [decisions[0], { ...decisions[1], playerId: homeField[0] }],
    [{ ...decisions[0], outcome: 'retake' }],
    [{ ...decisions[0], elapsedSeconds: 301 }],
    [{ ...decisions[0], outcome: 'scored', extra: false }],
    Array(1),
    Array(19).fill(decisions[0]),
  ]) {
    const result = simulateM1V7Phases(input, policy, commands, invalid);
    assert.equal(result.ok, false, JSON.stringify(invalid));
  }
  assert.equal(simulateM1V7Phases(input, policy, Array(1), []).ok, false);
  assert.equal(simulateM1V7Phases(input, policy,
    [{ ...commands[0], id: 'penalty' }], decisions).ok, false);
});

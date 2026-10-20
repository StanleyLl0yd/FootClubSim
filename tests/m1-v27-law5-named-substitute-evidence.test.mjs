import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectM1V27NamedSubstituteFoulEvidence as inspect }
  from '../dist/core/m1-v27-law5-named-substitute-evidence.js';
import { inspectM1V25GeneratedFoulLaw5Evidence as oldInspect }
  from '../dist/core/m1-v25-law5-generated-foul-evidence.js';
import { simulateM1V23TemporaryTreatment as simulate }
  from '../dist/core/m1-v23-temporary-treatment.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c =>
  c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c =>
  c.id === fixture.awayClubId));
const bench = home.bench.find(id => catalog.players.find(p =>
  p.id === id)?.primaryPosition !== 'GK');
const outgoing = home.starters.find(id => catalog.players.find(p =>
  p.id === id)?.primaryPosition !== 'GK');
assert.ok(bench && outgoing);
const policy = {
  home: {assignedActor: {kind: 'player'}, availableStaffIds: []},
  away: {assignedActor: {kind: 'player'}, availableStaffIds: []},
};
const prematch = (seed = 1) => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: {starterCount: 11, maxBench: 12, maxForeignersOnField: 7},
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
const substitution = [{
  schemaVersion: 1, kind: 'substitute-normal',
  fixtureId: fixture.id, commandId: 'bench-entry-at-half-time',
  teamId: fixture.homeClubId, elapsedSeconds: 2700,
  actor: {kind: 'player'}, stoppage: 'half-time',
  outPlayerId: outgoing, inPlayerId: bench,
}];
const claim = (victimTeam, victimId, offenderTeam, offenderId, card) => ({
  schemaVersion: 1, fixtureId: fixture.id, teamId: victimTeam,
  playerId: victimId, kind: 'opponent-cautioned-or-sent-off',
  relatedTeamId: offenderTeam, relatedPlayerId: offenderId,
  opponentCard: card, physicalOffenceDeclared: true,
  bothPlayersNeedAttentionDeclared: false, severeInjuryDeclared: false,
  penaltyAwardedDeclared: false, penaltyTakerDeclared: false,
});
let selected = null;
function sample() {
  if (selected) return selected;
  for (let seed = 1; seed <= 128; seed++) {
    const source = simulate(prematch(seed), policy, substitution);
    if (!source.ok) continue;
    for (const incident of source.generatedIncidents) {
      if (incident.sanction === 'injury-withdrawal' ||
          incident.teamId !== fixture.awayClubId ||
          incident.elapsedSeconds <= 2700) continue;
      const decision = source.match.events.find(e =>
        e.id === incident.sourceEventId);
      const whistle = source.match.events.find(e =>
        e.kind === 'synthetic-foul-whistle' &&
        e.sourceEventId === decision?.sourceEventId);
      const entry = source.match.events.find(e =>
        e.kind === 'half-time-substitution' &&
        e.replacedByPlayerId === bench);
      if (whistle?.onField.home.includes(bench) && entry &&
          decision && entry.sequence < whistle.sequence) {
        selected = {seed, source, incident, decision, whistle, entry,
          record: claim(fixture.homeClubId, bench, incident.teamId,
            incident.playerId, decision.kind === 'caution' ? 'yellow' : 'red')};
        return selected;
      }
    }
  }
  assert.fail('need one source-replayed named substitute and later opponent foul');
}
const run = (s, c, id, commands = substitution) =>
  inspect(prematch(s), policy, c, id, commands);
const error = (r, expected) => assert.equal(r.error, expected,
  JSON.stringify(r).slice(0, 500));

test('named bench victim is admitted only after a real earlier substitution event', () => {
  const {seed, source, incident, decision, whistle, entry, record} = sample();
  const previous = oldInspect(prematch(seed), policy, record,
    incident.id, substitution);
  error(previous, 'CLAIM_REJECTED');
  assert.equal(previous.claimError, 'UNSUPPORTED_PLAYER_HISTORY');
  const original = structuredClone(record);
  const result = run(seed, record, incident.id);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.victimSubstitutionEventId, entry.id);
  assert.equal(result.offenderSubstitutionEventId, null);
  assert.equal(result.offenderSourceEventId, decision.id);
  assert.equal(result.foulWhistleEventId, whistle.id);
  assert.equal(result.injuredPlayerId, bench);
  assert.equal(result.modelPhysicalPresenceAtWhistleVerified, true);
  assert.equal(result.actualInjuryAuthenticated, false);
  assert.equal(result.externalRefereeAuthorityAuthenticated, false);
  assert.equal(result.externalMedicalAuthorityAuthenticated, false);
  assert.equal(result.physicalLeaveOrReturnAuthorized, false);
  assert.deepEqual(result, run(seed, record, incident.id));
  assert.deepEqual(record, original);
  assert.deepEqual(simulate(prematch(seed), policy, substitution), source);
});

test('absence, forged cards, wrong relations and wrong source fail closed', () => {
  const {seed, incident, record} = sample();
  error(run(seed, record, incident.id, []), 'PLAYER_NOT_PRESENT_AT_WHISTLE');
  error(run(seed, {...record, opponentCard:
    record.opponentCard === 'red' ? 'yellow' : 'red'}, incident.id),
    'FOUL_RELATION_MISMATCH');
  error(run(seed, {...record, relatedPlayerId: outgoing}, incident.id),
    'CLAIM_REJECTED');
  error(run(seed, record, 'phantom-incident'), 'UNKNOWN_GENERATED_FOUL');
  error(run(seed, {...record, physicalOffenceDeclared: false}, incident.id),
    'CLAIM_REJECTED');
  error(run(seed, {...record, playerId: 'ghost-player'}, incident.id),
    'CLAIM_REJECTED');
  error(run(seed, {...record, extra: 'untrusted'}, incident.id),
    'CLAIM_REJECTED');
});

test('hostile JSON cannot provide substituted-in victim evidence', () => {
  const {seed, incident, record} = sample();
  let calls = 0;
  const poisoned = {...record};
  Object.defineProperty(poisoned, 'playerId', {
    enumerable: true, get() {calls++; return bench;},
  });
  error(run(seed, poisoned, incident.id), 'CLAIM_REJECTED');
  assert.equal(calls, 0);
  const cycle = {...record};
  cycle.cycle = cycle;
  error(run(seed, cycle, incident.id), 'CLAIM_REJECTED');
  error(run(seed, record, incident.id, [{...substitution[0],
    inPlayerId: 'not-a-roster-player'}]), 'SOURCE_MATCH_REJECTED');
});

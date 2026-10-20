import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectM1V25GeneratedFoulLaw5Evidence as inspect }
  from '../dist/core/m1-v25-law5-generated-foul-evidence.js';
import { simulateM1V23TemporaryTreatment as simulate }
  from '../dist/core/m1-v23-temporary-treatment.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { RNG_VERSION } from '../dist/core/rng.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c =>
  c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c =>
  c.id === fixture.awayClubId));
const prematch = (seed = 1) => ({
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
const record = (kind, teamId, playerId, relatedTeamId = null,
  relatedPlayerId = null, overrides = {}) => ({
  schemaVersion: 1, fixtureId: fixture.id, teamId, playerId, kind,
  relatedTeamId, relatedPlayerId, opponentCard: null,
  physicalOffenceDeclared: false, bothPlayersNeedAttentionDeclared: false,
  severeInjuryDeclared: false, penaltyAwardedDeclared: false,
  penaltyTakerDeclared: false, ...overrides,
});
const evidence = source => {
  for (const incident of source.generatedIncidents) {
    if (incident.sanction === 'injury-withdrawal') continue;
    const decision = source.match.events.find(e =>
      e.id === incident.sourceEventId);
    const whistle = source.match.events.find(e =>
      e.kind === 'synthetic-foul-whistle' &&
      e.sourceEventId === decision?.sourceEventId);
    if (!whistle || !decision) continue;
    const side = incident.teamId === fixture.homeClubId ? 'home' : 'away';
    const victimSide = side === 'home' ? 'away' : 'home';
    const victimId = whistle.onField[victimSide][0];
    if (!victimId) continue;
    const victimTeam = victimSide === 'home' ?
      fixture.homeClubId : fixture.awayClubId;
    const card = decision.kind === 'caution' ? 'yellow' : 'red';
    return {
      incident, whistle, decision, victimSide, victimTeam, victimId,
      claim: record('opponent-cautioned-or-sent-off',
        victimTeam, victimId, incident.teamId, incident.playerId,
        { opponentCard: card, physicalOffenceDeclared: true }),
    };
  }
  return null;
};
let baseline = null;
function findBaseline() {
  if (baseline) return baseline;
  for (let seed = 1; seed <= 128; seed++) {
    const source = simulate(prematch(seed), policy);
    if (!source.ok) continue;
    const selected = evidence(source);
    if (selected) {
      baseline = { seed, source, ...selected };
      return baseline;
    }
  }
  assert.fail('no seeded foul evidence among 128 seeds');
}
const check = (seed, claim, incidentId) =>
  inspect(prematch(seed), policy, claim, incidentId);
const error = (result, expected) =>
  assert.equal(result.error, expected, JSON.stringify(result).slice(0, 500));

test('live replay binds actual generated card, whistle, restart and physical XI', () => {
  const { seed, source, incident, whistle, decision, claim } = findBaseline();
  const originalPrematch = structuredClone(prematch(seed));
  const originalClaim = structuredClone(claim);
  const accepted = check(seed, claim, incident.id);
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  assert.equal(accepted.offenderSourceEventId, decision.id);
  assert.equal(accepted.foulWhistleEventId, whistle.id);
  assert.equal(accepted.runningSeconds, incident.elapsedSeconds);
  assert.equal(accepted.modelPhysicalPresenceAtWhistleVerified, true);
  assert.equal(accepted.generatedPhysicalFoulAndCardReplayed, true);
  assert.equal(accepted.actualInjuryAuthenticated, false);
  assert.equal(accepted.externalRefereeAuthorityAuthenticated, false);
  assert.equal(accepted.externalMedicalAuthorityAuthenticated, false);
  assert.equal(accepted.physicalLeaveOrReturnAuthorized, false);
  assert.deepEqual(check(seed, claim, incident.id), accepted);
  assert.deepEqual(prematch(seed), originalPrematch);
  assert.deepEqual(claim, originalClaim);
  assert.deepEqual(simulate(prematch(seed), policy), source);
});

test('a generated card cannot authenticate arbitrary injured-party assertions', () => {
  const { seed, incident, claim } = findBaseline();
  const wrongCard = claim.opponentCard === 'yellow' ? 'red' : 'yellow';
  error(check(seed, { ...claim, opponentCard: wrongCard },
    incident.id), 'FOUL_RELATION_MISMATCH');
  const otherOffender = (incident.teamId === fixture.homeClubId ?
    home.starters : away.starters).find(id => id !== incident.playerId);
  error(check(seed, { ...claim, relatedPlayerId: otherOffender },
    incident.id), 'FOUL_RELATION_MISMATCH');
  error(check(seed, claim, 'missing-foul'), 'UNKNOWN_GENERATED_FOUL');
  error(check(seed, claim, {}), 'INVALID_INCIDENT_ID');
  error(check(seed, { ...claim, fixtureId: 'other-match' },
    incident.id), 'CLAIM_REJECTED');
  error(check(seed, { ...claim, physicalOffenceDeclared: false },
    incident.id), 'CLAIM_REJECTED');
  error(check(seed, { ...claim, kind: 'severe-injury',
    relatedTeamId: null, relatedPlayerId: null, opponentCard: null,
    physicalOffenceDeclared: false, severeInjuryDeclared: true },
  incident.id), 'UNSUPPORTED_EXCEPTION');
});

test('initial XI not present at the exact model whistle cannot be a victim', () => {
  let sample = null;
  for (let seed = 1; seed <= 128 && !sample; seed++) {
    const source = simulate(prematch(seed), policy);
    if (!source.ok) continue;
    for (const incident of source.generatedIncidents) {
      if (incident.sanction === 'injury-withdrawal') continue;
      const decision = source.match.events.find(e =>
        e.id === incident.sourceEventId);
      const whistle = source.match.events.find(e =>
        e.kind === 'synthetic-foul-whistle' &&
        e.sourceEventId === decision?.sourceEventId);
      if (!whistle || !decision) continue;
      const victimSide = incident.teamId === fixture.homeClubId ? 'away' : 'home';
      const victimTeam = victimSide === 'home' ?
        fixture.homeClubId : fixture.awayClubId;
      const xi = victimSide === 'home' ? home.starters : away.starters;
      const missing = xi.find(id => !whistle.onField[victimSide].includes(id));
      if (!missing) continue;
      const card = decision.kind === 'caution' ? 'yellow' : 'red';
      sample = { seed, incident, claim: record(
        'opponent-cautioned-or-sent-off', victimTeam, missing,
        incident.teamId, incident.playerId,
        { opponentCard: card, physicalOffenceDeclared: true },
      ) };
      break;
    }
  }
  assert.ok(sample, 'need an absent starter at some seeded foul whistle');
  error(check(sample.seed, sample.claim, sample.incident.id),
    'PLAYER_NOT_PRESENT_AT_WHISTLE');
});

test('unsupported histories and hostile JSON fail closed', () => {
  const { seed, incident, claim, victimSide } = findBaseline();
  const bench = victimSide === 'home' ? home.bench[0] : away.bench[0];
  error(check(seed, { ...claim, playerId: bench }, incident.id),
    'CLAIM_REJECTED');
  error(inspect({ ...prematch(seed), rngSeed: 0 }, policy, claim,
    incident.id), 'CLAIM_REJECTED');
  let hits = 0;
  const poison = { ...claim };
  Object.defineProperty(poison, 'playerId', {
    enumerable: true, get() { hits++; return claim.playerId; },
  });
  error(check(seed, poison, incident.id), 'CLAIM_REJECTED');
  assert.equal(hits, 0);
  const cycle = { ...claim };
  cycle.cycle = cycle;
  error(check(seed, cycle, incident.id), 'CLAIM_REJECTED');
});

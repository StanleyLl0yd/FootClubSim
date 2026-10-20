import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectM1V28JournalBoundLaw5Evidence as inspect }
  from '../dist/core/m1-v28-journal-law5-evidence.js';
import { startM1V26ExposureJournal as start,
  applyM1V26ExposureBatch as apply }
  from '../dist/core/m1-v26-exposure-journal.js';
import { deriveM1V24PhysicalExposure as derive }
  from '../dist/core/m1-v24-physical-exposure.js';
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
import { createInitialCareer } from '../dist/core/save.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c =>
  c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c =>
  c.id === fixture.awayClubId));
const career = createInitialCareer(catalog, catalog.clubs[0].id,
  42, 'v28-journal-law5-career');
const policy = {
  home: {assignedActor: {kind: 'player'}, availableStaffIds: []},
  away: {assignedActor: {kind: 'player'}, availableStaffIds: []},
};
const prematch = seed => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: {starterCount: 11, maxBench: 12, maxForeignersOnField: 7},
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
const claim = (victimTeam, victimId, incident, card) => ({
  schemaVersion: 1, fixtureId: fixture.id, teamId: victimTeam,
  playerId: victimId, kind: 'opponent-cautioned-or-sent-off',
  relatedTeamId: incident.teamId, relatedPlayerId: incident.playerId,
  opponentCard: card, physicalOffenceDeclared: true,
  bothPlayersNeedAttentionDeclared: false, severeInjuryDeclared: false,
  penaltyAwardedDeclared: false, penaltyTakerDeclared: false,
});
const success = r => {
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 420));
  return r;
};
const error = (r, expected) => assert.equal(r.error, expected,
  JSON.stringify(r).slice(0, 320));
let sample;
function selected() {
  if (sample) return sample;
  for (let seed = 1; seed <= 128; seed++) {
    const input = prematch(seed);
    const source = simulate(input, policy);
    if (!source.ok) continue;
    const result = derive(input, policy);
    if (!result.ok) continue;
    for (const incident of source.generatedIncidents) {
      if (incident.sanction === 'injury-withdrawal') continue;
      const decision = source.match.events.find(e =>
        e.id === incident.sourceEventId);
      const whistle = source.match.events.find(e =>
        e.kind === 'synthetic-foul-whistle' &&
        e.sourceEventId === decision?.sourceEventId);
      if (!whistle || !decision) continue;
      const side = incident.teamId === fixture.homeClubId ? 'away' : 'home';
      const victimTeam = side === 'home' ?
        fixture.homeClubId : fixture.awayClubId;
      const xi = side === 'home' ? home.starters : away.starters;
      const id = whistle.onField[side].find(p => xi.includes(p));
      if (!id) continue;
      const initial = success(start(career)).journal;
      const cmd = {schemaVersion: 5, commandId: 'accepted-v28',
        careerId: career.careerId, expectedRevision: 0,
        prematch: input, policy, halfTimeCommands: [],
        inPlayCommands: [], result};
      const journal = success(apply(career, initial, [cmd])).journal;
      sample = {seed, incident, decision, whistle, journal,
        record: claim(victimTeam, id, incident,
          decision.kind === 'caution' ? 'yellow' : 'red')};
      return sample;
    }
  }
  assert.fail('no deterministic generated foul with present initial XI victim');
}
const review = s =>
  inspect(career, s.journal, 1, fixture.id, s.record, s.incident.id);
test('accepted schema-5 source history gates a precise Law 5 foul inspection', () => {
  const s = selected();
  const before = structuredClone(s.journal);
  const approved = success(review(s));
  assert.equal(approved.schemaVersion, 1);
  assert.equal(approved.journalRevision, 1);
  assert.equal(approved.appliedCommandId, 'accepted-v28');
  assert.equal(approved.incidentId, s.incident.id);
  assert.equal(approved.evidence.foulWhistleEventId, s.whistle.id);
  assert.equal(approved.journalSourceReplayed, true);
  assert.equal(approved.actualInjuryAuthenticated, false);
  assert.equal(approved.externalRefereeAuthorityAuthenticated, false);
  assert.equal(approved.externalMedicalAuthorityAuthenticated, false);
  assert.equal(approved.physicalLeaveOrReturnAuthorized, false);
  assert.deepEqual(review(s), approved);
  assert.deepEqual(s.journal, before);
});
test('forged journal facts and source never reach medical exception evaluation', () => {
  const s = selected();
  const a = structuredClone(s.journal);
  a.results[0].facts.playerRows[0].physicalSeconds++;
  error(inspect(career, a, 1, fixture.id, s.record, s.incident.id),
    'INVALID_JOURNAL');
  const b = structuredClone(s.journal);
  b.results[0].source.prematch.rngSeed++;
  error(inspect(career, b, 1, fixture.id, s.record, s.incident.id),
    'INVALID_JOURNAL');
  error(inspect(career, {...s.journal, schemaVersion: 4}, 1,
    fixture.id, s.record, s.incident.id), 'INVALID_JOURNAL');
  error(inspect({...career, revision: 2}, s.journal, 1,
    fixture.id, s.record, s.incident.id), 'INVALID_INITIAL_CAREER');
});
test('stale revision, absent result, unknown foul and altered claim fail closed', () => {
  const s = selected();
  error(inspect(career, s.journal, 0, fixture.id, s.record, s.incident.id),
    'STALE_REVISION');
  error(inspect(career, s.journal, 1, 'different-fixture',
    s.record, s.incident.id), 'FIXTURE_NOT_FINALIZED');
  error(inspect(career, s.journal, 1, fixture.id, s.record,
    'no-incident'), 'INCIDENT_EVIDENCE_REJECTED');
  error(inspect(career, s.journal, 1, fixture.id,
    {...s.record, opponentCard:
      s.record.opponentCard === 'red' ? 'yellow' : 'red'},
    s.incident.id), 'INCIDENT_EVIDENCE_REJECTED');
  error(inspect(career, s.journal, NaN, fixture.id, s.record,
    s.incident.id), 'INVALID_REVIEW_SCOPE');
  let hits = 0;
  const hostile = {...s.record};
  Object.defineProperty(hostile, 'playerId', {
    enumerable: true, get() {hits++; return s.record.playerId;},
  });
  error(inspect(career, s.journal, 1, fixture.id, hostile,
    s.incident.id), 'INVALID_REVIEW_SCOPE');
  assert.equal(hits, 0);
});

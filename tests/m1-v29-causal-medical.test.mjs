import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateM1V29CausalMedical as simulate,
  verifyM1V29CausalMedical as verify }
  from '../dist/core/m1-v29-causal-medical.js';
import { simulateM1V23TemporaryTreatment as v23,
  verifyM1V23TemporaryTreatment as verifyV23 }
  from '../dist/core/m1-v23-temporary-treatment.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(
  catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(
  catalog.clubs.find(c => c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(
  catalog.clubs.find(c => c.id === fixture.awayClubId));
const policy = {
  home: {assignedActor: {kind: 'player'}, availableStaffIds: []},
  away: {assignedActor: {kind: 'player'}, availableStaffIds: []},
};
const prematch = (seed = 645) => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: {starterCount: 11, maxBench: 12, maxForeignersOnField: 7},
  rngAlgorithmVersion: RNG_VERSION, rngSeed: seed,
});
const ok = r => {
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 420));
  return r;
};

test('v29 generates causally named patient and referee/medical lifecycle', () => {
  let seenQuick = 0, seenReturn = 0, successful = 0;
  for (let seed = 1; seed <= 128; seed++) {
    const run = simulate(prematch(seed), policy);
    if (!run.ok) {
      assert.ok(['SOURCE_MATCH_REJECTED', 'REFEREE_REPLAY_MISMATCH']
        .includes(run.error), JSON.stringify(run));
      continue;
    }
    successful++;
    assert.equal(run.source.treatmentRngDraws, 54);
    assert.equal(run.source.refereeRngDraws, 90);
    assert.equal(run.realWorldInjuryAuthenticated, false);
    assert.equal(run.careerJournalIntegrated, false);
    assert.equal(run.calibratedInjuryRate, false);
    assert.equal(run.source.externalMedicalAuthorityAuthenticated, false);
    assert.deepEqual(simulate(prematch(seed), policy), run);
    assert.equal(verify(prematch(seed), policy, [], [], run), true);
    for (const a of run.assessments) {
      const events = run.source.match.events;
      const incident = run.source.generatedIncidents.find(x =>
        x.id === a.incidentId);
      assert.ok(incident);
      assert.notEqual(incident.sanction, 'injury-withdrawal');
      assert.notEqual(a.patientTeamId, incident.teamId);
      const decision = events.find(e => e.id === a.offenderSourceEventId);
      const whistle = events.find(e => e.id === a.foulWhistleEventId);
      const restart = events.find(e => e.id === a.foulRestartEventId);
      assert.ok(decision && whistle && restart);
      const side = a.patientTeamId === fixture.homeClubId ? 'home' : 'away';
      const offenderSide = side === 'home' ? 'away' : 'home';
      assert.equal(whistle.kind, 'synthetic-foul-whistle');
      assert.equal(restart.kind, 'synthetic-foul-restart');
      assert.equal(whistle.runningSeconds, a.elapsedSeconds);
      assert.equal(decision.runningSeconds, a.elapsedSeconds);
      assert.equal(restart.runningSeconds, a.elapsedSeconds);
      assert.ok(whistle.sequence < decision.sequence);
      assert.ok(decision.sequence < restart.sequence);
      assert.ok(whistle.onField[side].includes(a.patientPlayerId));
      assert.ok(whistle.onField[offenderSide].includes(incident.playerId));
      assert.equal(a.externalMedicalAuthorityAuthenticated, false);
      assert.equal(a.simulatedMedicalNeed, true);
      if (a.transition === 'on-field-quick') {
        seenQuick++;
        assert.equal(a.medicalExitEventId, null);
        assert.equal(a.medicalReturnEventId, null);
        assert.ok(restart.onField[side].includes(a.patientPlayerId));
      } else {
        seenReturn++;
        const exit = events.find(e => e.id === a.medicalExitEventId);
        const back = events.find(e => e.id === a.medicalReturnEventId);
        assert.ok(exit && back);
        assert.equal(exit.kind, 'treatment-exit');
        assert.equal(back.kind, 'treatment-return');
        assert.equal(back.runningSeconds - exit.runningSeconds, 300);
        assert.ok(decision.sequence < exit.sequence);
        assert.ok(exit.sequence < restart.sequence);
        assert.ok(restart.sequence < back.sequence);
        assert.ok(!exit.onField[side].includes(a.patientPlayerId));
        assert.ok(!restart.onField[side].includes(a.patientPlayerId));
        assert.ok(back.onField[side].includes(a.patientPlayerId));
        assert.equal(events.filter(e => e.kind === 'shot' &&
          e.playerId === a.patientPlayerId &&
          e.runningSeconds >= exit.runningSeconds &&
          e.runningSeconds < back.runningSeconds).length, 0);
      }
    }
  }
  assert.ok(successful >= 8, 'too few supported seeded matches');
  assert.ok(seenQuick > 0, 'in-place synthetic treatment never covered');
  assert.ok(seenReturn > 0, 'off-field physical exit never covered');
});

test('v23 ABI and synthetic RNG baseline remain independent of new mode', () => {
  for (const seed of [1, 3, 7, 11, 17, 41]) {
    const original = v23(prematch(seed), policy);
    if (!original.ok) {
      assert.equal(original.error, 'SOURCE_MATCH_REJECTED');
      continue;
    }
    assert.equal(original.causalAssessments, undefined);
    assert.equal(original.treatmentRngDraws, 54);
    assert.equal(original.refereeRngDraws, 90);
    assert.equal(verifyV23(prematch(seed), policy, [], [], original), true);
    const newer = simulate(prematch(seed), policy);
    if (newer.ok) {
      assert.equal(newer.source.refereeRngSeed, original.refereeRngSeed);
      assert.equal(newer.source.refereeRngState, original.refereeRngState);
      assert.equal(newer.source.refereeRngDraws, original.refereeRngDraws);
      assert.equal(newer.source.treatmentRngSeed, original.treatmentRngSeed);
      assert.equal(newer.source.treatmentRngDraws, original.treatmentRngDraws);
    }
    assert.deepEqual(v23(prematch(seed), policy), original);
  }
});

test('v29 fails closed on bad source, forged assessment or injected authority', () => {
  assert.equal(simulate(null, policy).error, 'INVALID_SOURCE');
  assert.equal(simulate(prematch(), null).error, 'SOURCE_MATCH_REJECTED');
  assert.equal(simulate(prematch(), policy, {}, []).error,
    'INVALID_HALF_TIME_COMMANDS');
  const supported = Array.from({length: 128}, (_, i) => ({
    seed: i + 1, run: simulate(prematch(i + 1), policy),
  })).find(x => x.run.ok && x.run.assessments.length > 0);
  assert.ok(supported, 'no seeded medical decision');
  const forged = structuredClone(supported.run);
  forged.assessments[0].externalMedicalAuthorityAuthenticated = true;
  assert.equal(verify(prematch(supported.seed), policy, [], [], forged), false);
  const p = prematch();
  const baseline = simulate(p, policy);
  if (baseline.ok) {
    const forgedEvent = structuredClone(baseline);
    forgedEvent.source.match.events[0].onField.home.length = 0;
    assert.equal(verify(p, policy, [], [], forgedEvent), false);
    assert.equal(verify(p, policy, [], [], {...baseline, extra: true}), false);
  }
});

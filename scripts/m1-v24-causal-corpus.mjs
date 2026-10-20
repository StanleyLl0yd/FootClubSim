import { createHash } from 'node:crypto';
import { argv } from 'node:process';
import { deriveM1V24PhysicalExposure, verifyM1V24PhysicalExposure }
  from '../dist/core/m1-v24-physical-exposure.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

/**
 * Developer-only deterministic stress corpus. This is not statistical
 * calibration, a real RPL sample, or an inference about injury frequency.
 */
const SCHEMA = 2;
function value(name, fallback) {
  const hits = argv.filter(x => x.startsWith('--' + name + '='));
  if (hits.length > 1) throw Error('DUPLICATE_OPTION:' + name);
  if (hits.length === 0) return fallback;
  const raw = hits[0].slice(name.length + 3);
  if (!/^[1-9][0-9]*$/.test(raw)) throw Error('INVALID_OPTION:' + name);
  const number = Number(raw);
  if (!Number.isSafeInteger(number)) throw Error('INVALID_OPTION:' + name);
  return number;
}
export function runCorpus() {
  const allowed = new Set(['start', 'count', 'fixtures']);
  for (const argument of argv.slice(2)) {
    if (!/^--[a-z]+=[^=]*$/.test(argument) ||
        !allowed.has(argument.slice(2).split('=')[0])) {
      throw Error('UNKNOWN_OPTION');
    }
  }
  const start = value('start', 1);
  const count = value('count', 24);
  const fixtureCount = value('fixtures', 1);
  if (fixtureCount > 32) throw Error('BOUNDED_FIXTURE_RANGE_REQUIRED');
  if (count > 128 || start > 0xffffffff ||
      start + count - 1 > 0xffffffff) {
    throw Error('BOUNDED_SEED_RANGE_REQUIRED');
  }
  const catalog = createSyntheticRplScaleCatalog(77);
  const fixtures = generateDoubleRoundRobin(catalog.clubs.map(x => x.id))
    .flatMap(round => round.fixtures).slice(0, fixtureCount);
  if (fixtures.length !== fixtureCount) {
    throw Error('BOUNDED_FIXTURE_RANGE_REQUIRED');
  }
  const policy = {
    home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
    away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  };
  const digest = createHash('sha256');
  const errors = {};
  let accepted = 0, rejected = 0, generatedFouls = 0;
  let temporaryAssessments = 0, assessedReturns = 0;
  let goalEvents = 0, totalExposure = 0;
  const fixtureSummaries = [];
  for (const fixture of fixtures) {
    const homeLineup = defaultSyntheticLineup(catalog.clubs
      .find(c => c.id === fixture.homeClubId));
    const awayLineup = defaultSyntheticLineup(catalog.clubs
      .find(c => c.id === fixture.awayClubId));
    const base = {
      schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
      rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
      fixture, catalog, homeLineup, awayLineup,
      homeTactics: defaultTacticalPlan(fixture.homeClubId),
      awayTactics: defaultTacticalPlan(fixture.awayClubId),
      rosterRules: {
        starterCount: 11, maxBench: 12, maxForeignersOnField: 7,
      },
      rngAlgorithmVersion: RNG_VERSION,
    };
    let fixtureAccepted = 0, fixtureRejected = 0;
    for (let seed = start; seed < start + count; seed++) {
      const prematch = { ...base, rngSeed: seed };
      const result = deriveM1V24PhysicalExposure(prematch, policy);
      if (!result.ok) {
        if (result.error !== 'SOURCE_MATCH_REJECTED') {
          throw Error('UNEXPECTED_REJECTION:' + seed + ':' + result.error);
        }
        rejected++;
        fixtureRejected++;
        errors[result.error] = (errors[result.error] ?? 0) + 1;
        digest.update(JSON.stringify({ fixtureId: fixture.id, seed,
          error: result.error }) + '\n');
        continue;
      }
      if (!verifyM1V24PhysicalExposure(prematch, policy, [], [], result)) {
        throw Error('REPLAY_MISMATCH:' + seed);
      }
      if (result.match.match.rngDraws !== 90 ||
          result.match.refereeRngDraws !== 90 ||
          result.match.treatmentRngDraws !== 54 ||
          result.playingSeconds !== 5400 ||
          result.teamPhysicalPlayerSeconds.home < 7 * 5400 ||
          result.teamPhysicalPlayerSeconds.away < 7 * 5400 ||
          result.aggregatedEvents.goals !==
            result.match.match.finalScore.home +
              result.match.match.finalScore.away) {
        throw Error('CAUSAL_INVARIANT:' + seed);
      }
      for (const side of ['home', 'away']) {
        const teamId = side === 'home' ?
          fixture.homeClubId : fixture.awayClubId;
        const actual = result.playerRows.filter(x => x.teamId === teamId)
          .reduce((n, x) => n + x.physicalSeconds, 0);
        if (actual !== result.teamPhysicalPlayerSeconds[side]) {
          throw Error('EXPOSURE_MISMATCH:' + seed + ':' + side);
        }
      }
      accepted++;
      fixtureAccepted++;
      generatedFouls += result.match.match.generatedFoulStoppages;
      temporaryAssessments += result.match.syntheticTemporaryExitCount;
      assessedReturns += result.match.syntheticTemporaryReturnCount;
      goalEvents += result.aggregatedEvents.goals;
      totalExposure += result.teamPhysicalPlayerSeconds.home +
        result.teamPhysicalPlayerSeconds.away;
      digest.update(JSON.stringify({
        fixtureId: fixture.id, seed, score: result.match.match.finalScore,
        refereeRng: result.match.refereeRngState,
        treatmentRng: result.match.treatmentRngState,
        shots: result.aggregatedEvents.shots,
        goals: result.aggregatedEvents.goals,
        yellow: result.aggregatedEvents.firstYellows,
        red: result.aggregatedEvents.secondYellowDismissals +
          result.aggregatedEvents.directRedDismissals,
        treatment: result.match.syntheticTemporaryExitCount,
        physical: result.teamPhysicalPlayerSeconds,
      }) + '\n');
      }
    if (fixtureAccepted === 0 ||
        fixtureAccepted + fixtureRejected !== count) {
      throw Error('INVALID_FIXTURE_COVERAGE:' + fixture.id);
    }
    fixtureSummaries.push({
      fixtureId: fixture.id, accepted: fixtureAccepted,
      rejected: fixtureRejected,
    });
  }
  if (accepted + rejected !== count * fixtureCount || accepted < 1) {
    throw Error('INVALID_CORPUS_COVERAGE');
  }
  return {
    schemaVersion: SCHEMA,
    status: 'SYNTHETIC_SEEDED_REGRESSION_NOT_CALIBRATION',
    sourceEngine: 'm1-v24-source-derived-physical-exposure',
    start, count, fixtureCount, totalMatches: count * fixtureCount,
    fixtureSummaries, accepted, rejected, rejectionReasons: errors,
    generatedFouls, temporaryAssessments, assessedReturns,
    goalEvents, totalExposurePlayerSeconds: totalExposure,
    deterministicSha256: digest.digest('hex'),
    realFootballReferenceSample: false,
    syntheticFoulAndMedicalRatesCalibrated: false,
    externalRefereeAndMedicalAuthorityAuthenticated: false,
  };
}
try {
  process.stdout.write(JSON.stringify(runCorpus()) + '\n');
} catch (error) {
  process.stderr.write('M1_V24_CORPUS_ERROR:' +
    (error instanceof Error ? error.message : 'UNKNOWN') + '\n');
  process.exitCode = 1;
}

#!/usr/bin/env node
import assert from 'node:assert/strict';
import { argv } from 'node:process';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { M1_CLOCK_MAX_EVENTS } from '../dist/core/m1-clock.js';
import { prepareM1V113PlayableMatch }
  from '../dist/core/m1-v113-browser-playtest.js';
import { startM1V8MatchJournal, applyM1V8MatchResult,
  validateM1V8MatchJournal } from '../dist/core/m1-v8-result-journal.js';
import outcomesReference from '../data/rpl-2025-26-p5-reference.json' with { type: 'json' };
import shotReference from '../data/rpl-2025-26-p5-shot-discipline-reference.json' with { type: 'json' };

const fail = code => { throw Error('V119_' + code); };
const positive = (value, max) =>
  Number.isSafeInteger(value) && value >= 1 && value <= max;
function wilson(success, n) {
  if (n === 0) return null;
  const z = 1.959963984540054, z2 = z * z;
  const p = success / n, divisor = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / divisor;
  const radius = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n) / divisor;
  return { lower: Math.max(0, center - radius),
    upper: Math.min(1, center + radius) };
}
function average(total, n) { return n ? total / n : null; }
function validateReference() {
  const a = outcomesReference.reference, b = shotReference.regularSeason;
  if (outcomesReference.season !== '2025/26' ||
      shotReference.season !== '2025/26' ||
      a.matches !== 240 || b.matches !== a.matches ||
      a.goalsAllTypes !== b.goalsAllTypes ||
      a.homeWins + a.awayWins + a.drawnMatches !== a.matches ||
      a.shots !== null || a.shotsOnTarget !== null ||
      b.shotsAll < b.shotsOnTarget ||
      b.penaltiesScored > b.penaltiesRecorded ||
      shotReference.metricLimits.realShotEventTaxonomyMapped !== false ||
      shotReference.holdout2024_25Used !== false) fail('REFERENCE_CONFLICT');
  return { matches: a.matches, finalGoals: a.goalsAllTypes,
    homeWins: a.homeWins, draws: a.drawnMatches, awayWins: a.awayWins,
    scoreless: a.scorelessFullTimeMatches, shots: b.shotsAll,
    onTarget: b.shotsOnTarget, yellowCards: b.yellowCards,
    redCards: b.redCards };
}

/**
 * Run the EXACT browser-playable M1 v8 request builder and validated v8
 * source-journal append, rather than any detached v31/v99/v104 generator.
 * Every attempted game is retained; failed careers are not silently dropped.
 * Does not write IndexedDB or certify a production timing SLA.
 */
export function runM1V119PlayableDistribution({
  firstSeed = 1, seedCount = 1, fixturesPerCareer = 2,
  scenario = 'ordinary',
} = {}) {
  if (!positive(firstSeed, 0xffffffff) ||
      !positive(seedCount, 64) || firstSeed + seedCount - 1 > 0xffffffff ||
      !positive(fixturesPerCareer, 30) ||
      !['ordinary', 'internal-referee'].includes(scenario)) {
    fail('INVALID_OPTIONS');
  }
  const reference = validateReference();
  const catalog = createSyntheticRplScaleCatalog(2026);
  const selectedClubId = catalog.clubs[0].id;
  const totals = { goals: 0, openPlayGoals: 0, shots: 0, onTarget: 0,
    xgMilli: 0, cautions: 0, dismissals: 0, withdrawals: 0,
    homeWins: 0, draws: 0, awayWins: 0, scoreless: 0 };
  const failed = {};
  let attempted = 0, accepted = 0, verifiedCareerJournals = 0;
  const gamesBySeed = [];
  const perMatchFinalGoals = [];
  for (let seed = firstSeed; seed < firstSeed + seedCount; seed++) {
    const career = createInitialCareer(catalog, selectedClubId, seed,
      'p5-v119-playable-source-' + seed);
    const start = startM1V8MatchJournal(career);
    assert.equal(start.ok, true);
    let journal = start.journal;
    let seedAccepted = 0, seedFailed = null;
    for (let i = 0; i < fixturesPerCareer; i++) {
      attempted++;
      const proposal = prepareM1V113PlayableMatch(
        career, journal, scenario);
      if (!proposal?.ok) {
        const error = proposal === null ? 'UNEXPECTED_END_OF_CALENDAR' :
          proposal.error;
        failed[error] = (failed[error] ?? 0) + 1;
        seedFailed = error;
        break;
      }
      const result = applyM1V8MatchResult(career, journal, proposal.request);
      if (!result.ok) {
        failed[result.error] = (failed[result.error] ?? 0) + 1;
        seedFailed = result.error;
        break;
      }
      journal = result.journal;
      const item = journal.results.at(-1);
      assert.equal(item.fixtureId, proposal.fixture.id);
      assert.equal(journal.revision, i + 1);
      const home = item.dossier.match.home, away = item.dossier.match.away;
      if (scenario === 'ordinary' &&
          home.shots + away.shots > M1_CLOCK_MAX_EVENTS) {
        fail('STRUCTURAL_SHOT_CAP_BROKEN');
      }
      const finalGoals = home.goals + away.goals;
      perMatchFinalGoals.push(finalGoals);
      totals.goals += finalGoals;
      totals.openPlayGoals += home.openPlayGoals + away.openPlayGoals;
      totals.shots += home.shots + away.shots;
      totals.onTarget += home.shotsOnTarget + away.shotsOnTarget;
      totals.xgMilli += home.xgMilli + away.xgMilli;
      for (const side of ['home', 'away']) {
        const team = item.dossier.teams[side];
        totals.cautions += team.yellowCards;
        totals.dismissals += team.dismissals;
        totals.withdrawals += team.permanentMedicalWithdrawals;
      }
      if (home.goals > away.goals) totals.homeWins++;
      else if (home.goals === away.goals) totals.draws++;
      else totals.awayWins++;
      if (finalGoals === 0) totals.scoreless++;
      accepted++;
      seedAccepted++;
    }
    const verified = validateM1V8MatchJournal(career, journal);
    if (!verified.ok || verified.journal.revision !== seedAccepted) {
      fail('FINAL_JOURNAL_REPLAY');
    }
    verifiedCareerJournals++;
    gamesBySeed.push({ seed, accepted: seedAccepted,
      failed: seedFailed, finalJournalRevision: journal.revision });
  }
  if (attempted !== accepted + Object.values(failed).reduce((a,b)=>a+b,0) ||
      totals.homeWins + totals.draws + totals.awayWins !== accepted ||
      totals.openPlayGoals > totals.goals ||
      totals.onTarget > totals.shots) fail('COUNT_CONSERVATION');
  const mean = average(totals.goals, accepted);
  const sumSq = perMatchFinalGoals.reduce((n, x) => n + (x - mean) ** 2, 0);
  const stddev = accepted > 1 ? Math.sqrt(sumSq / (accepted - 1)) : null;
  const referenceShotsPerMatch = reference.shots / reference.matches;
  return {
    schemaVersion: 119,
    status: 'ACTUAL_PLAYABLE_V8_DISTRIBUTIONS_NOT_CALIBRATED',
    source: 'm1-v113-browser-playtest-v8-replay-verified-journal',
    frozenSyntheticCatalogSeed: 2026, scenario, firstSeed, seedCount,
    fixturesPerCareer, attempted, accepted, rejected: attempted - accepted,
    failures: failed, verifiedCareerJournals, gamesBySeed,
    totals, perMatch: {
      finalGoals: mean,
      openPlayGoals: average(totals.openPlayGoals, accepted),
      shots: average(totals.shots, accepted),
      onTarget: average(totals.onTarget, accepted),
      openPlayXg: average(totals.xgMilli / 1000, accepted),
      cautions: average(totals.cautions, accepted),
      dismissals: average(totals.dismissals, accepted),
      modelledWithdrawals: average(totals.withdrawals, accepted),
    },
    homeWinWilson95: wilson(totals.homeWins, accepted),
    drawWilson95: wilson(totals.draws, accepted),
    awayWinWilson95: wilson(totals.awayWins, accepted),
    scorelessWilson95: wilson(totals.scoreless, accepted),
    goalsMeanNormal95: mean !== null && stddev !== null ? {
      lower: Math.max(0, mean - 1.959963984540054 * stddev / Math.sqrt(accepted)),
      upper: mean + 1.959963984540054 * stddev / Math.sqrt(accepted),
    } : null,
    reference: { season: '2025/26', matches: reference.matches,
      finalGoalsPerMatch: reference.finalGoals / reference.matches,
      homeWinShare: reference.homeWins / reference.matches,
      drawShare: reference.draws / reference.matches,
      awayWinShare: reference.awayWins / reference.matches,
      scorelessShare: reference.scoreless / reference.matches,
      shotAttemptsPerMatch: referenceShotsPerMatch,
      onTargetPerMatch: reference.onTarget / reference.matches,
      yellowCardsPerMatch: reference.yellowCards / reference.matches,
      redCardsPerMatch: reference.redCards / reference.matches },
    structural: {
      v8MaxOpenPlayShotsPerMatch: M1_CLOCK_MAX_EVENTS,
      referenceAverageShotsExceedsV8PhysicalMaximum:
        referenceShotsPerMatch > M1_CLOCK_MAX_EVENTS,
      independentShotTaxonomyVerified: false,
      modelOpenPlayAndReferenceAllGoalSubtypeHarmonized: false,
      modelledInjuryToClinicalReferenceComparable: false,
      opponentFullCareerHistoryVerified: false,
    },
    limitations: {
      clusterIndependenceEstablished: false,
      productionNativeBrowserLatencyGate: false,
      fullLeagueAllClubCareerSample: false,
      syntheticScenarioNotOfficialRefereeOrMedicalAuthority: true,
      full10kIndependentCalibrationCompleted: false,
      holdout2024_25Used: false,
      releaseP5Accepted: false,
    },
  };
}
function parseCli(args) {
  const keys = ['first-seed', 'seed-count', 'fixtures', 'scenario'];
  const parsed = {};
  for (const raw of args) {
    const match = /^--([a-z-]+)=(.+)$/.exec(raw);
    if (!match || !keys.includes(match[1]) || Object.hasOwn(parsed, match[1]))
      fail('CLI_ARGUMENT');
    parsed[match[1]] = match[2];
  }
  const numeric = key => {
    if (!Object.hasOwn(parsed, key)) return undefined;
    if (!/^[0-9]{1,10}$/.test(parsed[key])) fail('CLI_ARGUMENT');
    return Number(parsed[key]);
  };
  return { firstSeed: numeric('first-seed'), seedCount: numeric('seed-count'),
    fixturesPerCareer: numeric('fixtures'),
    scenario: parsed.scenario };
}
if (argv[1]?.endsWith('m1-p5-v119-playable-source.mjs')) {
  try {
    const options = parseCli(argv.slice(2));
    const fixed = Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined));
    process.stdout.write('P5_V119_PLAYABLE=' +
      JSON.stringify(runM1V119PlayableDistribution(fixed)) + '\n');
  } catch (error) {
    process.stderr.write('P5_V119_FAILED:' +
      (error instanceof Error ? error.message : 'UNKNOWN') + '\n');
    process.exitCode = 1;
  }
}

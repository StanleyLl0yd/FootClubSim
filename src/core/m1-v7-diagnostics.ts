import type { M1DiagnosticOptions, M1Mean, M1Rate } from './m1-diagnostics.js';
import { m1Wilson95 } from './m1-diagnostics.js';
import type { M1PrematchInput } from './m1-clock.js';
import { M1_V7_ENGINE_VERSION, M1_V7_EVENT_SCHEMA_VERSION,
  simulateM1V7Phases } from './m1-v7-adjudications.js';
import { RNG_VERSION } from './rng.js';

/** v7-only reproducible synthetic diagnostics, NOT licensed realism calibration. */
export const M1_V7_DIAGNOSTICS_SCHEMA_VERSION = 1 as const;
export interface M1V7DiagnosticReport {
  readonly schemaVersion: typeof M1_V7_DIAGNOSTICS_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_INTERNAL_ONLY_NOT_CALIBRATED';
  readonly engineVersion: typeof M1_V7_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
  readonly rngVersion: typeof RNG_VERSION;
  readonly refereeModel: 'NOT_GENERATED';
  readonly adjudicationScenario: 'NONE' | 'EXOGENOUS_FIXED';
  readonly referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE';
  readonly sourcePackId: string;
  readonly sourcePackVersion: string;
  readonly fixtureId: string;
  readonly firstSeed: number;
  readonly lastSeed: number;
  readonly matchCount: number;
  readonly outcomes: Readonly<{
    homeWin: M1Rate; draw: M1Rate; awayWin: M1Rate; scorelessDraw: M1Rate;
  }>;
  readonly means: Readonly<{
    goalsPerMatch: M1Mean;
    shotsPerMatch: M1Mean;
    onTargetPerMatch: M1Mean;
    openPlayXgPerMatch: M1Mean;
  }>;
  readonly totals: Readonly<{
    goals: number;
    openPlayGoals: number;
    penaltyGoals: number;
    ownGoals: number;
    penaltyAttempts: number;
    shots: number;
    shotsOnTarget: number;
  }>;
  readonly xgCoverage: 'open-play-only';
}
export type M1V7DiagnosticResult =
  | Readonly<{ ok: true; report: M1V7DiagnosticReport }>
  | Readonly<{ ok: false; error:
    'INVALID_PLAN' | 'MATCH_FAILED' | 'INTERNAL_INVARIANT' }>;

function mean(numbers: readonly number[]): M1Mean {
  const count = numbers.length;
  const total = numbers.reduce((a, b) => a + b, 0);
  const avg = total / count;
  const sampleVariance = count < 2 ? null :
    numbers.reduce((s, v) => s + (v - avg) ** 2, 0) / (count - 1);
  const sampleStdDev = sampleVariance === null ? null : Math.sqrt(sampleVariance);
  const margin = sampleStdDev === null ? null :
    1.959963984540054 * sampleStdDev / Math.sqrt(count);
  return {
    count, total, mean: avg, sampleStdDev,
    normalMean95: margin === null ? null :
      { lower: avg - margin, upper: avg + margin },
  };
}
function rate(count: number, denominator: number): M1Rate {
  return { count, denominator, rate: count / denominator,
    wilson95: m1Wilson95(count, denominator)! };
}

/** Does not sample injuries/cards/penalties; adjudications are fixed external input. */
export function runM1V7SyntheticDiagnostics(
  prematch: M1PrematchInput, policy: unknown,
  options: M1DiagnosticOptions, fixedDecisions: unknown = [],
): M1V7DiagnosticResult {
  if (!options || !Number.isSafeInteger(options.firstSeed) ||
      !Number.isSafeInteger(options.matchCount) ||
      options.firstSeed < 1 || options.matchCount < 1 ||
      options.matchCount > 10000 ||
      options.firstSeed + options.matchCount - 1 > 0xffffffff ||
      !Array.isArray(fixedDecisions) || fixedDecisions.length > 18) {
    return { ok: false, error: 'INVALID_PLAN' };
  }
  const goals: number[] = [], shots: number[] = [], onTarget: number[] = [],
    xg: number[] = [];
  const totals = { goals: 0, openPlayGoals: 0, penaltyGoals: 0, ownGoals: 0,
    penaltyAttempts: 0, shots: 0, shotsOnTarget: 0 };
  let homeWin = 0, draw = 0, awayWin = 0, scoreless = 0;
  for (let i = 0; i < options.matchCount; i++) {
    const match = simulateM1V7Phases(
      { ...prematch, rngSeed: options.firstSeed + i }, policy, [], fixedDecisions,
    );
    if (!match.ok) return { ok: false, error: 'MATCH_FAILED' };
    const h = match.report.home, a = match.report.away;
    const totalGoals = h.goals + a.goals, totalShots = h.shots + a.shots;
    const attempts = h.penaltiesTaken + a.penaltiesTaken;
    const open = h.openPlayGoals + a.openPlayGoals;
    const penalties = h.penaltyGoals + a.penaltyGoals;
    const own = h.ownGoalsFor + a.ownGoalsFor;
    const target = h.shotsOnTarget + a.shotsOnTarget;
    if (totalGoals !== open + penalties + own ||
        open + penalties > target || target > totalShots ||
        attempts > totalShots ||
        h.xgCoverage !== 'open-play-only' || a.xgCoverage !== 'open-play-only' ||
        match.base.rngDraws !== 90 || !Number.isSafeInteger(totalGoals) ||
        !Number.isFinite(h.xgMilli + a.xgMilli)) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
    homeWin += Number(h.goals > a.goals);
    draw += Number(h.goals === a.goals);
    awayWin += Number(h.goals < a.goals);
    scoreless += Number(h.goals === 0 && a.goals === 0);
    goals.push(totalGoals);
    shots.push(totalShots);
    onTarget.push(target);
    xg.push((h.xgMilli + a.xgMilli) / 1000);
    totals.goals += totalGoals;
    totals.openPlayGoals += open;
    totals.penaltyGoals += penalties;
    totals.ownGoals += own;
    totals.penaltyAttempts += attempts;
    totals.shots += totalShots;
    totals.shotsOnTarget += target;
  }
  return { ok: true, report: {
    schemaVersion: M1_V7_DIAGNOSTICS_SCHEMA_VERSION,
    status: 'SYNTHETIC_INTERNAL_ONLY_NOT_CALIBRATED',
    engineVersion: M1_V7_ENGINE_VERSION,
    eventSchemaVersion: M1_V7_EVENT_SCHEMA_VERSION,
    rngVersion: RNG_VERSION,
    refereeModel: 'NOT_GENERATED',
    adjudicationScenario: fixedDecisions.length ? 'EXOGENOUS_FIXED' : 'NONE',
    referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE',
    sourcePackId: prematch.catalog.packId,
    sourcePackVersion: prematch.catalog.packVersion,
    fixtureId: prematch.fixture.id,
    firstSeed: options.firstSeed,
    lastSeed: options.firstSeed + options.matchCount - 1,
    matchCount: options.matchCount,
    outcomes: {
      homeWin: rate(homeWin, options.matchCount),
      draw: rate(draw, options.matchCount),
      awayWin: rate(awayWin, options.matchCount),
      scorelessDraw: rate(scoreless, options.matchCount),
    },
    means: {
      goalsPerMatch: mean(goals),
      shotsPerMatch: mean(shots),
      onTargetPerMatch: mean(onTarget),
      openPlayXgPerMatch: mean(xg),
    },
    totals,
    xgCoverage: 'open-play-only',
  } };
}

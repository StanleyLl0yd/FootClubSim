import type { M1PrematchInput } from './m1-clock.js';
import { M1_ACTION_ENGINE_VERSION, simulateM1SyntheticPhases } from './m1-phases.js';
import { RNG_VERSION } from './rng.js';

/** Internal synthetic diagnostics only. No external licensed football baselines. */
export const M1_DIAGNOSTICS_SCHEMA_VERSION = 1 as const;
const WILSON_Z = 1.959963984540054; // 95% confidence, two-sided
const MAX_DIAGNOSTIC_MATCHES = 10000;
export interface M1DiagnosticOptions {
  readonly firstSeed: number;
  readonly matchCount: number;
}
export interface M1Interval {
  readonly lower: number;
  readonly upper: number;
}
export interface M1Rate {
  readonly count: number;
  readonly denominator: number;
  readonly rate: number;
  readonly wilson95: M1Interval;
}
export interface M1Mean {
  readonly count: number;
  readonly total: number;
  readonly mean: number;
  readonly sampleStdDev: number | null;
  /** Normal-approximation CI for synthetic sampling mean, not realism. */
  readonly normalMean95: M1Interval | null;
}
export interface M1QualityBucket {
  readonly lowerXMilli: number;
  readonly upperXMilli: number;
  readonly shots: number;
  readonly goals: number;
  readonly predictedGoalRate: number | null;
  readonly observedGoalRate: number | null;
  readonly lowSample: boolean;
}
export interface M1DiagnosticReport {
  readonly schemaVersion: typeof M1_DIAGNOSTICS_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_INTERNAL_ONLY_NOT_CALIBRATED';
  readonly actionEngineVersion: typeof M1_ACTION_ENGINE_VERSION;
  readonly rngVersion: typeof RNG_VERSION;
  readonly firstSeed: number;
  readonly lastSeed: number;
  readonly matchCount: number;
  readonly fixtureId: string;
  readonly sourcePackId: string;
  readonly sourcePackVersion: string;
  readonly outcomes: Readonly<{
    homeWin: M1Rate;
    draw: M1Rate;
    awayWin: M1Rate;
    scorelessDraw: M1Rate;
  }>;
  readonly meanGoalsPerMatch: M1Mean;
  readonly meanShotsPerMatch: M1Mean;
  readonly meanShotsOnTargetPerMatch: M1Mean;
  readonly meanXgPerMatch: M1Mean;
  readonly totalShots: number;
  readonly totalGoals: number;
  readonly brierScoreForShotGoal: number | null;
  readonly qualityBuckets: readonly M1QualityBucket[];
  readonly referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE';
}
export type M1DiagnosticResult =
  | Readonly<{ ok: true; report: M1DiagnosticReport }>
  | Readonly<{ ok: false; error: 'INVALID_PLAN' | 'MATCH_FAILED' | 'INTERNAL_INVARIANT' }>;

/** Wilson score interval for a sample Bernoulli rate, bounded in [0,1]. */
export function m1Wilson95(successes: number, trials: number): M1Interval | null {
  if (!Number.isInteger(successes) || !Number.isInteger(trials) ||
      trials <= 0 || successes < 0 || successes > trials) return null;
  const p = successes / trials;
  const z2 = WILSON_Z * WILSON_Z;
  const center = (p + z2 / (2 * trials)) / (1 + z2 / trials);
  const offset = WILSON_Z * Math.sqrt(
    p * (1 - p) / trials + z2 / (4 * trials * trials),
  ) / (1 + z2 / trials);
  return { lower: Math.max(0, center - offset), upper: Math.min(1, center + offset) };
}
function rate(numerator: number, denominator: number): M1Rate {
  return {
    count: numerator, denominator, rate: numerator / denominator,
    wilson95: m1Wilson95(numerator, denominator)!,
  };
}
class SampleMean {
  count = 0;
  total = 0;
  private mean = 0;
  private m2 = 0;
  add(value: number): void {
    const n = ++this.count;
    this.total += value;
    const delta = value - this.mean;
    this.mean += delta / n;
    this.m2 += delta * (value - this.mean);
  }
  result(): M1Mean {
    const variance = this.count > 1 ? Math.max(0, this.m2 / (this.count - 1)) : null;
    const sampleStdDev = variance === null ? null : Math.sqrt(variance);
    const margin = sampleStdDev === null ? null : WILSON_Z * sampleStdDev / Math.sqrt(this.count);
    return {
      count: this.count, total: this.total, mean: this.total / this.count,
      sampleStdDev, normalMean95: margin === null ? null : {
        lower: this.mean - margin, upper: this.mean + margin,
      },
    };
  }
}

function validPlan(options: M1DiagnosticOptions): boolean {
  return Boolean(options && Number.isInteger(options.firstSeed) &&
    Number.isInteger(options.matchCount) && options.firstSeed >= 1 &&
    options.matchCount >= 1 && options.matchCount <= MAX_DIAGNOSTIC_MATCHES &&
    options.firstSeed + options.matchCount - 1 <= 0xffffffff);
}

/**
 * Deterministic, memory-bounded internal cohort. A green result indicates
 * finite arithmetic and event/report consistency, NOT empirical realism.
 * Run >=10000 seeds per cohort only when an independent M1 reference and
 * pre-registered acceptance bounds are available.
 */
export function runM1SyntheticDiagnostics(
  prematch: M1PrematchInput, policy: unknown, options: M1DiagnosticOptions,
): M1DiagnosticResult {
  if (!validPlan(options)) return { ok: false, error: 'INVALID_PLAN' };
  const goalsMean = new SampleMean(), shotsMean = new SampleMean();
  const targetMean = new SampleMean(), xgMean = new SampleMean();
  const buckets = Array.from({ length: 10 }, () => ({
    shots: 0, goals: 0, xgMilli: 0,
  }));
  let homeWins = 0, draws = 0, awayWins = 0, scorelessDraws = 0;
  let totalShots = 0, totalGoals = 0, brierTotal = 0;
  for (let i = 0; i < options.matchCount; i++) {
    const seed = options.firstSeed + i;
    const match = simulateM1SyntheticPhases({ ...prematch, rngSeed: seed }, policy);
    if (!match.ok) return { ok: false, error: 'MATCH_FAILED' };
    const h = match.report.home, a = match.report.away;
    const goals = h.goals + a.goals, shots = h.shots + a.shots;
    const onTarget = h.shotsOnTarget + a.shotsOnTarget;
    const xgMilli = h.xgMilli + a.xgMilli;
    if (goals > onTarget || onTarget > shots || !Number.isFinite(xgMilli) ||
        xgMilli < 0 || match.rngDraws !== 90) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
    homeWins += Number(h.goals > a.goals);
    draws += Number(h.goals === a.goals);
    awayWins += Number(h.goals < a.goals);
    scorelessDraws += Number(h.goals === 0 && a.goals === 0);
    goalsMean.add(goals);
    shotsMean.add(shots);
    targetMean.add(onTarget);
    xgMean.add(xgMilli / 1000);
    totalGoals += goals;
    totalShots += shots;
    let eventShots = 0, eventGoals = 0, eventXgMilli = 0;
    for (const event of match.events) {
      if (event.type !== 'shot') continue;
      eventShots++;
      const goal = Number(event.outcome === 'goal');
      eventGoals += goal;
      eventXgMilli += event.xgMilli;
      const p = event.xgMilli / 1000;
      brierTotal += (goal - p) * (goal - p);
      const index = Math.min(9, Math.floor(event.xgMilli / 100));
      const bucket = buckets[index]!;
      bucket.shots++;
      bucket.goals += goal;
      bucket.xgMilli += event.xgMilli;
    }
    if (eventShots !== shots || eventGoals !== goals || eventXgMilli !== xgMilli) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
  }
  const qualityBuckets: M1QualityBucket[] = buckets.map((bucket, index) => ({
    lowerXMilli: index * 100,
    upperXMilli: (index + 1) * 100,
    shots: bucket.shots, goals: bucket.goals,
    predictedGoalRate: bucket.shots ? bucket.xgMilli / (1000 * bucket.shots) : null,
    observedGoalRate: bucket.shots ? bucket.goals / bucket.shots : null,
    lowSample: bucket.shots < 30,
  }));
  return { ok: true, report: {
    schemaVersion: M1_DIAGNOSTICS_SCHEMA_VERSION,
    status: 'SYNTHETIC_INTERNAL_ONLY_NOT_CALIBRATED',
    actionEngineVersion: M1_ACTION_ENGINE_VERSION, rngVersion: RNG_VERSION,
    firstSeed: options.firstSeed,
    lastSeed: options.firstSeed + options.matchCount - 1,
    matchCount: options.matchCount,
    fixtureId: prematch.fixture.id, sourcePackId: prematch.catalog.packId,
    sourcePackVersion: prematch.catalog.packVersion,
    outcomes: {
      homeWin: rate(homeWins, options.matchCount),
      draw: rate(draws, options.matchCount),
      awayWin: rate(awayWins, options.matchCount),
      scorelessDraw: rate(scorelessDraws, options.matchCount),
    },
    meanGoalsPerMatch: goalsMean.result(),
    meanShotsPerMatch: shotsMean.result(),
    meanShotsOnTargetPerMatch: targetMean.result(),
    meanXgPerMatch: xgMean.result(),
    totalShots, totalGoals,
    brierScoreForShotGoal: totalShots ? brierTotal / totalShots : null,
    qualityBuckets,
    referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE',
  } };
}


export interface M1PairedTacticalReport {
  readonly schemaVersion: typeof M1_DIAGNOSTICS_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_PAIRED_SENSITIVITY_NOT_CALIBRATED';
  readonly actionEngineVersion: typeof M1_ACTION_ENGINE_VERSION;
  readonly rngVersion: typeof RNG_VERSION;
  readonly fixtureId: string;
  readonly sourcePackId: string;
  readonly firstSeed: number;
  readonly lastSeed: number;
  readonly matchCount: number;
  readonly baselineHomeTempo: number;
  readonly variantHomeTempo: number;
  /** Per-seed variant minus baseline, same input/seed in each pair. */
  readonly deltaHomeShots: M1Mean;
  readonly deltaHomeGoals: M1Mean;
  readonly deltaHomeXMilli: M1Mean;
  readonly deltaAwayShots: M1Mean;
  readonly deltaTotalGoals: M1Mean;
  readonly homeShotDirection: Readonly<{
    increased: M1Rate;
    tied: M1Rate;
    decreased: M1Rate;
  }>;
  readonly referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE';
}
export type M1PairedTacticalResult =
  | Readonly<{ ok: true; report: M1PairedTacticalReport }>
  | Readonly<{ ok: false; error: 'INVALID_PLAN' | 'MATCH_FAILED' }>;

/**
 * Paired-seed synthetic sensitivity study. Only tactical plans may differ.
 * No benchmark, no causal inference about real matches, no tuned thresholds.
 */
export function runM1PairedTacticalDiagnostics(
  baseline: M1PrematchInput, variant: M1PrematchInput,
  policy: unknown, options: M1DiagnosticOptions,
): M1PairedTacticalResult {
  if (!validPlan(options)) return { ok: false, error: 'INVALID_PLAN' };
  const fixedKeys = [
    'schemaVersion', 'engineVersion', 'rulesPackId', 'rulesPackVersion',
    'fixture', 'catalog', 'homeLineup', 'awayLineup', 'rosterRules', 'rngAlgorithmVersion',
  ] as const;
  if (!baseline || !variant || fixedKeys.some(key =>
    JSON.stringify(baseline[key]) !== JSON.stringify(variant[key]))) {
    return { ok: false, error: 'INVALID_PLAN' };
  }
  const homeShots = new SampleMean(), homeGoals = new SampleMean();
  const homeXMilli = new SampleMean(), awayShots = new SampleMean();
  const totalGoals = new SampleMean();
  let increased = 0, tied = 0, decreased = 0;
  for (let i = 0; i < options.matchCount; i++) {
    const rngSeed = options.firstSeed + i;
    const original = simulateM1SyntheticPhases({ ...baseline, rngSeed }, policy);
    const perturbed = simulateM1SyntheticPhases({ ...variant, rngSeed }, policy);
    if (!original.ok || !perturbed.ok) return { ok: false, error: 'MATCH_FAILED' };
    const deltaShots = perturbed.report.home.shots - original.report.home.shots;
    homeShots.add(deltaShots);
    homeGoals.add(perturbed.report.home.goals - original.report.home.goals);
    homeXMilli.add(perturbed.report.home.xgMilli - original.report.home.xgMilli);
    awayShots.add(perturbed.report.away.shots - original.report.away.shots);
    totalGoals.add(
      perturbed.report.home.goals + perturbed.report.away.goals -
      original.report.home.goals - original.report.away.goals,
    );
    increased += Number(deltaShots > 0);
    tied += Number(deltaShots === 0);
    decreased += Number(deltaShots < 0);
  }
  return { ok: true, report: {
    schemaVersion: M1_DIAGNOSTICS_SCHEMA_VERSION,
    status: 'SYNTHETIC_PAIRED_SENSITIVITY_NOT_CALIBRATED',
    actionEngineVersion: M1_ACTION_ENGINE_VERSION, rngVersion: RNG_VERSION,
    fixtureId: baseline.fixture.id, sourcePackId: baseline.catalog.packId,
    firstSeed: options.firstSeed, lastSeed: options.firstSeed + options.matchCount - 1,
    matchCount: options.matchCount,
    baselineHomeTempo: baseline.homeTactics.tempo,
    variantHomeTempo: variant.homeTactics.tempo,
    deltaHomeShots: homeShots.result(), deltaHomeGoals: homeGoals.result(),
    deltaHomeXMilli: homeXMilli.result(), deltaAwayShots: awayShots.result(),
    deltaTotalGoals: totalGoals.result(),
    homeShotDirection: {
      increased: rate(increased, options.matchCount),
      tied: rate(tied, options.matchCount),
      decreased: rate(decreased, options.matchCount),
    },
    referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE',
  } };
}

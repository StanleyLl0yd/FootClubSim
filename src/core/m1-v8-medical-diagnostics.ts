import { sameCanonicalValue } from './canonical-value.js';
import { m1Wilson95, type M1DiagnosticOptions, type M1Mean, type M1Rate }
  from './m1-diagnostics.js';
import type { M1PrematchInput } from './m1-clock.js';
import { M1_V8_ENGINE_VERSION, M1_V8_EVENT_SCHEMA_VERSION,
  simulateM1V8MedicalPhases } from './m1-v8-medical-phases.js';
import { RNG_VERSION } from './rng.js';

/** Synthetic paired-seed medical scenario sensitivity; NOT injury calibration. */
export const M1_V8_MEDICAL_DIAGNOSTIC_SCHEMA_VERSION = 1 as const;
export interface M1V8PairedMedicalReport {
  readonly schemaVersion: typeof M1_V8_MEDICAL_DIAGNOSTIC_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_MEDICAL_COUNTERFACTUAL_NOT_CALIBRATED';
  readonly referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE';
  readonly scenario: 'EXOGENOUS_FIXED_MEDICAL_ACTIONS_NOT_GENERATED';
  readonly engineVersion: typeof M1_V8_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V8_EVENT_SCHEMA_VERSION;
  readonly rngVersion: typeof RNG_VERSION;
  readonly fixtureId: string;
  readonly sourcePackId: string;
  readonly sourcePackVersion: string;
  readonly firstSeed: number;
  readonly lastSeed: number;
  readonly matchCount: number;
  readonly medicalActionCount: number;
  readonly pairedDifferences: Readonly<{
    homeGoals: M1Mean;
    awayGoals: M1Mean;
    totalShots: M1Mean;
    openPlayXg: M1Mean;
  }>;
  readonly shotLedgerChanged: M1Rate;
  readonly changedScoreline: M1Rate;
}
export type M1V8PairedMedicalResult =
  | Readonly<{ ok: true; report: M1V8PairedMedicalReport }>
  | Readonly<{ ok: false; error: 'INVALID_PLAN' | 'MATCH_FAILED' |
    'INTERNAL_INVARIANT' }>;

const Z = 1.959963984540054;
class Mean {
  count = 0;
  total = 0;
  private average = 0;
  private m2 = 0;
  add(value: number): void {
    this.count++;
    this.total += value;
    const delta = value - this.average;
    this.average += delta / this.count;
    this.m2 += delta * (value - this.average);
  }
  value(): M1Mean {
    const sd = this.count < 2 ? null :
      Math.sqrt(Math.max(0, this.m2 / (this.count - 1)));
    const margin = sd === null ? null : Z * sd / Math.sqrt(this.count);
    return {
      count: this.count, total: this.total, mean: this.average,
      sampleStdDev: sd,
      normalMean95: margin === null ? null : {
        lower: this.average - margin, upper: this.average + margin,
      },
    };
  }
}
function rate(n: number, count: number): M1Rate {
  return { count: n, denominator: count, rate: n / count,
    wilson95: m1Wilson95(n, count)! };
}

/**
 * Holds fixture, rules, seed and every external decision fixed; the ONLY
 * intervention is the caller-specified treatment timeline. The procedure
 * itself must be authenticated elsewhere and is not sampled statistically.
 * PRNG state must remain exactly paired on each seed.
 */
export function runM1V8PairedMedicalDiagnostics(
  prematch: M1PrematchInput, policy: unknown,
  options: M1DiagnosticOptions, medicalActions: unknown,
): M1V8PairedMedicalResult {
  if (!options || !Number.isSafeInteger(options.firstSeed) ||
      !Number.isSafeInteger(options.matchCount) ||
      options.firstSeed < 1 || options.matchCount < 1 ||
      options.matchCount > 10000 ||
      options.firstSeed + options.matchCount - 1 > 0xffffffff ||
      !Array.isArray(medicalActions) || medicalActions.length === 0 ||
      medicalActions.length > 36) return { ok: false, error: 'INVALID_PLAN' };
  const means = {
    homeGoals: new Mean(), awayGoals: new Mean(),
    totalShots: new Mean(), openPlayXg: new Mean(),
  };
  let changedShots = 0, changedScores = 0;
  for (let i = 0; i < options.matchCount; i++) {
    const input = { ...prematch, rngSeed: options.firstSeed + i };
    const normal = simulateM1V8MedicalPhases(input, policy, [], [], []);
    const medical = simulateM1V8MedicalPhases(
      input, policy, [], [], medicalActions,
    );
    if (!normal.ok || !medical.ok) return { ok: false, error: 'MATCH_FAILED' };
    if (normal.rngDraws !== 90 || medical.rngDraws !== 90 ||
        normal.rngState !== medical.rngState ||
        normal.rngSeed !== medical.rngSeed ||
        normal.report.home.xgCoverage !== 'open-play-only' ||
        medical.report.home.xgCoverage !== 'open-play-only' ||
        normal.report.away.xgCoverage !== 'open-play-only' ||
        medical.report.away.xgCoverage !== 'open-play-only') {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
    const a = normal.report, b = medical.report;
    means.homeGoals.add(b.home.goals - a.home.goals);
    means.awayGoals.add(b.away.goals - a.away.goals);
    means.totalShots.add(b.home.shots + b.away.shots -
      a.home.shots - a.away.shots);
    means.openPlayXg.add((b.home.xgMilli + b.away.xgMilli -
      a.home.xgMilli - a.away.xgMilli) / 1000);
    // Treatment events shift envelope sequence numbers. Only compare the
    // actual phase shot facts, not unrelated medical stream positions.
    const aShots = normal.events.filter(e => e.type === 'shot')
      .map(({ sequence, ...shot }) => shot);
    const bShots = medical.events.filter(e => e.type === 'shot')
      .map(({ sequence, ...shot }) => shot);
    changedShots += Number(!sameCanonicalValue(aShots, bShots));
    changedScores += Number(a.home.goals !== b.home.goals ||
      a.away.goals !== b.away.goals);
  }
  return { ok: true, report: {
    schemaVersion: M1_V8_MEDICAL_DIAGNOSTIC_SCHEMA_VERSION,
    status: 'SYNTHETIC_MEDICAL_COUNTERFACTUAL_NOT_CALIBRATED',
    referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE',
    scenario: 'EXOGENOUS_FIXED_MEDICAL_ACTIONS_NOT_GENERATED',
    engineVersion: M1_V8_ENGINE_VERSION,
    eventSchemaVersion: M1_V8_EVENT_SCHEMA_VERSION,
    rngVersion: RNG_VERSION,
    fixtureId: prematch.fixture.id,
    sourcePackId: prematch.catalog.packId,
    sourcePackVersion: prematch.catalog.packVersion,
    firstSeed: options.firstSeed,
    lastSeed: options.firstSeed + options.matchCount - 1,
    matchCount: options.matchCount,
    medicalActionCount: medicalActions.length,
    pairedDifferences: {
      homeGoals: means.homeGoals.value(),
      awayGoals: means.awayGoals.value(),
      totalShots: means.totalShots.value(),
      openPlayXg: means.openPlayXg.value(),
    },
    shotLedgerChanged: rate(changedShots, options.matchCount),
    changedScoreline: rate(changedScores, options.matchCount),
  } };
}

import { sameCanonicalValue } from './canonical-value.js';
import type { M1Mean } from './m1-diagnostics.js';
import type { M1PrematchInput } from './m1-clock.js';
import { M1_V8_ENGINE_VERSION, M1_V8_EVENT_SCHEMA_VERSION,
  simulateM1V8MedicalPhases } from './m1-v8-medical-phases.js';
import { RNG_VERSION } from './rng.js';

/**
 * Engineering-only home/away counterfactual for a real pair of synthetic
 * reverse-leg fixtures. No exogenous events, medical authority, licensed
 * benchmark or numerical realism acceptance is inferred.
 */
export const M1_V8_MIRRORED_DIAGNOSTIC_SCHEMA_VERSION = 1 as const;
const Z95 = 1.959963984540054;
export interface M1V8MirroredDiagnosticReport {
  readonly schemaVersion: typeof M1_V8_MIRRORED_DIAGNOSTIC_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_MIRRORED_LEGS_NOT_CALIBRATED';
  readonly referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE';
  readonly scenario: 'FIXED_CLUBS_REVERSE_LEGS_SAME_SEED_NO_REFEREE_OR_MEDICAL';
  readonly engineVersion: typeof M1_V8_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V8_EVENT_SCHEMA_VERSION;
  readonly rngVersion: typeof RNG_VERSION;
  readonly sourcePackId: string;
  readonly sourcePackVersion: string;
  readonly firstClubId: string;
  readonly secondClubId: string;
  readonly homeLegFixtureId: string;
  readonly awayLegFixtureId: string;
  readonly firstSeed: number;
  readonly lastSeed: number;
  readonly pairCount: number;
  readonly matchesSimulated: number;
  readonly aggregateGoalsPerTwoLegPair: M1Mean;
  /** Average home goals minus away goals PER FIXTURE, not a target. */
  readonly netHomeGoalsPerFixture: M1Mean;
  /** First club's goals at home minus its goals away, per same-seed pair. */
  readonly firstClubHomeAwayGoalDifference: M1Mean;
  /** Second club's goals at home minus its goals away, per same-seed pair. */
  readonly secondClubHomeAwayGoalDifference: M1Mean;
}
export type M1V8MirroredDiagnosticResult =
  | Readonly<{ ok: true; report: M1V8MirroredDiagnosticReport }>
  | Readonly<{ ok: false; error: 'INVALID_PLAN' | 'MATCH_FAILED' }>;

// Welford variance avoids cancellation when combining many paired seeds.
class SampleMean {
  private count = 0;
  private total = 0;
  private mean = 0;
  private m2 = 0;
  add(value: number): void {
    this.count++;
    this.total += value;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    this.m2 += delta * (value - this.mean);
  }
  result(): M1Mean {
    const variance = this.count < 2 ? null :
      Math.max(0, this.m2 / (this.count - 1));
    const sampleStdDev = variance === null ? null : Math.sqrt(variance);
    const margin = sampleStdDev === null ? null :
      Z95 * sampleStdDev / Math.sqrt(this.count);
    return {
      count: this.count, total: this.total,
      mean: this.total / this.count,
      sampleStdDev, normalMean95: margin === null ? null : {
        lower: this.mean - margin, upper: this.mean + margin,
      },
    };
  }
}
const rec = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Reverse the actual participating clubs AND their unchanged lineups/tactics. */
function paired(first: unknown, reverse: unknown): boolean {
  if (!rec(first) || !rec(reverse) ||
      !rec(first.fixture) || !rec(reverse.fixture) ||
      first.fixture.homeClubId === first.fixture.awayClubId ||
      first.fixture.homeClubId !== reverse.fixture.awayClubId ||
      first.fixture.awayClubId !== reverse.fixture.homeClubId ||
      first.fixture.id === reverse.fixture.id ||
      !sameCanonicalValue(first.catalog, reverse.catalog) ||
      !sameCanonicalValue(first.homeLineup, reverse.awayLineup) ||
      !sameCanonicalValue(first.awayLineup, reverse.homeLineup) ||
      !sameCanonicalValue(first.homeTactics, reverse.awayTactics) ||
      !sameCanonicalValue(first.awayTactics, reverse.homeTactics)) return false;
  return true;
}

/** One synthetic fixed-team two-leg pair per seed, no expected winner. */
export function runM1V8MirroredHomeAwayDiagnostics(
  first: unknown, reverse: unknown, policy: unknown,
  firstSeed: number, pairCount: number,
): M1V8MirroredDiagnosticResult {
  if (!Number.isSafeInteger(firstSeed) || firstSeed < 1 ||
      !Number.isSafeInteger(pairCount) || pairCount < 1 ||
      pairCount > 10000 || firstSeed + pairCount - 1 > 0xffffffff ||
      !paired(first, reverse)) return { ok: false, error: 'INVALID_PLAN' };
  const home = first as M1PrematchInput;
  const away = reverse as M1PrematchInput;
  const goals = new SampleMean();
  const homeDifference = new SampleMean();
  const firstClubDifference = new SampleMean();
  const secondClubDifference = new SampleMean();
  for (let seed = firstSeed; seed < firstSeed + pairCount; seed++) {
    const homeResult = simulateM1V8MedicalPhases(
      { ...home, rngSeed: seed }, policy, [], [], []);
    const awayResult = simulateM1V8MedicalPhases(
      { ...away, rngSeed: seed }, policy, [], [], []);
    if (!homeResult.ok || !awayResult.ok) {
      return { ok: false, error: 'MATCH_FAILED' };
    }
    const aHome = homeResult.report.home.goals;
    const bAway = homeResult.report.away.goals;
    const bHome = awayResult.report.home.goals;
    const aAway = awayResult.report.away.goals;
    goals.add(aHome + bAway + bHome + aAway);
    homeDifference.add((aHome + bHome - bAway - aAway) / 2);
    firstClubDifference.add(aHome - aAway);
    secondClubDifference.add(bHome - bAway);
  }
  return { ok: true, report: {
    schemaVersion: M1_V8_MIRRORED_DIAGNOSTIC_SCHEMA_VERSION,
    status: 'SYNTHETIC_MIRRORED_LEGS_NOT_CALIBRATED',
    referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE',
    scenario: 'FIXED_CLUBS_REVERSE_LEGS_SAME_SEED_NO_REFEREE_OR_MEDICAL',
    engineVersion: M1_V8_ENGINE_VERSION,
    eventSchemaVersion: M1_V8_EVENT_SCHEMA_VERSION,
    rngVersion: RNG_VERSION,
    sourcePackId: home.catalog.packId,
    sourcePackVersion: home.catalog.packVersion,
    firstClubId: home.fixture.homeClubId,
    secondClubId: home.fixture.awayClubId,
    homeLegFixtureId: home.fixture.id,
    awayLegFixtureId: away.fixture.id,
    firstSeed, lastSeed: firstSeed + pairCount - 1,
    pairCount, matchesSimulated: pairCount * 2,
    aggregateGoalsPerTwoLegPair: goals.result(),
    netHomeGoalsPerFixture: homeDifference.result(),
    firstClubHomeAwayGoalDifference: firstClubDifference.result(),
    secondClubHomeAwayGoalDifference: secondClubDifference.result(),
  } };
}

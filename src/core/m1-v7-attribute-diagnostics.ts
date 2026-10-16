import { startM1Clock, type M1PrematchInput } from './m1-clock.js';
import type { M1Mean, M1Rate } from './m1-diagnostics.js';
import { m1Wilson95 } from './m1-diagnostics.js';
import { M1_V7_ENGINE_VERSION, M1_V7_EVENT_SCHEMA_VERSION,
  simulateM1V7Phases, type M1V7Result } from './m1-v7-adjudications.js';
import { RNG_VERSION } from './rng.js';

/**
 * Bounded fixed-seed paired finishing-attribute sensitivity experiment.
 * A transient synthetic catalog variant is not a new signed game data pack,
 * an official rating or an authorized change to an existing saved career.
 */
export const M1_V7_ATTRIBUTE_DIAGNOSTIC_SCHEMA_VERSION = 1 as const;
export interface M1V7AttributePlan {
  readonly firstSeed: number;
  readonly matchCount: number;
  readonly playerId: string;
  readonly finishingDelta: number;
}
export interface M1V7AttributeSensitivityReport {
  readonly schemaVersion: typeof M1_V7_ATTRIBUTE_DIAGNOSTIC_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_COUNTERFACTUAL_NOT_CALIBRATED';
  readonly referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE';
  readonly variantStatus: 'TRANSIENT_EXPERIMENT_NOT_GAME_PACK';
  readonly engineVersion: typeof M1_V7_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V7_EVENT_SCHEMA_VERSION;
  readonly rngVersion: typeof RNG_VERSION;
  readonly fixtureId: string;
  readonly sourcePackId: string;
  readonly sourcePackVersion: string;
  readonly firstSeed: number;
  readonly lastSeed: number;
  readonly matchCount: number;
  readonly playerId: string;
  readonly clubId: string;
  readonly originalFinishing: number;
  readonly finishingDelta: number;
  readonly variantFinishing: number;
  readonly pairedChanges: Readonly<{
    clubGoals: M1Mean;
    clubShots: M1Mean;
    clubOpenPlayXg: M1Mean;
    selectedPlayerShots: M1Mean;
    selectedPlayerGoals: M1Mean;
  }>;
  readonly selectedShotDirection: Readonly<{
    increased: M1Rate;
    unchanged: M1Rate;
    decreased: M1Rate;
  }>;
}
export type M1V7AttributeSensitivityResult =
  | Readonly<{ ok: true; report: M1V7AttributeSensitivityReport }>
  | Readonly<{ ok: false; error: 'INVALID_PLAN' | 'INVALID_SOURCE' |
    'INVALID_PLAYER' | 'MATCH_FAILED' | 'INTERNAL_INVARIANT' }>;

const z = 1.959963984540054;
class MeanAccumulator {
  count = 0;
  total = 0;
  private avg = 0;
  private m2 = 0;
  add(value: number): void {
    this.count++;
    this.total += value;
    const difference = value - this.avg;
    this.avg += difference / this.count;
    this.m2 += difference * (value - this.avg);
  }
  report(): M1Mean {
    const stdDev = this.count < 2 ? null :
      Math.sqrt(Math.max(0, this.m2 / (this.count - 1)));
    const margin = stdDev === null ? null : z * stdDev / Math.sqrt(this.count);
    return {
      count: this.count, total: this.total, mean: this.avg,
      sampleStdDev: stdDev,
      normalMean95: margin === null ? null :
        { lower: this.avg - margin, upper: this.avg + margin },
    };
  }
}
function rate(count: number, denominator: number): M1Rate {
  return { count, denominator, rate: count / denominator,
    wilson95: m1Wilson95(count, denominator)! };
}
function playerShots(result: M1V7Result, playerId: string): {
  shots: number; goals: number;
} {
  let shots = 0, goals = 0;
  for (const event of result.events) {
    if (event.type !== 'v6-event' || event.source.type !== 'shot' ||
        event.source.playerId !== playerId) continue;
    shots++;
    goals += Number(event.source.outcome === 'goal');
  }
  return { shots, goals };
}

export function runM1V7PairedFinishingExperiment(
  prematch: M1PrematchInput, policy: unknown, plan: M1V7AttributePlan,
): M1V7AttributeSensitivityResult {
  if (!plan || !Number.isSafeInteger(plan.firstSeed) ||
      !Number.isSafeInteger(plan.matchCount) ||
      !Number.isSafeInteger(plan.finishingDelta) ||
      plan.firstSeed < 1 || plan.firstSeed > 0xffffffff ||
      plan.matchCount < 1 || plan.matchCount > 10000 ||
      plan.firstSeed + plan.matchCount - 1 > 0xffffffff ||
      plan.finishingDelta === 0 || Math.abs(plan.finishingDelta) > 20 ||
      typeof plan.playerId !== 'string') return { ok: false, error: 'INVALID_PLAN' };
  if (!startM1Clock(prematch).ok) return { ok: false, error: 'INVALID_SOURCE' };
  const player = prematch.catalog.players.find(p => p.id === plan.playerId);
  const side = prematch.homeLineup.starters.includes(plan.playerId) ? 'home' :
    prematch.awayLineup.starters.includes(plan.playerId) ? 'away' : null;
  if (!player || player.primaryPosition === 'GK' || side === null ||
      player.attributes.finishing + plan.finishingDelta < 1 ||
      player.attributes.finishing + plan.finishingDelta > 100) {
    return { ok: false, error: 'INVALID_PLAYER' };
  }
  const variantCatalog = {
    ...prematch.catalog,
    players: prematch.catalog.players.map(p =>
      p.id === plan.playerId ?
        { ...p, attributes: { ...p.attributes,
          finishing: p.attributes.finishing + plan.finishingDelta } } : p),
  };
  const summaries = {
    clubGoals: new MeanAccumulator(), clubShots: new MeanAccumulator(),
    clubOpenPlayXg: new MeanAccumulator(), selectedPlayerShots: new MeanAccumulator(),
    selectedPlayerGoals: new MeanAccumulator(),
  };
  let up = 0, same = 0, down = 0;
  for (let i = 0; i < plan.matchCount; i++) {
    const rngSeed = plan.firstSeed + i;
    const normal = simulateM1V7Phases({ ...prematch, rngSeed }, policy, [], []);
    const variant = simulateM1V7Phases(
      { ...prematch, rngSeed, catalog: variantCatalog }, policy, [], []);
    if (!normal.ok || !variant.ok) return { ok: false, error: 'MATCH_FAILED' };
    if (normal.base.rngDraws !== 90 || variant.base.rngDraws !== 90 ||
        normal.base.rngState !== variant.base.rngState ||
        normal.report[side].xgCoverage !== 'open-play-only' ||
        variant.report[side].xgCoverage !== 'open-play-only') {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
    const original = playerShots(normal, plan.playerId);
    const revised = playerShots(variant, plan.playerId);
    const a = normal.report[side], b = variant.report[side];
    summaries.clubGoals.add(b.goals - a.goals);
    summaries.clubShots.add(b.shots - a.shots);
    summaries.clubOpenPlayXg.add((b.xgMilli - a.xgMilli) / 1000);
    summaries.selectedPlayerShots.add(revised.shots - original.shots);
    summaries.selectedPlayerGoals.add(revised.goals - original.goals);
    const diff = revised.shots - original.shots;
    up += Number(diff > 0);
    same += Number(diff === 0);
    down += Number(diff < 0);
    if (original.goals > original.shots || revised.goals > revised.shots) {
      return { ok: false, error: 'INTERNAL_INVARIANT' };
    }
  }
  return { ok: true, report: {
    schemaVersion: M1_V7_ATTRIBUTE_DIAGNOSTIC_SCHEMA_VERSION,
    status: 'SYNTHETIC_COUNTERFACTUAL_NOT_CALIBRATED',
    referenceStatus: 'NO_LICENSED_EXTERNAL_REFERENCE',
    variantStatus: 'TRANSIENT_EXPERIMENT_NOT_GAME_PACK',
    engineVersion: M1_V7_ENGINE_VERSION,
    eventSchemaVersion: M1_V7_EVENT_SCHEMA_VERSION, rngVersion: RNG_VERSION,
    fixtureId: prematch.fixture.id, sourcePackId: prematch.catalog.packId,
    sourcePackVersion: prematch.catalog.packVersion,
    firstSeed: plan.firstSeed, lastSeed: plan.firstSeed + plan.matchCount - 1,
    matchCount: plan.matchCount, playerId: plan.playerId,
    clubId: side === 'home' ? prematch.fixture.homeClubId : prematch.fixture.awayClubId,
    originalFinishing: player.attributes.finishing,
    finishingDelta: plan.finishingDelta,
    variantFinishing: player.attributes.finishing + plan.finishingDelta,
    pairedChanges: {
      clubGoals: summaries.clubGoals.report(),
      clubShots: summaries.clubShots.report(),
      clubOpenPlayXg: summaries.clubOpenPlayXg.report(),
      selectedPlayerShots: summaries.selectedPlayerShots.report(),
      selectedPlayerGoals: summaries.selectedPlayerGoals.report(),
    },
    selectedShotDirection: {
      increased: rate(up, plan.matchCount), unchanged: rate(same, plan.matchCount),
      decreased: rate(down, plan.matchCount),
    },
  } };
}

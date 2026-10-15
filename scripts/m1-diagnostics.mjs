#!/usr/bin/env node
/**
 * Reproducible, synthetic-only M1 internal diagnostic.
 * Examples:
 * npm run diagnose:m1
 * npm run diagnose:m1 -- --count=10000 --first-seed=1
 *
 * A successful exit means the ledger is internally coherent. It is NOT an
 * independently benchmarked or calibrated football simulation.
 */
import { runM1SyntheticDiagnostics } from '../dist/core/m1-diagnostics.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import {
  MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION,
} from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup } from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

function numericArg(flag, fallback) {
  const matches = process.argv.slice(2).filter(x => x.startsWith('--' + flag + '='));
  if (matches.length > 1) throw Error('Duplicate --' + flag);
  if (!matches.length) return fallback;
  const digits = matches[0].slice(flag.length + 3);
  if (!/^[0-9]{1,10}$/.test(digits)) throw Error('Invalid --' + flag);
  return Number(digits);
}
async function main() {
  for (const arg of process.argv.slice(2)) {
    if (!/^--(?:count|first-seed)=[0-9]+$/.test(arg)) {
      throw Error('Only --count=N and --first-seed=N are supported');
    }
  }
  const matchCount = numericArg('count', 128);
  const firstSeed = numericArg('first-seed', 1);
  const catalog = createSyntheticRplScaleCatalog(77);
  const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
  const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
  const prematch = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog,
    homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
    awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: 1,
  };
  const authority = {
    home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
    away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  };
  const result = runM1SyntheticDiagnostics(prematch, authority, { matchCount, firstSeed });
  if (!result.ok) throw Error('M1 internal diagnostic failed: ' + result.error);
  process.stdout.write(JSON.stringify(result.report, null, 2) + '\n');
}
main().catch(error => {
  process.stderr.write(String(error.message ?? error) + '\n');
  process.exitCode = 1;
});

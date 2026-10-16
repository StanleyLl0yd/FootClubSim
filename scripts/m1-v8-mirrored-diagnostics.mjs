#!/usr/bin/env node
/** Fixed-team, same-seed two-leg synthetic v8 diagnostics. No calibration. */
import { performance } from 'node:perf_hooks';
import { runM1V8MirroredHomeAwayDiagnostics }
  from '../dist/core/m1-v8-mirrored-diagnostics.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';

function option(name, fallback) {
  const entries = process.argv.slice(2).filter(x => x.startsWith('--' + name + '='));
  if (entries.length > 1) throw Error('Repeated ' + name);
  if (entries.length === 0) return fallback;
  const match = entries[0].match(new RegExp('^--' + name + '=([0-9]{1,10})$'));
  if (!match) throw Error('Invalid ' + name);
  return Number(match[1]);
}
function main() {
  if (process.argv.slice(2).some(arg =>
    !/^--(?:count|first-seed)=[0-9]{1,10}$/.test(arg))) {
    throw Error('Allowed flags: --count=N --first-seed=N');
  }
  const count = option('count', 64), firstSeed = option('first-seed', 1);
  const catalog = createSyntheticRplScaleCatalog(77);
  const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
    .flatMap(round => round.fixtures);
  const first = fixtures[0];
  const reverse = fixtures.find(f =>
    f.homeClubId === first.awayClubId &&
    f.awayClubId === first.homeClubId);
  if (!reverse) throw Error('Reverse leg not found');
  const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
  function prematch(fixture) {
    return {
      schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
      rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
      fixture, catalog,
      homeLineup: defaultSyntheticLineup(clubs.get(fixture.homeClubId)),
      awayLineup: defaultSyntheticLineup(clubs.get(fixture.awayClubId)),
      homeTactics: defaultTacticalPlan(fixture.homeClubId),
      awayTactics: defaultTacticalPlan(fixture.awayClubId),
      rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
      rngAlgorithmVersion: RNG_VERSION, rngSeed: firstSeed,
    };
  }
  const policy = {
    home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
    away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  };
  const start = performance.now();
  const result = runM1V8MirroredHomeAwayDiagnostics(
    prematch(first), prematch(reverse), policy, firstSeed, count);
  if (!result.ok) throw Error('Mirrored diagnostic rejected: ' + result.error);
  process.stdout.write(JSON.stringify({
    ...result.report, elapsedMs: performance.now() - start,
  }, null, 2) + '\n');
}
try {
  main();
} catch (error) {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
}

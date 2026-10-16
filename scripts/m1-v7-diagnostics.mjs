#!/usr/bin/env node
/** Reproducible synthetic-only v7 diagnostics. No external realism reference. */
import { performance } from 'node:perf_hooks';
import { runM1V7SyntheticDiagnostics } from '../dist/core/m1-v7-diagnostics.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

function getInt(name, fallback) {
  const entries = process.argv.slice(2).filter(a => a.startsWith('--' + name + '='));
  if (entries.length > 1) throw Error('Duplicate ' + name);
  if (!entries.length) return fallback;
  const match = entries[0].match(new RegExp('^--' + name + '=([0-9]{1,10})$'));
  if (!match) throw Error('Invalid ' + name);
  return Number(match[1]);
}
function main() {
  const allowed = /^--(?:count|first-seed)=[0-9]{1,10}$|^--forced-penalty$/;
  if (process.argv.slice(2).some(a => !allowed.test(a)) ||
      process.argv.slice(2).filter(a => a === '--forced-penalty').length > 1) {
    throw Error('Allowed arguments: --count=N --first-seed=N --forced-penalty');
  }
  const catalog = createSyntheticRplScaleCatalog(77);
  const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
  const home = catalog.clubs.find(c => c.id === fixture.homeClubId);
  const away = catalog.clubs.find(c => c.id === fixture.awayClubId);
  const homeLineup = defaultSyntheticLineup(home), awayLineup = defaultSyntheticLineup(away);
  const source = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog, homeLineup, awayLineup,
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
    rngAlgorithmVersion: RNG_VERSION, rngSeed: 1,
  };
  const policy = {
    home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
    away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  };
  const forced = process.argv.includes('--forced-penalty');
  const taker = homeLineup.starters.find(id =>
    catalog.players.find(p => p.id === id).primaryPosition !== 'GK');
  const decisions = forced ? [{
    schemaVersion: 1, decisionId: 'exogenous-penalty-1',
    fixtureId: fixture.id, teamId: fixture.homeClubId, playerId: taker,
    elapsedSeconds: 300, kind: 'penalty-kick', outcome: 'scored',
  }] : [];
  const start = performance.now();
  const run = runM1V7SyntheticDiagnostics(source, policy, {
    firstSeed: getInt('first-seed', 1), matchCount: getInt('count', 32),
  }, decisions);
  const durationMs = performance.now() - start;
  if (!run.ok) throw Error('V7 diagnostic rejected: ' + run.error);
  process.stdout.write(JSON.stringify({
    ...run.report,
    execution: {
      elapsedMs: durationMs,
      runtime: process.version,
      platform: process.platform,
      arch: process.arch,
      commitSha: process.env.GITHUB_SHA || null,
    },
  }, null, 2) + '\n');
}
try { main(); } catch (error) {
  process.stderr.write(String(error?.message ?? error) + '\n');
  process.exitCode = 1;
}

#!/usr/bin/env node
/** Synthetic v8 paired medical scenario, not empirical injury calibration. */
import { performance } from 'node:perf_hooks';
import { runM1V8PairedMedicalDiagnostics }
  from '../dist/core/m1-v8-medical-diagnostics.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

function getInt(name, fallback) {
  const matches = process.argv.slice(2).filter(a => a.startsWith('--' + name + '='));
  if (matches.length > 1) throw Error('Duplicate ' + name);
  if (!matches.length) return fallback;
  const match = matches[0].match(new RegExp('^--' + name + '=([0-9]{1,10})$'));
  if (!match) throw Error('Invalid ' + name);
  return Number(match[1]);
}
function main() {
  if (process.argv.slice(2).some(arg =>
    !/^--(?:count|first-seed)=[0-9]{1,10}$/.test(arg))) {
    throw Error('Allowed arguments: --count=N --first-seed=N');
  }
  const catalog = createSyntheticRplScaleCatalog(77);
  const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
  const homeLineup = defaultSyntheticLineup(
    catalog.clubs.find(c => c.id === fixture.homeClubId));
  const awayLineup = defaultSyntheticLineup(
    catalog.clubs.find(c => c.id === fixture.awayClubId));
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
  const playerId = homeLineup.starters.find(id =>
    catalog.players.find(p => p.id === id).primaryPosition !== 'GK');
  const medical = [
    { schemaVersion: 1, id: 'paired-medical-exit', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId, elapsedSeconds: 0,
      kind: 'treatment-exit', reason: 'medical-staff-entered',
      restartAtRunningSeconds: 15 },
    { schemaVersion: 1, id: 'paired-medical-return', fixtureId: fixture.id,
      teamId: fixture.homeClubId, playerId, elapsedSeconds: 1500,
      kind: 'treatment-return', returnContext: 'running-clock',
      ballInPlay: true, entryBoundary: 'touchline',
      refereeSignalId: 'synthetic-external-proof-not-provided' },
  ];
  const start = performance.now();
  const result = runM1V8PairedMedicalDiagnostics(source, policy, {
    firstSeed: getInt('first-seed', 1), matchCount: getInt('count', 32),
  }, medical);
  if (!result.ok) throw Error('V8 paired medical diagnostic rejected: ' + result.error);
  process.stdout.write(JSON.stringify({
    ...result.report,
    execution: {
      elapsedMs: performance.now() - start,
      runtime: process.version, platform: process.platform,
      arch: process.arch, commitSha: process.env.GITHUB_SHA || null,
    },
  }, null, 2) + '\n');
}
try { main(); } catch (error) {
  process.stderr.write(String(error?.message ?? error) + '\n');
  process.exitCode = 1;
}

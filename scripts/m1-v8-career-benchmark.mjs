#!/usr/bin/env node
/** Bounded v8 source-journal workload probe; never a calibrated performance gate. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createInitialCareer } from '../dist/core/save.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
import {
  startM1V8MatchJournal, applyM1V8MatchResult,
  applyM1V8MatchResultBatch, validateM1V8MatchJournal,
} from '../dist/core/m1-v8-result-journal.js';
import { deriveM1VerifiedV8SeasonStats }
  from '../dist/core/m1-v8-season-statistics.js';
import { applyM1V8CoherentCareerPreviewBatch }
  from '../dist/core/m1-v8-coherent-career-preview.js';

function arg(name, fallback, max) {
  const args = process.argv.slice(2).filter(s => s.startsWith('--' + name + '='));
  if (args.length > 1) throw Error('Duplicate --' + name);
  if (args.length === 0) return fallback;
  const value = args[0].slice(name.length + 3);
  if (!/^[0-9]{1,10}$/.test(value)) throw Error('Malformed --' + name);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw Error('Out of range --' + name);
  }
  return number;
}
function must(result, context) {
  if (!result.ok) throw Error(context + ': ' + result.error);
  return result;
}
function main() {
  const progressArgs = process.argv.slice(2).filter(a => a === '--progress');
  const previewArgs = process.argv.slice(2).filter(a => a === '--coherent-preview');
  if (progressArgs.length > 1 || previewArgs.length > 1 ||
      process.argv.slice(2).some(a =>
        a !== '--progress' && a !== '--coherent-preview' &&
        !/^--(?:fixture-count|first-seed|batch-size)=[0-9]{1,10}$/.test(a))) {
    throw Error('Allowed arguments: --fixture-count=N --first-seed=N --batch-size=N --progress --coherent-preview');
  }
  const progress = progressArgs.length === 1;
  const coherentPreview = previewArgs.length === 1;
  const count = arg('fixture-count', 8, 240);
  const batchSize = arg('batch-size', 1, 16);
  const firstSeed = arg('first-seed', 1, 0xffffffff);
  if (firstSeed + count - 1 > 0xffffffff) {
    throw Error('Seed range overflows xorshift32');
  }
  const catalog = createSyntheticRplScaleCatalog(77);
  const career = createInitialCareer(catalog, catalog.clubs[0].id, 42,
    'm1-v8-bench-' + firstSeed);
  const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
    .flatMap(round => round.fixtures);
  assert.equal(fixtures.length, 240);
  const clubs = new Map(catalog.clubs.map(c => [c.id, c]));
  const positions = new Map(catalog.players.map(p => [p.id, p.primaryPosition]));
  const policy = {
    home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
    away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  };
  let journal = must(startM1V8MatchJournal(career), 'start').journal;
  const start = performance.now();
  let simulationMs = 0, applyMs = 0;
  let lastCoherentPreview = null;
  const checkpoints = [];
  let pending = [];
  for (let i = 0; i < count; i++) {
    const fixture = fixtures[i];
    const homeLineup = defaultSyntheticLineup(clubs.get(fixture.homeClubId));
    const awayLineup = defaultSyntheticLineup(clubs.get(fixture.awayClubId));
    const input = {
      schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
      rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
      fixture, catalog, homeLineup, awayLineup,
      homeTactics: defaultTacticalPlan(fixture.homeClubId),
      awayTactics: defaultTacticalPlan(fixture.awayClubId),
      rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
      rngAlgorithmVersion: RNG_VERSION, rngSeed: firstSeed + i,
    };
    const syntheticSpecial = i % 4 === 0;
    const home = homeLineup.starters.find(id => positions.get(id) !== 'GK');
    const away = awayLineup.starters.find(id => positions.get(id) !== 'GK');
    assert.ok(home && away);
    const medicalActions = syntheticSpecial ? [
      { schemaVersion: 1, id: 'bench-exit', fixtureId: fixture.id,
        teamId: fixture.homeClubId, playerId: home,
        elapsedSeconds: 0, kind: 'treatment-exit',
        reason: 'medical-staff-entered', restartAtRunningSeconds: 15 },
      { schemaVersion: 1, id: 'bench-return', fixtureId: fixture.id,
        teamId: fixture.homeClubId, playerId: home,
        elapsedSeconds: 300, kind: 'treatment-return',
        returnContext: 'running-clock', ballInPlay: true,
        entryBoundary: 'touchline', refereeSignalId: 'unverified-benchmark-claim' },
    ] : [];
    const trustedDecisions = syntheticSpecial ? [
      { schemaVersion: 1, decisionId: 'bench-penalty',
        fixtureId: fixture.id, teamId: fixture.homeClubId,
        playerId: home, elapsedSeconds: 600,
        kind: 'penalty-kick', outcome: 'scored' },
      { schemaVersion: 1, decisionId: 'bench-own-goal',
        fixtureId: fixture.id, teamId: fixture.homeClubId,
        playerId: away, elapsedSeconds: 900, kind: 'own-goal' },
    ] : [];
    const simStart = performance.now();
    const result = must(simulateM1V8MedicalPhases(
      input, policy, [], trustedDecisions, medicalActions),
    'simulate fixture ' + (i + 1));
    simulationMs += performance.now() - simStart;
    const command = {
      schemaVersion: 4, commandId: 'benchmark-fixture-' + (i + 1),
      careerId: career.careerId, expectedRevision: i,
      prematch: input, policy, plannedCommands: [],
      trustedDecisions, medicalActions, result,
    };
    pending.push(command);
    if (pending.length === batchSize || i === count - 1) {
      const applyStart = performance.now();
      const proposal = coherentPreview ?
        applyM1V8CoherentCareerPreviewBatch(career, journal, pending) :
        batchSize === 1 ?
          applyM1V8MatchResult(career, journal, pending[0]) :
          applyM1V8MatchResultBatch(career, journal, pending);
      const elapsed = performance.now() - applyStart;
      journal = must(proposal, 'apply through fixture ' + (i + 1)).journal;
      if (coherentPreview) {
        // This research preview does not post official points or persist data.
        lastCoherentPreview = proposal.preview;
        assert.equal(lastCoherentPreview.journalRevision, i + 1);
        assert.equal(lastCoherentPreview.completedFixtures, i + 1);
        assert.equal(lastCoherentPreview.fixtureCoverage.completedFixtures, i + 1);
        assert.equal(lastCoherentPreview.seasonStatistics.completedFixtures, i + 1);
        assert.equal(lastCoherentPreview.unrankedPoints.completedFixtures, i + 1);
      }
      applyMs += elapsed;
      pending = [];
      assert.equal(journal.revision, i + 1);
      if (progress) process.stderr.write(JSON.stringify({
        status: 'SYNTHETIC_V8_PROGRESS_NOT_A_GATE',
        completedFixtures: i + 1, incrementalBatchApplyMs: elapsed,
        elapsedMs: performance.now() - start,
        journalBytes: Buffer.byteLength(JSON.stringify(journal), 'utf8'),
      }) + '\n');
      if ((i + 1) === count || ((i + 1) & i) === 0) {
        checkpoints.push({
          fixtures: i + 1, applyMs: elapsed,
          encodedJournalBytes: Buffer.byteLength(JSON.stringify(journal), 'utf8'),
        });
      }
    }
  }
  const verificationStart = performance.now();
  const recovered = must(validateM1V8MatchJournal(career,
    JSON.parse(JSON.stringify(journal))), 'final full replay');
  assert.equal(recovered.journal.revision, count);
  const verificationMs = performance.now() - verificationStart;
  const statisticsStart = performance.now();
  const season = must(deriveM1VerifiedV8SeasonStats(career, journal),
    'season projection').report;
  assert.equal(season.completedFixtures, count);
  assert.equal(season.journalRevision, count);
  const statisticsMs = performance.now() - statisticsStart;
  const totalMs = performance.now() - start;
  process.stdout.write(JSON.stringify({
    status: 'SYNTHETIC_V8_WORKLOAD_ONLY_NOT_A_PERFORMANCE_GATE',
    source: { catalogSeed: 77, firstSeed, fixtureCount: count,
      journalSchema: 4, engineVersion: '7', eventSchema: 8,
      batchSize, transactionMode: coherentPreview ? 'coherent-preview-batch' :
        batchSize === 1 ? 'single' : 'atomic-batch',
      claimAuthentication: false },
    measurements: { totalMs, simulationMs, incrementalApplyMs: applyMs,
      finalReplayValidationMs: verificationMs,
      finalSeasonProjectionMs: statisticsMs,
      ...(coherentPreview ? { finalCoherentPreviewBytes:
        Buffer.byteLength(JSON.stringify(lastCoherentPreview), 'utf8') } : {}),
      journalBytes: Buffer.byteLength(JSON.stringify(journal), 'utf8'),
      rssBytesAfter: process.memoryUsage().rss, checkpoints },
    environment: { node: process.version, platform: process.platform,
      arch: process.arch, commitSha: process.env.GITHUB_SHA ?? null },
    limitations: ['synthetic-only',
      ...(coherentPreview ? [
        'incrementalApplyMs includes three independent full-history projection replays',
      ] : []),
      'no IndexedDB disk or quota throughput',
      'not a cross-browser or OS-crash durability test',
      'no real-football calibration or accepted latency thresholds'],
  }, null, 2) + '\n');
}
try { main(); }
catch (error) {
  process.stderr.write(String(error?.stack ?? error) + '\n');
  process.exitCode = 1;
}

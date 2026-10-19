import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  inspectM1P5FreeSourcePolicy, decideM1P5FreeSourcePurpose,
  M1_P5_FREE_POLICY_VERSION, M1_P5_PERMITTED_PURPOSES,
} from '../scripts/m1-p5-free-source-gate.mjs';

const file = new URL('../data/m1-p5-free-source-policy.json', import.meta.url);
const source = () => JSON.parse(readFileSync(file, 'utf8'));
const mutate = fn => {
  const policy = source();
  fn(policy);
  assert.throws(() => inspectM1P5FreeSourcePolicy(policy));
};

test('owner approved a zero-fee policy, while no calibration or packaging is accepted', () => {
  const candidate = source();
  const report = inspectM1P5FreeSourcePolicy(candidate);
  assert.equal(M1_P5_FREE_POLICY_VERSION, 1);
  assert.equal(report.mode, 'FREE_ONLY');
  assert.equal(report.maxPaidDataCostRub, 0);
  assert.equal(report.sourcesScreened, 10);
  assert.equal(report.provisionalScoreSources, 1);
  assert.equal(report.reservedHoldoutSources, 1);
  assert.equal(report.producedRealRplEventCalibration, false);
  assert.equal(report.acceptedCalibration, false);
  assert.equal(report.packageThirdPartyData, false);
  assert.equal(report.m1ExitApproved, false);
  assert.equal(candidate.referenceSeparation.holdoutKnownToResearchers, true);
});

test('only corrected 2023/24 source is provisionally eligible for score research', () => {
  const policy = source();
  assert.deepEqual(decideM1P5FreeSourcePurpose(
    policy, 'rpl-results-2023-development',
    'provisional-rpl-score-development'),
    { allowed: true, reason: 'PROVISIONAL_DESCRIPTIVE_SCORE_ONLY' });
  assert.deepEqual(decideM1P5FreeSourcePurpose(
    policy, 'rpl-results-2024-reserved',
    'provisional-rpl-score-development'),
    { allowed: false, reason: 'RESERVED_HOLDOUT_NOT_FIT_DATA' });
  assert.equal(decideM1P5FreeSourcePurpose(
    policy, 'rpl-results-2024-reserved',
    'reserved-holdout-evaluation').allowed, false);
});

test('original CC BY event research is permitted without permitting its direct RPL transfer', () => {
  const policy = source();
  for (const id of ['original-pappalardo-events', 'dfl-figshare-7matches']) {
    assert.deepEqual(decideM1P5FreeSourcePurpose(
      policy, id, 'cross-league-mechanics-research'),
      { allowed: true, reason: 'ATTRIBUTED_RESEARCH_NO_RPL_TRANSFER' });
    assert.equal(decideM1P5FreeSourcePurpose(
      policy, id, 'rpl-event-calibration').allowed, false);
    assert.equal(decideM1P5FreeSourcePurpose(
      policy, id, 'production-dataset-import').allowed, false);
  }
  for (const id of [
    'soccermon-original-injuries',
    'rpl-published-technical-report',
    'rfs-official-2023-events',
    'footbolno-open-claims',
    'thirdparty-wyscout-transform',
    'statsbomb-research-restricted',
  ]) {
    assert.equal(decideM1P5FreeSourcePurpose(
      policy, id, 'production-dataset-import').allowed, false);
    assert.equal(decideM1P5FreeSourcePurpose(
      policy, id, 'cross-league-mechanics-research').allowed, false);
    assert.equal(decideM1P5FreeSourcePurpose(
      policy, id, 'source-metadata-review').allowed, true);
  }
});

test('no source can be relabelled to production or RPL events by changing purpose', () => {
  const policy = source();
  assert.ok(M1_P5_PERMITTED_PURPOSES.includes('production-dataset-import'));
  for (const item of policy.sources) {
    for (const purpose of ['production-dataset-import', 'rpl-event-calibration']) {
      assert.equal(decideM1P5FreeSourcePurpose(policy, item.id, purpose).allowed,
        false, item.id + ':' + purpose);
    }
  }
  assert.deepEqual(decideM1P5FreeSourcePurpose(
    policy, '__missing', 'source-metadata-review'),
    { allowed: false, reason: 'UNKNOWN_SOURCE' });
  assert.deepEqual(decideM1P5FreeSourcePurpose(
    policy, 'rpl-results-2023-development', 'buy-commercial-feed'),
    { allowed: false, reason: 'UNKNOWN_REQUEST' });
});

test('altered budget, license or milestone cannot silently opt into paid data', () => {
  for (const update of [
    x => { x.maxPaidDataCostRub = 1; },
    x => { x.paywallAllowed = true; },
    x => { x.ownerDecision = 'CHEAP_BUT_PAID'; },
    x => { x.projectLicense = 'CC0'; },
    x => { x.intendedMilestone = 'M2'; },
    x => { x.acceptanceState = 'CALIBRATED'; },
    x => { x.referenceSeparation.reservedHoldoutSeason = '2023/2024'; },
    x => { x.referenceSeparation.holdoutKnownToResearchers = false; },
    x => { x.extraCommercialSource = 'https://vendor.com'; },
  ]) mutate(update);
});

test('unverifiable source and role escalation require deliberate policy revision', () => {
  for (const update of [
    x => { x.sources[0].rightsStatus = 'COMMERCIAL_LICENSE_VERIFIED'; },
    x => { x.sources[0].allowedMetrics.push('xg'); },
    x => { x.sources[0].sourceSha256 = null; },
    x => { x.sources[0].sourceSha256 = 'z'.repeat(64); },
    x => { x.sources[0].role = 'CROSS_LEAGUE_EVENTS_RESEARCH'; },
    x => { x.sources[2].coverage = 'RPL_2023_24'; },
    x => { x.sources[3].rightsStatus = 'PUBLISHER_CC0_UPSTREAM_UNVERIFIED'; },
    x => { x.sources[4].allowedMetrics.push('shots'); },
    x => { x.sources[5].allowedMetrics.push('injury-monitoring'); },
    x => { x.sources[8].allowedMetrics.push('xg'); },
    x => { x.sources[0].origin = 'http://unsafe.test/data'; },
    x => { x.sources[0].rightsEvidence = 'https://x.test/<script>'; },
    x => { x.sources[0].additionalTerms = 'all-clear'; },
    x => { x.sources.push(x.sources[0]); },
    x => { x.sources[1].role = 'DEVELOPMENT_SCORES'; },
    x => { x.sources = []; },
  ]) mutate(update);
});

test('non-JSON or JavaScript accessor input is rejected without invoking attacker getters', () => {
  let calls = 0;
  const getter = source();
  Object.defineProperty(getter.sources[0], 'name', {
    enumerable: true, get() { calls++; return 'spoofed'; },
  });
  assert.throws(() => inspectM1P5FreeSourcePolicy(getter));
  assert.equal(calls, 0);
  const cycle = source();
  cycle.sources[0].loop = cycle;
  assert.throws(() => inspectM1P5FreeSourcePolicy(cycle));
  const alias = source();
  alias.sources[2] = alias.sources[0];
  assert.throws(() => inspectM1P5FreeSourcePolicy(alias));
  const sparse = source();
  delete sparse.sources[2];
  assert.throws(() => inspectM1P5FreeSourcePolicy(sparse));
  const malicious = source();
  malicious.sources[0].allowedMetrics.push(undefined);
  assert.throws(() => inspectM1P5FreeSourcePolicy(malicious));
});

test('RFU official 2023/24 events remain metadata-only until rights are reviewed', () => {
  const policy = source();
  const rfs = policy.sources.find(item => item.id === 'rfs-official-2023-events');
  assert.equal(rfs.coverage, 'RPL_2023_24');
  assert.equal(rfs.rightsStatus, 'PUBLIC_VIEW_ONLY_NO_DATA_LICENSE');
  assert.equal(rfs.sourceSha256, null);
  assert.deepEqual(rfs.allowedMetrics, []);
  assert.deepEqual(decideM1P5FreeSourcePurpose(
    policy, 'rfs-official-2023-events', 'source-metadata-review'),
    { allowed: true, reason: 'CITATION_METADATA_ONLY_NO_RAW_IMPORT' });
  for (const purpose of [
    'provisional-rpl-score-development', 'rpl-event-calibration',
    'cross-league-mechanics-research', 'production-dataset-import',
  ]) assert.equal(decideM1P5FreeSourcePurpose(
    policy, 'rfs-official-2023-events', purpose).allowed, false);
  mutate(x => {
    x.sources.find(item => item.id === 'rfs-official-2023-events')
      .allowedMetrics.push('event-tags');
  });
  mutate(x => {
    x.sources.find(item => item.id === 'rfs-official-2023-events')
      .sourceSha256 = 'a'.repeat(64);
  });
  mutate(x => {
    x.sources.find(item => item.id === 'rfs-official-2023-events')
      .rightsStatus = 'ORIGINAL_CC_BY_4_0';
  });
});

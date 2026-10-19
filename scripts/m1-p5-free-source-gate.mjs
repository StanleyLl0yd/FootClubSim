#!/usr/bin/env node
/**
 * M1-P5 no-cost source policy. Source metadata is research, not a commercial
 * license clearance or an assertion that unavailable events equal zero.
 *
 * This module makes silent paid-source upgrades and cross-league-to-RPL
 * training transitions reject; it does not fetch or redistribute any data.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const M1_P5_FREE_POLICY_VERSION = 1;
export const M1_P5_PERMITTED_PURPOSES = Object.freeze([
  'source-metadata-review',
  'provisional-rpl-score-development',
  'cross-league-mechanics-research',
  'reserved-holdout-evaluation',
  'rpl-event-calibration',
  'production-dataset-import',
]);
const TOP_FIELDS = [
  'schemaVersion', 'ownerDecision', 'maxPaidDataCostRub', 'paywallAllowed',
  'projectLicense', 'intendedMilestone', 'referenceSeparation',
  'acceptanceState', 'sources',
];
const REFERENCE_FIELDS = [
  'developmentSeason', 'reservedHoldoutSeason', 'holdoutKnownToResearchers',
];
const SOURCE_FIELDS = [
  'id', 'name', 'origin', 'rightsEvidence', 'rightsStatus', 'coverage',
  'role', 'sourceSha256', 'allowedMetrics', 'sourceRevision', 'limitation',
];
const SOURCE_ROLES = new Set([
  'DEVELOPMENT_SCORES', 'RESERVED_SCORE_HOLDOUT',
  'CROSS_LEAGUE_EVENTS_RESEARCH', 'CROSS_LEAGUE_INJURY_RESEARCH',
  'MANUAL_RIGHTS_REVIEW', 'BLOCKED_FROM_CALIBRATION',
]);
const RIGHTS = new Set([
  'PUBLISHER_CC0_UPSTREAM_UNVERIFIED', 'ORIGINAL_CC_BY_4_0',
  'PAPER_CC_BY_4_0_DATASET_CLAIM', 'PUBLIC_VIEW_ONLY_NO_DATA_LICENSE',
  'PUBLISHER_CC_BY_UPSTREAM_UNVERIFIED',
  'DERIVATIVE_RIGHTS_UNVERIFIED', 'RESEARCH_TERMS_NO_COMMERCIAL_CLEARANCE',
]);
const METRICS = new Set([
  'home-away-results', 'goals', 'scoreless', 'shots', 'fouls',
  'event-tags', 'xg', 'injury-monitoring',
]);
const PUBLISHER_ORIGINAL = new Set([
  'ORIGINAL_CC_BY_4_0', 'PAPER_CC_BY_4_0_DATASET_CLAIM',
]);
const SCORE_METRICS = ['home-away-results', 'goals', 'scoreless'];
const isPlainRecord = value =>
  value !== null && typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);
function exactKeys(value, keys) {
  return isPlainRecord(value) && Reflect.ownKeys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key));
}
function strictlyPlainJson(value, visited = new Set(), depth = 0) {
  if (value === null || typeof value === 'string' ||
      typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth > 12 || visited.has(value)) return false;
  if (!Array.isArray(value) && !isPlainRecord(value)) return false;
  visited.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const array = Array.isArray(value);
  const result = Reflect.ownKeys(descriptors).every(key => {
    if (array && key === 'length') return true;
    const item = descriptors[key];
    return typeof key === 'string' &&
      Object.hasOwn(item, 'value') &&
      item.enumerable && strictlyPlainJson(item.value, visited, depth + 1);
  }) && (!array || Object.keys(value).length === value.length);
  visited.delete(value);
  return result;
}
const validUrl = u => typeof u === 'string' && u.length >= 14 &&
  u.length <= 400 && /^https:\/\/[a-zA-Z0-9.-]+(?:\/|$)/.test(u) &&
  !/[<>"\\\s]/.test(u);
function validateSource(source) {
  if (!exactKeys(source, SOURCE_FIELDS) ||
      typeof source.id !== 'string' ||
      !/^[a-z][a-z0-9-]{2,63}$/.test(source.id) ||
      typeof source.name !== 'string' || source.name.length < 5 ||
      source.name.length > 140 ||
      !validUrl(source.origin) || !validUrl(source.rightsEvidence) ||
      !RIGHTS.has(source.rightsStatus) ||
      typeof source.coverage !== 'string' ||
      !['RPL_2023_24', 'RPL_2024_25', 'RPL_MULTI_UNVERIFIED',
        'NON_RPL_HISTORIC'].includes(source.coverage) ||
      !SOURCE_ROLES.has(source.role) ||
      !(source.sourceSha256 === null ||
        typeof source.sourceSha256 === 'string' &&
        /^[0-9a-f]{64}$/.test(source.sourceSha256)) ||
      !Array.isArray(source.allowedMetrics) || source.allowedMetrics.length > 5 ||
      new Set(source.allowedMetrics).size !== source.allowedMetrics.length ||
      !source.allowedMetrics.every(item => METRICS.has(item)) ||
      typeof source.sourceRevision !== 'string' ||
      source.sourceRevision.length < 5 || source.sourceRevision.length > 160 ||
      typeof source.limitation !== 'string' ||
      source.limitation.length < 20 || source.limitation.length > 400) {
    throw Error('Invalid free-source record');
  }
  const score = source.role === 'DEVELOPMENT_SCORES' ||
    source.role === 'RESERVED_SCORE_HOLDOUT';
  if (score) {
    const expectedCoverage = source.role === 'DEVELOPMENT_SCORES' ?
      'RPL_2023_24' : 'RPL_2024_25';
    if (source.coverage !== expectedCoverage ||
        source.rightsStatus !== 'PUBLISHER_CC0_UPSTREAM_UNVERIFIED' ||
        source.sourceSha256 === null ||
        source.allowedMetrics.length !== SCORE_METRICS.length ||
        !SCORE_METRICS.every(item => source.allowedMetrics.includes(item))) {
      throw Error('Invalid development/holdout source boundary');
    }
  } else if (source.role === 'CROSS_LEAGUE_EVENTS_RESEARCH' ||
      source.role === 'CROSS_LEAGUE_INJURY_RESEARCH') {
    const injury = source.role === 'CROSS_LEAGUE_INJURY_RESEARCH';
    if (source.coverage !== 'NON_RPL_HISTORIC' ||
        !PUBLISHER_ORIGINAL.has(source.rightsStatus) ||
        (injury ?
          source.allowedMetrics.length !== 1 ||
          source.allowedMetrics[0] !== 'injury-monitoring' :
          !source.allowedMetrics.includes('shots') ||
          source.allowedMetrics.includes('injury-monitoring'))) {
      throw Error('Misclassified research dataset as current RPL reference');
    }
  } else if (source.allowedMetrics.length !== 0 ||
      source.sourceSha256 !== null ||
      PUBLISHER_ORIGINAL.has(source.rightsStatus)) {
    // Pending/manual and blocked sources cannot self-promote to
    // an original CC BY publication merely by editing metadata.
    throw Error('No original-license or metric entitlement for unapproved sources');
  }
}

/**
 * Structure/rights-boundary check. The declared license assertions are not
 * independently verified through network calls; use the cited provenance.
 */
export function inspectM1P5FreeSourcePolicy(policy) {
  if (!strictlyPlainJson(policy) || !exactKeys(policy, TOP_FIELDS) ||
      policy.schemaVersion !== M1_P5_FREE_POLICY_VERSION ||
      policy.ownerDecision !== 'FREE_ONLY' || policy.maxPaidDataCostRub !== 0 ||
      policy.paywallAllowed !== false ||
      policy.projectLicense !== 'PROPRIETARY' ||
      policy.intendedMilestone !== 'M1' ||
      policy.acceptanceState !== 'NOT_CALIBRATED' ||
      !exactKeys(policy.referenceSeparation, REFERENCE_FIELDS) ||
      policy.referenceSeparation.developmentSeason !== '2023/2024' ||
      policy.referenceSeparation.reservedHoldoutSeason !== '2024/2025' ||
      policy.referenceSeparation.holdoutKnownToResearchers !== true ||
      !Array.isArray(policy.sources) || policy.sources.length < 4 ||
      policy.sources.length > 32) throw Error('Invalid M1 free-only data policy');
  const ids = new Set();
  let dev = 0, holdout = 0;
  for (const source of policy.sources) {
    validateSource(source);
    if (ids.has(source.id)) throw Error('Duplicate reference source ID');
    ids.add(source.id);
    if (source.role === 'DEVELOPMENT_SCORES') dev++;
    if (source.role === 'RESERVED_SCORE_HOLDOUT') holdout++;
  }
  if (dev !== 1 || holdout !== 1) {
    throw Error('Development and reserved holdout must be unique');
  }
  return Object.freeze({
    schemaVersion: M1_P5_FREE_POLICY_VERSION,
    mode: 'FREE_ONLY',
    maxPaidDataCostRub: 0,
    sourcesScreened: policy.sources.length,
    provisionalScoreSources: dev,
    reservedHoldoutSources: holdout,
    producedRealRplEventCalibration: false,
    acceptedCalibration: false,
    packageThirdPartyData: false,
    m1ExitApproved: false,
  });
}

/**
 * A caller cannot upgrade source status by choosing a different purpose.
 * Even CC BY research datasets are not automatically fit for RPL realism.
 */
export function decideM1P5FreeSourcePurpose(policy, id, purpose) {
  inspectM1P5FreeSourcePolicy(policy);
  if (typeof id !== 'string' ||
      !M1_P5_PERMITTED_PURPOSES.includes(purpose)) {
    return { allowed: false, reason: 'UNKNOWN_REQUEST' };
  }
  const source = policy.sources.find(row => row.id === id);
  if (!source) return { allowed: false, reason: 'UNKNOWN_SOURCE' };
  if (purpose === 'source-metadata-review') {
    return { allowed: true, reason: 'CITATION_METADATA_ONLY_NO_RAW_IMPORT' };
  }
  if (purpose === 'provisional-rpl-score-development' &&
      source.role === 'DEVELOPMENT_SCORES') {
    return { allowed: true, reason: 'PROVISIONAL_DESCRIPTIVE_SCORE_ONLY' };
  }
  if (purpose === 'cross-league-mechanics-research' &&
      source.role === 'CROSS_LEAGUE_EVENTS_RESEARCH') {
    return { allowed: true, reason: 'ATTRIBUTED_RESEARCH_NO_RPL_TRANSFER' };
  }
  return { allowed: false, reason: source.role === 'RESERVED_SCORE_HOLDOUT' ?
    'RESERVED_HOLDOUT_NOT_FIT_DATA' :
    'UNVERIFIED_RIGHTS_OR_INCOMPARABLE_COVERAGE' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) throw Error('Usage: node scripts/m1-p5-free-source-gate.mjs');
    const url = new URL('../data/m1-p5-free-source-policy.json', import.meta.url);
    const candidate = JSON.parse(readFileSync(url, 'utf8'));
    process.stdout.write(JSON.stringify(inspectM1P5FreeSourcePolicy(candidate),
      null, 2) + '\n');
  } catch (error) {
    process.stderr.write(String(error?.message ?? error) + '\n');
    process.exitCode = 1;
  }
}

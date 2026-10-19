#!/usr/bin/env node
/**
 * One immutable Wyscout-derived, CC BY 4.0 publisher-claimed cross-league
 * sample. No person records leave this process; no RPL calibration implied.
 */
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isPlainJsonTree } from '../dist/core/plain-json-tree.js';

export const M1_P5_WYSCOUT_RESEARCH_SAMPLE = Object.freeze({
  repository: 'koenvo/wyscout-soccer-match-event-dataset',
  commit: 'ebc4c54c1093c420a81ce442c69e4186fab33bb4',
  path: 'processed/files/1694390.json',
  gitBlobSha1: 'a995bf83db3f2125811fbf16c03967bd924359eb',
  sha256: '17dc65f91cc70617bd45533dd6df9b1860397c8dc176ef506732a9af5ceaaa1b',
  matchId: 1694390,
  originalEventData: 'https://figshare.com/articles/dataset/Events/7770599',
  originalCollection: 'https://doi.org/10.6084/m9.figshare.c.4415000.v5',
  publisherLicenseClaim: 'CC BY 4.0',
});
const MAX_SAMPLE_BYTES = 1_000_000;
const RED = 1701, YELLOW = 1702, SECOND_YELLOW = 1703, GOAL = 101;
const ATTEMPTS = new Set(['Penalty', 'Free kick shot']);

function validEvent(event, expectedMatchId) {
  if (!event || typeof event !== 'object' || Array.isArray(event) ||
      !Number.isSafeInteger(event.id) || event.id < 1 ||
      event.matchId !== expectedMatchId ||
      typeof event.eventName !== 'string' || event.eventName.length < 1 ||
      typeof event.subEventName !== 'string' ||
      typeof event.matchPeriod !== 'string' ||
      !Number.isFinite(event.eventSec) || event.eventSec < 0 ||
      event.eventSec > 6000 ||
      !Array.isArray(event.tags) || event.tags.length > 24) return false;
  return event.tags.every(tag => tag !== null && typeof tag === 'object' &&
    !Array.isArray(tag) && Object.keys(tag).length === 1 &&
    Number.isSafeInteger(tag.id) && tag.id >= 0 && tag.id <= 9999);
}

/** Pure structural/event classification; not a football-law decision. */
export function inspectWyscoutEventFacts(candidate, expectedMatchId) {
  if (!isPlainJsonTree(candidate) || !candidate ||
      typeof candidate !== 'object' || Array.isArray(candidate) ||
      !Number.isSafeInteger(expectedMatchId) || expectedMatchId < 1 ||
      !Array.isArray(candidate.events) ||
      candidate.events.length < 1 || candidate.events.length > 10_000 ||
      !candidate.teams || typeof candidate.teams !== 'object' ||
      !candidate.players || typeof candidate.players !== 'object') {
    throw Error('Invalid Wyscout research sample');
  }
  const seen = new Set();
  let shots = 0, penalties = 0, directFreeKickShots = 0, goalActions = 0,
    duplicateGoalTagsOnGoalkeeperEvents = 0, allGoalTags = 0,
    yellowCards = 0, redCards = 0, secondYellowCards = 0;
  for (const event of candidate.events) {
    if (!validEvent(event, expectedMatchId) || seen.has(event.id)) {
      throw Error('Invalid or duplicate source event');
    }
    seen.add(event.id);
    const tags = new Set(event.tags.map(t => t.id));
    if (tags.size !== event.tags.length) throw Error('Repeated event tag');
    const isPenalty = event.eventName === 'Free Kick' &&
      event.subEventName === 'Penalty';
    const isFreeKickShot = event.eventName === 'Free Kick' &&
      event.subEventName === 'Free kick shot';
    const attempt = event.eventName === 'Shot' || isPenalty || isFreeKickShot;
    if (event.eventName === 'Shot') shots++;
    if (isPenalty) penalties++;
    if (isFreeKickShot) directFreeKickShots++;
    if (tags.has(GOAL)) {
      allGoalTags++;
      if (attempt) goalActions++;
      // Goalkeeper 'Save attempt' mirrors attacking-side goal tags.
      if (event.eventName === 'Save attempt') {
        duplicateGoalTagsOnGoalkeeperEvents++;
      }
    }
    if (tags.has(YELLOW)) yellowCards++;
    if (tags.has(RED)) redCards++;
    if (tags.has(SECOND_YELLOW)) secondYellowCards++;
  }
  return {
    schemaVersion: 1,
    sourceType: 'HISTORICAL_CROSS_LEAGUE_WYSCOUT_SAMPLE_ONLY',
    referenceApproved: false,
    rplCoverage: false,
    xgCoverage: 'ABSENT',
    injuryCoverage: 'ABSENT',
    observed: {
      totalEvents: candidate.events.length,
      ordinaryShotEvents: shots,
      penaltyAttemptEvents: penalties,
      directFreeKickShotEvents: directFreeKickShots,
      allAttackingAttemptEvents: shots + penalties + directFreeKickShots,
      goalTaggedAttackingEvents: goalActions,
      duplicatedGoalTagsOnGoalkeeperEvents:
        duplicateGoalTagsOnGoalkeeperEvents,
      allGoalTaggedEvents: allGoalTags,
      yellowTaggedEvents: yellowCards,
      directRedTaggedEvents: redCards,
      secondYellowTaggedEvents: secondYellowCards,
    },
  };
}

/** Immutable source SHA proves bytes, not authority or commercial rights. */
export function inspectPinnedWyscoutResearchSample(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 100 ||
      bytes.length > MAX_SAMPLE_BYTES) throw Error('Invalid source size');
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== M1_P5_WYSCOUT_RESEARCH_SAMPLE.sha256) {
    throw Error('Pinned event source SHA-256 mismatch');
  }
  const json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const parsed = inspectWyscoutEventFacts(json,
    M1_P5_WYSCOUT_RESEARCH_SAMPLE.matchId);
  const observed = parsed.observed;
  if (observed.totalEvents !== 1641 || observed.ordinaryShotEvents !== 22 ||
      observed.penaltyAttemptEvents !== 1 ||
      observed.directFreeKickShotEvents !== 0 ||
      observed.goalTaggedAttackingEvents !== 3 ||
      observed.duplicatedGoalTagsOnGoalkeeperEvents !== 3 ||
      observed.yellowTaggedEvents !== 4 ||
      observed.directRedTaggedEvents !== 0 ||
      observed.secondYellowTaggedEvents !== 0) {
    throw Error('Pinned sample observations disagree');
  }
  return {
    ...parsed,
    status: 'EXACT_SAMPLE_PINNED_NOT_RPL_CALIBRATED',
    publisherRightsStatus: 'CC_BY_CLAIM_DERIVATIVE_CHAIN_NOT_CLEARED',
    source: { repository: M1_P5_WYSCOUT_RESEARCH_SAMPLE.repository,
      commit: M1_P5_WYSCOUT_RESEARCH_SAMPLE.commit,
      path: M1_P5_WYSCOUT_RESEARCH_SAMPLE.path,
      sha256: actualHash, bytes: bytes.length },
  };
}

async function main(args) {
  if (args.length !== 1 || !args[0].startsWith('--file=') ||
      !args[0].slice('--file='.length)) {
    throw Error('Usage: node scripts/m1-p5-wyscout-open-events.mjs --file=PINNED_PRIVATE.json');
  }
  const handle = await open(args[0].slice('--file='.length), 'r');
  let bytes;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 100 || stat.size > MAX_SAMPLE_BYTES) {
      throw Error('Invalid source file size');
    }
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }
  process.stdout.write(JSON.stringify(inspectPinnedWyscoutResearchSample(bytes),
    null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(String(error?.message ?? error) + '\n');
    process.exitCode = 1;
  });
}

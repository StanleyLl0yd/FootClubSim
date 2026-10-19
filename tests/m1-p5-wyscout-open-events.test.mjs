import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWyscoutEventFacts, inspectPinnedWyscoutResearchSample,
  M1_P5_WYSCOUT_RESEARCH_SAMPLE }
  from '../scripts/m1-p5-wyscout-open-events.mjs';

const id = M1_P5_WYSCOUT_RESEARCH_SAMPLE.matchId;
const event = (eventId, eventName, subEventName, tagIds = []) => ({
  id: eventId, matchId: id, eventName, subEventName,
  matchPeriod: '1H', eventSec: eventId * 2,
  tags: tagIds.map(tagId => ({ id: tagId })),
});
const candidate = () => ({
  events: [
    event(1, 'Shot', 'Shot', [101, 1801]),
    event(2, 'Save attempt', 'Save attempt', [101, 1802]),
    event(3, 'Free Kick', 'Penalty', [101, 1801]),
    event(4, 'Save attempt', 'Reflexes', [101, 1802]),
    event(5, 'Shot', 'Shot', [101, 1801]),
    event(6, 'Save attempt', 'Reflexes', [101, 1802]),
    event(7, 'Foul', 'Foul', [1702]),
    event(8, 'Foul', 'Violent Foul', [1701]),
    event(9, 'Foul', 'Late card foul', [1703]),
    event(10, 'Free Kick', 'Free kick shot', [1801]),
  ], teams: {}, players: {},
});

test('goal tags on goalkeeper mirrors never double count attacking goals', () => {
  const data = candidate();
  const before = structuredClone(data);
  const report = inspectWyscoutEventFacts(data, id);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.sourceType,
    'HISTORICAL_CROSS_LEAGUE_WYSCOUT_SAMPLE_ONLY');
  assert.equal(report.referenceApproved, false);
  assert.equal(report.rplCoverage, false);
  assert.equal(report.xgCoverage, 'ABSENT');
  assert.equal(report.injuryCoverage, 'ABSENT');
  assert.deepEqual(report.observed, {
    totalEvents: 10,
    ordinaryShotEvents: 2,
    penaltyAttemptEvents: 1,
    directFreeKickShotEvents: 1,
    allAttackingAttemptEvents: 4,
    goalTaggedAttackingEvents: 3,
    duplicatedGoalTagsOnGoalkeeperEvents: 3,
    allGoalTaggedEvents: 6,
    yellowTaggedEvents: 1,
    directRedTaggedEvents: 1,
    secondYellowTaggedEvents: 1,
  });
  assert.deepEqual(data, before);
});

test('identical event IDs, repeated tags, or wrong match cannot be accepted', () => {
  const duplicateId = candidate();
  duplicateId.events[1].id = duplicateId.events[0].id;
  assert.throws(() => inspectWyscoutEventFacts(duplicateId, id),
    /duplicate source event/);
  const repeatedTag = candidate();
  repeatedTag.events[0].tags.push({ id: 101 });
  assert.throws(() => inspectWyscoutEventFacts(repeatedTag, id),
    /Repeated event tag/);
  const wrong = candidate();
  wrong.events[0].matchId = id + 1;
  assert.throws(() => inspectWyscoutEventFacts(wrong, id),
    /Invalid or duplicate source event/);
});

test('invalid event times, non-json sources and getter attacks fail before analysis', () => {
  const future = candidate();
  future.events[0].eventSec = Number.POSITIVE_INFINITY;
  assert.throws(() => inspectWyscoutEventFacts(future, id));
  const cycle = candidate();
  cycle.events[0].cycle = cycle;
  assert.throws(() => inspectWyscoutEventFacts(cycle, id));
  const alias = candidate();
  alias.events[1] = alias.events[0];
  assert.throws(() => inspectWyscoutEventFacts(alias, id));
  let invoked = 0;
  const getter = candidate();
  Object.defineProperty(getter.events[0], 'eventName', {
    enumerable: true, get() { invoked++; return 'Shot'; },
  });
  assert.throws(() => inspectWyscoutEventFacts(getter, id));
  assert.equal(invoked, 0);
  const hidden = candidate();
  Object.defineProperty(hidden, 'secret', { value: 'covert' });
  assert.throws(() => inspectWyscoutEventFacts(hidden, id));
  assert.throws(() => inspectWyscoutEventFacts(candidate(), 0));
});

test('no tampered sample bytes can pass the exact source hash', () => {
  assert.equal(M1_P5_WYSCOUT_RESEARCH_SAMPLE.sha256.length, 64);
  assert.equal(M1_P5_WYSCOUT_RESEARCH_SAMPLE.commit.length, 40);
  assert.equal(M1_P5_WYSCOUT_RESEARCH_SAMPLE.gitBlobSha1.length, 40);
  assert.throws(() => inspectPinnedWyscoutResearchSample(
    Buffer.from(JSON.stringify(candidate()).repeat(10))), /SHA-256 mismatch/);
  assert.throws(() => inspectPinnedWyscoutResearchSample(
    new Uint8Array(1)), /Invalid source size/);
});

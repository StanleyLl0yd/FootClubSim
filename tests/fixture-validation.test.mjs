import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { validateDoubleRoundRobin } from '../dist/core/fixture-validation.js';

test('generated calendars are complete for each even league size from 2 to 32', () => {
  for (let n = 2; n <= 32; n += 2) {
    const ids = Array.from({ length: n }, (_, i) => 'synthetic-' + i);
    assert.deepEqual(validateDoubleRoundRobin(generateDoubleRoundRobin(ids), ids), [], 'club count=' + n);
  }
});

test('detect a repeated fixture identifier and repeated ordered home-away pair', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const rounds = generateDoubleRoundRobin(ids);
  const altered = rounds.map(r => ({ ...r, fixtures: r.fixtures.map(f => ({ ...f })) }));
  altered[1].fixtures[0].id = altered[0].fixtures[0].id;
  altered[1].fixtures[0].homeClubId = altered[0].fixtures[0].homeClubId;
  altered[1].fixtures[0].awayClubId = altered[0].fixtures[0].awayClubId;
  const codes = validateDoubleRoundRobin(altered, ids).map(e => e.code);
  assert.ok(codes.includes('INVALID_FIXTURE_ID'));
  assert.ok(codes.includes('DUPLICATE_HOME_AWAY_PAIR'));
});

test('detect match against self and missing round participant', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const rounds = generateDoubleRoundRobin(ids);
  const altered = rounds.map(r => ({ ...r, fixtures: r.fixtures.map(f => ({ ...f })) }));
  altered[0].fixtures[0].awayClubId = altered[0].fixtures[0].homeClubId;
  const codes = validateDoubleRoundRobin(altered, ids).map(e => e.code);
  assert.ok(codes.includes('INVALID_OPPONENTS'));
  assert.ok(codes.includes('MISSING_ROUND_PARTICIPANT'));
});

test('detect incomplete rounds, unknown clubs and duplicate round appearances', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const rounds = generateDoubleRoundRobin(ids);
  assert.ok(validateDoubleRoundRobin(rounds.slice(1), ids).some(e => e.code === 'INVALID_ROUND_COUNT'));
  assert.ok(validateDoubleRoundRobin(rounds, ['a', 'a', 'c', 'd']).some(e => e.code === 'INVALID_CLUBS'));
  const altered = rounds.map(r => ({ ...r, fixtures: r.fixtures.map(f => ({ ...f })) }));
  altered[0].fixtures[0].homeClubId = 'not-a-club';
  assert.ok(validateDoubleRoundRobin(altered, ids).some(e => e.code === 'INVALID_OPPONENTS'));
});

test('round and fixture numbering must be consistent', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const rounds = generateDoubleRoundRobin(ids);
  const renumber = rounds.map(r => ({ ...r, fixtures: r.fixtures.map(f => ({ ...f })) }));
  renumber[0].number = 2;
  assert.ok(validateDoubleRoundRobin(renumber, ids).some(e => e.code === 'INVALID_ROUND'));
  const wrongFixture = rounds.map(r => ({ ...r, fixtures: r.fixtures.map(f => ({ ...f })) }));
  wrongFixture[0].fixtures[0].round = 3;
  assert.ok(validateDoubleRoundRobin(wrongFixture, ids).some(e => e.code === 'INVALID_FIXTURE_ID'));
});

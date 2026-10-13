import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';

test('16 fictional clubs play 30 rounds of 8 matches', () => {
  const ids = Array.from({ length: 16 }, (_, i) => 'fictional-' + i);
  const rounds = generateDoubleRoundRobin(ids);
  assert.equal(rounds.length, 30);
  const matches = rounds.flatMap((r, index) => {
    assert.equal(r.number, index + 1);
    assert.equal(r.fixtures.length, 8);
    assert.equal(new Set(r.fixtures.flatMap(f => [f.homeClubId, f.awayClubId])).size, 16);
    return r.fixtures;
  });
  assert.equal(matches.length, 240);
  assert.equal(new Set(matches.map(f => f.id)).size, 240);
  for (const home of ids) {
    assert.equal(matches.filter(f => f.homeClubId === home).length, 15);
    assert.equal(matches.filter(f => f.awayClubId === home).length, 15);
    for (const away of ids.filter(id => id !== home)) {
      assert.equal(matches.filter(f => f.homeClubId === home && f.awayClubId === away).length, 1);
      assert.equal(matches.filter(f => f.homeClubId === away && f.awayClubId === home).length, 1);
    }
  }
});
test('invalid or duplicate clubs cannot generate fixtures', () => {
  for (const clubs of [['a'], ['a', 'a'], ['a', 'b', 'c']]) {
    assert.throws(() => generateDoubleRoundRobin(clubs), RangeError);
  }
});
test('two clubs play opposite home and away games', () => {
  assert.deepEqual(
    generateDoubleRoundRobin(['a', 'b']).flatMap(r => r.fixtures.map(f => [f.homeClubId, f.awayClubId])),
    [['a', 'b'], ['b', 'a']],
  );
});

test('sparse club arrays must never generate fixtures with undefined participants', () => {
  const withHole = [, 'a'];
  assert.equal(withHole.length, 2);
  assert.throws(() => generateDoubleRoundRobin(withHole), RangeError);
  const sparseFour = ['a', 'b', , 'd'];
  assert.throws(() => generateDoubleRoundRobin(sparseFour), RangeError);
});

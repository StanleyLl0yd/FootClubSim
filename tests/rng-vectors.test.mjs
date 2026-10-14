import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';

// Independently derived with 32-bit masked unsigned XOR/shift arithmetic.
// These fixed vectors must not be silently rewritten after a code change.
const vectors = [
  [1, [270369, 67634689, 2647435461, 307599695, 2398689233, 745495504, 632435482, 435756210]],
  [42, [11355432, 2836018348, 476557059, 3648046016, 3759983556, 1441438134, 3713466840, 2431644334]],
  [0xffffffff, [253983, 4228382207, 1958451267, 4056713434, 2049502865, 2560970988, 1705115568, 279806459]],
  [0x12345678, [2274908837, 358294691, 1210119364, 2176035992, 1882851208, 698933837, 2311737117, 3306712617]],
];

test('xorshift32 v1 is pinned by exact unsigned output vectors', () => {
  assert.equal(RNG_VERSION, 'xorshift32-v1');
  for (const [seed, expected] of vectors) {
    const rng = new SeededRng(seed);
    assert.deepEqual(expected.map(() => rng.nextUint32()), expected, 'seed=' + seed);
    assert.equal(rng.snapshot(), expected.at(-1));
  }
});

test('snapshot restores the same continuation at every vector boundary', () => {
  for (const [seed, expected] of vectors) {
    const rng = new SeededRng(seed);
    for (let index = 0; index < expected.length - 1; index++) {
      assert.equal(rng.nextUint32(), expected[index], 'seed=' + seed + ', index=' + index);
      const snapshot = rng.snapshot();
      const restored = new SeededRng(snapshot);
      assert.equal(restored.nextUint32(), expected[index + 1]);
    }
  }
});

test('nextFloat uses an exclusive upper bound and exactly one integer draw', () => {
  for (const [seed, expected] of vectors) {
    const rng = new SeededRng(seed);
    const value = rng.nextFloat();
    assert.equal(value, expected[0] / 0x100000000);
    assert.ok(value >= 0 && value < 1);
    assert.equal(rng.snapshot(), expected[0]);
    assert.equal(rng.nextUint32(), expected[1]);
  }
});

test('invalid continuation state and seeds cannot reset or alias to zero', () => {
  for (const seed of [0, -1, 0x100000000, -Infinity, Infinity, NaN, 1.5, null, '42']) {
    assert.throws(() => new SeededRng(seed), RangeError, 'seed=' + String(seed));
  }
});

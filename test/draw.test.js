import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draw, isValid } from '../src/draw.js';

const ids = (n) => Array.from({ length: n }, (_, i) => String(i + 1));

test('rejects fewer than 3 participants', () => {
  assert.throws(() => draw(ids(2)));
});

test('everyone gives once and receives once, no self and no mutual pairs', () => {
  for (let n = 3; n <= 30; n++) {
    for (let run = 0; run < 200; run++) {
      const people = ids(n);
      const pairs = draw(people);
      assert.equal(pairs.size, n);
      assert.deepEqual([...pairs.keys()].sort(), [...people].sort());
      assert.deepEqual([...pairs.values()].sort(), [...people].sort());
      for (const [giver, receiver] of pairs) {
        assert.notEqual(giver, receiver, 'self-gift');
        assert.notEqual(pairs.get(receiver), giver, `mutual pair ${giver}<->${receiver}`);
      }
    }
  }
});

test('isValid detects self-gift and mutual pair', () => {
  assert.equal(isValid(new Map([['1', '1'], ['2', '3'], ['3', '2']])), false);
  assert.equal(isValid(new Map([['1', '2'], ['2', '1'], ['3', '4'], ['4', '5'], ['5', '3']])), false);
  assert.equal(isValid(new Map([['1', '2'], ['2', '3'], ['3', '1']])), true);
});

test('with 4 players all 6 valid assignments occur (only 4-cycles, 2+2 is forbidden)', () => {
  // For n=4 valid assignments are exactly the 6 four-cycles; check all of them show up.
  const seen = new Set();
  for (let run = 0; run < 2000; run++) {
    seen.add(JSON.stringify([...draw(ids(4))]));
  }
  assert.equal(seen.size, 6);
});

test('falls back to a single cycle when random always yields invalid permutations', () => {
  // random() = 0.999... makes shuffle an identity permutation -> always self-gifts.
  const pairs = draw(ids(5), () => 0.9999);
  assert.equal(isValid(pairs), true);
});

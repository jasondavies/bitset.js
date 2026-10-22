import {describe, test} from "node:test";
import assert from "node:assert/strict";
import {BitSet} from "../bitset.js";

describe("constructor", () => {
  test("allocates one word per 32 bits", () => {
    for (const [length, words] of [[0, 0], [1, 1], [31, 1], [32, 1], [33, 2], [100, 4]]) {
      const set = new BitSet(length);
      assert.equal(set.length, length);
      assert.equal(set.words.length, words);
      assert.equal(set.size, 0);
    }
  });

  test("normalises a length of -0", () => {
    assert.ok(Object.is(new BitSet(-0).length, 0));
  });

  test("rejects invalid lengths", () => {
    for (const length of [-1, 1.5, NaN, Infinity, 2 ** 32 + 1, "10", undefined]) {
      assert.throws(() => new BitSet(length), RangeError);
    }
  });
});

describe("add, has and delete", () => {
  const indices = [0, 1, 30, 31, 32, 33, 63, 64, 95, 96, 127, 199];

  test("work at word boundaries", () => {
    const set = new BitSet(200);
    for (const i of indices) assert.equal(set.add(i), set);
    for (let i = 0; i < 200; i++) assert.equal(set.has(i), indices.includes(i));
    assert.equal(set.size, indices.length);
    for (const i of indices) {
      assert.equal(set.delete(i), true);
      assert.equal(set.delete(i), false);
      assert.equal(set.has(i), false);
    }
    assert.equal(set.size, 0);
  });

  test("reject indices outside the set", () => {
    const set = new BitSet(100);
    for (const i of [-1, 100, 128, 1.5, NaN, "1", undefined]) {
      assert.throws(() => set.add(i), RangeError);
      assert.equal(set.has(i), false);
      assert.equal(set.delete(i), false);
    }
    assert.deepEqual(Array.from(set.words), [0, 0, 0, 0]);
  });

  test("allow the last index", () => {
    const set = new BitSet(100).add(99);
    assert.equal(set.has(99), true);
    assert.deepEqual([...set], [99]);
  });
});

test("clear", () => {
  const set = new BitSet(100).add(1).add(99);
  set.clear();
  assert.equal(set.size, 0);
  assert.deepEqual([...set], []);
});

describe("iteration", () => {
  test("visits every index in ascending order", () => {
    const set = new BitSet(200),
        expected = [];
    for (let i = 0; i < 200; i++) {
      set.add(i);
      expected.push(i);
    }
    const found = [];
    set.forEach(i => found.push(i));
    assert.deepEqual(found, expected);
    assert.deepEqual([...set], expected);
    assert.deepEqual([...set.values()], expected);
    assert.equal(set.size, 200);
  });

  test("handles empty sets", () => {
    assert.deepEqual([...new BitSet(0)], []);
    assert.deepEqual([...new BitSet(100)], []);
    const it = new BitSet(100).add(5).values();
    assert.deepEqual(it.next(), {value: 5, done: false});
    assert.deepEqual(it.next(), {value: undefined, done: true});
    assert.deepEqual(it.next(), {value: undefined, done: true});
  });

  test("handles indices of 2^31 and above", () => {
    const indices = [0, 2 ** 31 - 1, 2 ** 31, 2 ** 31 + 31],
        set = new BitSet(2 ** 31 + 32);
    for (const i of indices) set.add(i);
    const found = [];
    set.forEach(i => found.push(i));
    assert.deepEqual(found, indices);
    assert.deepEqual([...set], indices);
    assert.equal(set.has(2 ** 31 + 31), true);
    assert.equal(set.size, indices.length);
  });

  test("matches a Set of random indices", () => {
    const set = new BitSet(1000),
        expected = new Set(randomIndices(1000, 300));
    for (const i of expected) set.add(i);
    assert.deepEqual([...set], [...expected].sort((a, b) => a - b));
    assert.equal(set.size, expected.size);
  });
});

test("clone", () => {
  const set = new BitSet(100).add(1).add(99),
      copy = set.clone();
  assert.notEqual(copy, set);
  assert.notEqual(copy.words, set.words);
  assert.equal(copy.length, 100);
  assert.deepEqual([...copy], [1, 99]);
  copy.add(50);
  set.delete(1);
  assert.deepEqual([...copy], [1, 50, 99]);
  assert.deepEqual([...set], [99]);
  assert.deepEqual([...new BitSet(0).clone()], []);
});

describe("and, or, xor and andNot", () => {
  const length = 1000,
      a = randomIndices(length, 400),
      b = randomIndices(length, 400);

  test("and keeps indices in both sets", () => {
    const set = fromIndices(length, a),
        other = fromIndices(length, b);
    assert.equal(set.and(other), set);
    assert.deepEqual([...set], sorted(a.filter(i => b.includes(i))));
    assert.deepEqual([...other], sorted(b));
  });

  test("or keeps indices in either set", () => {
    const set = fromIndices(length, a),
        other = fromIndices(length, b);
    assert.equal(set.or(other), set);
    assert.deepEqual([...set], sorted(a.concat(b)));
    assert.deepEqual([...other], sorted(b));
  });

  test("xor keeps indices in exactly one set", () => {
    const set = fromIndices(length, a),
        other = fromIndices(length, b);
    assert.equal(set.xor(other), set);
    assert.deepEqual([...set], sorted(a.concat(b).filter(i => a.includes(i) !== b.includes(i))));
    assert.deepEqual([...other], sorted(b));
  });

  test("andNot keeps indices not in other", () => {
    const set = fromIndices(length, a),
        other = fromIndices(length, b);
    assert.equal(set.andNot(other), set);
    assert.deepEqual([...set], sorted(a.filter(i => !b.includes(i))));
    assert.deepEqual([...other], sorted(b));
  });

  test("handle a set combined with itself", () => {
    assert.deepEqual([...fromIndices(length, a).and(fromIndices(length, a))], sorted(a));
    const set = fromIndices(length, a);
    assert.deepEqual([...set.xor(set)], []);
    const set2 = fromIndices(length, a);
    assert.deepEqual([...set2.andNot(set2)], []);
  });

  test("keep bits beyond length clear", () => {
    // 100 bits leave 28 unused bits in the last word.
    const set = new BitSet(100).add(99),
        full = new BitSet(100);
    for (let i = 0; i < 100; i++) full.add(i);
    set.xor(full);
    assert.equal(set.size, 99);
    assert.equal(set.words[3] >>> 4, 0);
  });

  test("reject sets of different lengths", () => {
    for (const op of ["and", "or", "xor", "andNot"]) {
      assert.throws(() => new BitSet(64)[op](new BitSet(65)), RangeError);
      assert.throws(() => new BitSet(64)[op](new BitSet(32)), RangeError);
      assert.throws(() => new BitSet(64)[op]({length: 64, words: new Uint32Array(2)}), TypeError);
    }
  });
});

function fromIndices(length, indices) {
  const set = new BitSet(length);
  for (const i of indices) set.add(i);
  return set;
}

function sorted(indices) {
  return [...new Set(indices)].sort((a, b) => a - b);
}

// Returns n pseudorandom indices below length, from a fixed seed.
function randomIndices(length, n) {
  let seed = n;
  const indices = [];
  for (let i = 0; i < n; i++) {
    seed = Math.imul(seed ^ seed >>> 15, 0x2c1b3c6d) + 0x6d2b79f5 | 0;
    indices.push((seed >>> 0) % length);
  }
  return indices;
}

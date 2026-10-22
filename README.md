bitset.js
=========

Fast fixed-length bit sets for JavaScript. A `BitSet` holds integers from 0 to
`length - 1`, one bit each, in a `Uint32Array`. The API is similar to `Set`'s,
and TypeScript types are included. This is an ES module; use `import`, not
`require`.

```js
import {BitSet} from "@jasondavies/bitset";

const set = new BitSet(100);
set.add(2).add(20).add(99);
set.has(20); // true
set.size; // 3
[...set]; // [2, 20, 99]

const other = new BitSet(100).add(20).add(50);
set.clone().and(other); // {20}
set.clone().or(other); // {2, 20, 50, 99}
set.clone().xor(other); // {2, 50, 99}
set.andNot(other); // set is now {2, 99}
```

## API

### `new BitSet(length)`

An empty set that can hold integers from 0 to `length - 1`. `length` must be
an integer from 0 to 2<sup>32</sup>, otherwise a `RangeError` is thrown. The
length is fixed: a set uses `length / 8` bytes, rounded up to a multiple of 4.

* `set.length` is the number of integers the set can hold.
* `set.size` is the number of integers in the set. It is counted on each
  access, so it takes time proportional to `length`.
* `set.has(i)` returns whether `i` is in the set.
* `set.add(i)` adds `i` and returns the set. It throws a `RangeError` unless
  `i` is an integer from 0 to `length - 1`.
* `set.delete(i)` removes `i`, returning whether it was present.

  Indices should be numbers: `has`, `add` and `delete` throw a `TypeError`
  for a BigInt or Symbol.
* `set.clear()` removes all integers.
* `set.forEach(f)` calls `f(i)` for each integer in ascending order.
* `set.values()` returns an iterator over the integers in ascending order.
  Sets are also iterable.
* `set.clone()` returns a new set with the same length and integers.
* `set.and(other)` removes integers that are not in `other`.
* `set.or(other)` adds the integers in `other`.
* `set.xor(other)` adds the integers in `other` that are not in `set`, and
  removes those that are.
* `set.andNot(other)` removes the integers in `other`.

  These four change `set` in place and return it; use `set.clone()` first to
  keep the original. `other` must be a `BitSet`, otherwise a `TypeError` is
  thrown, and must have the same length, otherwise a `RangeError` is thrown.
* `set.words` is the live `Uint32Array` of bits. Bit `i` is stored in word
  `i >>> 5` with mask `1 << (i & 31)`. Bits at or beyond `length` must stay
  clear.

Don't modify a set while iterating over it.

Unlike `Set`, `forEach` passes only the integer to `f`, there are no `keys`
or `entries` methods, and iterators don't have helper methods such as
`toArray`.

## Development

* `npm test` runs the tests.
* `npm run bench` compares `BitSet` with
  [TypedFastBitSet](https://github.com/lemire/TypedFastBitSet.js) and `Set`.
  Use `npm run bench -- 1e7 0.01,0.5 bitset,typedfastbitset` to choose the
  length, densities and structures.

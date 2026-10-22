/**
 * A set of integers from 0 to length - 1, stored as a fixed-length bit vector.
 */
export class BitSet implements Iterable<number> {
  /**
   * Creates an empty set that can hold integers from 0 to length - 1. Throws
   * RangeError unless length is an integer from 0 to 2^32.
   */
  constructor(length: number);
  /** The number of integers the set can hold. */
  readonly length: number;
  /**
   * The live bit vector. Bit i is stored in word i >>> 5 with mask
   * 1 << (i & 31). Bits at or beyond length must stay clear.
   */
  readonly words: Uint32Array;
  /** The number of integers in the set, counted on each access. */
  readonly size: number;
  /** Returns whether i is in the set. */
  has(i: number): boolean;
  /**
   * Adds i, returning this set. Throws RangeError unless i is an integer from
   * 0 to length - 1.
   */
  add(i: number): this;
  /** Removes i, returning whether it was present. */
  delete(i: number): boolean;
  /** Removes all integers. */
  clear(): void;
  /** Calls f(i) for each integer in the set, in ascending order. */
  forEach(f: (i: number) => void): void;
  /** Returns an iterator over the integers in the set, in ascending order. */
  values(): IterableIterator<number>;
  [Symbol.iterator](): IterableIterator<number>;
  /**
   * Removes integers that are not in other, returning this set. Throws
   * TypeError if other is not a BitSet, or RangeError if the lengths differ.
   */
  and(other: BitSet): this;
  /**
   * Adds the integers in other, returning this set. Throws TypeError if other
   * is not a BitSet, or RangeError if the lengths differ.
   */
  or(other: BitSet): this;
  /**
   * Adds the integers in other that are not in this set, and removes those
   * that are, returning this set. Throws TypeError if other is not a BitSet,
   * or RangeError if the lengths differ.
   */
  xor(other: BitSet): this;
  /**
   * Removes the integers in other, returning this set. Throws TypeError if
   * other is not a BitSet, or RangeError if the lengths differ.
   */
  andNot(other: BitSet): this;
  /** Returns a new set with the same length and integers. */
  clone(): BitSet;
}

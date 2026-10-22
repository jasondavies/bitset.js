// Bit sets for JavaScript by Jason Davies, https://www.jasondavies.com/
// See LICENSE for licensing details.

const maxLength = 2 ** 32;

// A set of integers from 0 to length - 1, stored as a fixed-length bit vector.
export class BitSet {
  // Creates an empty set that can hold integers from 0 to length - 1.
  constructor(length) {
    if (!Number.isInteger(length) || length < 0 || length > maxLength) {
      throw new RangeError("length must be an integer from 0 to 2^32");
    }
    this._length = length + 0; // Normalise -0.
    // Bit i is stored in word i >>> 5 with mask 1 << (i & 31). Bits at or
    // beyond length are always clear.
    this.words = new Uint32Array(Math.ceil(length / 32));
  }

  get length() {
    return this._length;
  }

  // Returns the number of integers in the set, counting the bits in every word.
  get size() {
    const words = this.words;
    let n = 0;
    for (let i = 0; i < words.length; i++) n += popcount(words[i]);
    return n;
  }

  has(i) {
    // Skip the length check: bits at or beyond length are clear, and words
    // past the end of the array read as undefined.
    return i >>> 0 === i && (this.words[i >>> 5] & 1 << i) !== 0;
  }

  // Adds i, returning this set.
  add(i) {
    // i >>> 0 equals i only for integers from 0 to 2^32 - 1.
    if (i >>> 0 !== i || i >= this._length) outOfRange();
    this.words[i >>> 5] |= 1 << i;
    return this;
  }

  // Removes i, returning whether it was present.
  delete(i) {
    if (i >>> 0 !== i || i >= this._length) return false;
    const words = this.words,
        j = i >>> 5,
        mask = 1 << i,
        w = words[j];
    words[j] = w & ~mask;
    return (w & mask) !== 0;
  }

  clear() {
    this.words.fill(0);
  }

  // Calls f(i) for each integer in the set, in ascending order.
  forEach(f) {
    const words = this.words;
    for (let j = 0, offset = 0; j < words.length; j++, offset += 32) {
      // Visit set bits from lowest to highest, clearing each in turn. Based on
      // https://lemire.me/blog/2012/05/21/fast-bitmap-decoding/
      for (let w = words[j] | 0; w !== 0; w &= w - 1) {
        f(offset + 31 - Math.clz32(w & -w));
      }
    }
  }

  // Returns an iterator over the integers in the set, in ascending order.
  values() {
    return new BitSetIterator(this.words);
  }

  [Symbol.iterator]() {
    return this.values();
  }

  // Removes integers that are not in other, returning this set.
  and(other) {
    const a = this.words,
        b = otherWords(this, other);
    const n = a.length;
    let i = 0;
    for (; i + 3 < n; i += 4) {
      a[i] &= b[i];
      a[i + 1] &= b[i + 1];
      a[i + 2] &= b[i + 2];
      a[i + 3] &= b[i + 3];
    }
    for (; i < n; i++) a[i] &= b[i];
    return this;
  }

  // Adds the integers in other, returning this set.
  or(other) {
    const a = this.words,
        b = otherWords(this, other);
    const n = a.length;
    let i = 0;
    for (; i + 3 < n; i += 4) {
      a[i] |= b[i];
      a[i + 1] |= b[i + 1];
      a[i + 2] |= b[i + 2];
      a[i + 3] |= b[i + 3];
    }
    for (; i < n; i++) a[i] |= b[i];
    return this;
  }

  // Adds the integers in other that are not in this set, and removes those
  // that are, returning this set.
  xor(other) {
    const a = this.words,
        b = otherWords(this, other);
    const n = a.length;
    let i = 0;
    for (; i + 3 < n; i += 4) {
      a[i] ^= b[i];
      a[i + 1] ^= b[i + 1];
      a[i + 2] ^= b[i + 2];
      a[i + 3] ^= b[i + 3];
    }
    for (; i < n; i++) a[i] ^= b[i];
    return this;
  }

  // Removes the integers in other, returning this set.
  andNot(other) {
    const a = this.words,
        b = otherWords(this, other);
    const n = a.length;
    let i = 0;
    for (; i + 3 < n; i += 4) {
      a[i] &= ~b[i];
      a[i + 1] &= ~b[i + 1];
      a[i + 2] &= ~b[i + 2];
      a[i + 3] &= ~b[i + 3];
    }
    for (; i < n; i++) a[i] &= ~b[i];
    return this;
  }

  // Returns a new set with the same length and integers.
  clone() {
    const set = new BitSet(this._length);
    set.words.set(this.words);
    return set;
  }
}

// Iterates over set bits without a generator, which V8 optimises poorly.
class BitSetIterator {
  constructor(words) {
    this._words = words;
    this._j = 0;
    this._w = words.length ? words[0] | 0 : 0;
  }

  next() {
    const words = this._words;
    let w = this._w,
        j = this._j;
    while (w === 0) {
      if (++j >= words.length) {
        this._j = j;
        return {value: undefined, done: true};
      }
      w = words[j] | 0;
    }
    this._w = w & w - 1;
    this._j = j;
    return {value: j * 32 + 31 - Math.clz32(w & -w), done: false};
  }

  [Symbol.iterator]() {
    return this;
  }
}

// Throwing in a separate function keeps add small enough to inline.
function outOfRange() {
  throw new RangeError("index must be an integer from 0 to length - 1");
}

function otherWords(set, other) {
  if (!(other instanceof BitSet)) throw new TypeError("expected a BitSet");
  if (other._length !== set._length) throw new RangeError("bit sets must have the same length");
  return other.words;
}

// Counts the set bits in a 32-bit word.
function popcount(x) {
  x -= x >>> 1 & 0x55555555;
  x = (x & 0x33333333) + (x >>> 2 & 0x33333333);
  x = x + (x >>> 4) & 0x0f0f0f0f;
  return Math.imul(x, 0x01010101) >>> 24;
}

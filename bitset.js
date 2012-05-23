// Copyright (c) 2012, Jason Davies, http://www.jasondavies.com/
// See LICENSE for details.
(function(exports) {

exports.BitSet = BitSet;

function BitSet(n) {
  // TODO use NPOT
  this.words = wordArray((n >> 5) + 1);
}

BitSet.prototype.set = function(i) {
  this.words[i >> 5] |= 1 << (i & 0x1f);
};

// Based on code by Daniel Lemire,
// http://lemire.me/blog/archives/2012/05/21/fast-bitmap-decoding/
BitSet.prototype.read = function(f) {
  var words = this.words,
      n = words.length;
  for (var i = 0, off = 0, k = 0; i < n; i++, off += 32) {
    var w = words[i];
    while (w !== 0) {
      var ntz = trailingZeroes(w);
      w ^= 1 << ntz;
      f(off + ntz, k++);
    }
  }
};

BitSet.prototype.and = function() {
};

BitSet.prototype.or = function() {
};

function wordArray(n) {
  return new Uint32Array(n);
}

function trailingZeroes(x) {
  return ones((x & -x) - 1);
}

function ones(x) {
  // 32-bit recursive reduction using SWAR...
  // but first step is mapping 2-bit values
  // into sum of 2 1-bit values in sneaky way
  x -= (x >> 1) & 0x55555555;
  x = ((x >> 2) & 0x33333333) + (x & 0x33333333);
  x = ((x >> 4) + x) & 0x0f0f0f0f;
  x += x >> 8;
  x += x >> 16;
  return x & 0x0000003f;
}
})(this);

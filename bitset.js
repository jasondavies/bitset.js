// Copyright (c) 2012, Jason Davies, http://www.jasondavies.com/
// See LICENSE for details.
//
// EWAH code based on JavaEWAH, https://github.com/lemire/javaewah
// Copyright 2009-2012, Daniel Lemire, Cliff Moon, David McIntosh and Robert
// Becho. Licensed under APL 2.0.
// See lib/javaewah/LICENSE for details.
(function(exports) {

exports.BitSet = BitSet;

var WORDINBITS = 32;
// number of bits dedicated to marking  of the running length of clean words.
var runninglengthbits = 16;
var literalbits = 32 - 1 - runninglengthbits;
// largest number of dirty words in a run.
var largestliteralcount = (1 << literalbits) - 1;
// largest number of clean words in a run.
var largestrunninglengthcount = (1 << runninglengthbits) - 1;
var shiftedlargestrunninglengthcount = largestrunninglengthcount << 1;
var notshiftedlargestrunninglengthcount = ~shiftedlargestrunninglengthcount;
var runninglengthplusrunningbit = (1 << runninglengthbits + 1) - 1;
var notrunninglengthplusrunningbit = ~runninglengthplusrunningbit;

function BitSet(n) {
  if (!arguments.length) n = 1;
  this.buffer = intArray(n);
  this.rlw = new RLW(this.buffer, 0);
  this.actualsizeinwords = 1;
  this.sizeinbits = 0;
}

BitSet.prototype.set = function(i) {
  var s = this.sizeinbits;
  if (i < s) return false;
  // distance in words:
  var dist = (i + WORDINBITS >> 5) - (s + WORDINBITS - 1 >> 5);
  this.sizeinbits = i + 1;
  if (dist > 0) { // easy
    if (dist > 1) this.addStreamOfEmptyWords(false, dist - 1);
    addLiteralWord.call(this, 1 << (i & 0x1f));
    return true;
  }
  if (this.rlw.getNumberOfLiteralWords() == 0) {
    this.rlw.setRunningLength(this.rlw.getRunningLength() - 1);
    addLiteralWord.call(this, 1 << (i & 0x1f));
    return true;
  }
  this.buffer[this.actualsizeinwords - 1] |= 1 << (i & 0x1f);
  if (this.buffer[this.actualsizeinwords - 1] == ~0) {
    this.buffer[this.actualsizeinwords - 1] = 0;
    --this.actualsizeinwords;
    this.rlw.setNumberOfLiteralWords(this.rlw.getNumberOfLiteralWords() - 1);
    // next we add one clean word
    addEmptyWord.call(this, true);
  }
  return true;
};

BitSet.prototype.add = function(d, significantBits) {
  this.sizeinbits += significantBits || WORDINBITS;
  if (d == 0) addEmptyWord.call(this, false);
  else if (d == ~0) addEmptyWord.call(this, true);
  else addLiteralWord.call(this, d);
};

BitSet.prototype.addStreamOfEmptyWords = function(v, number) {
  var rlw = this.rlw,
      rb = rlw.getRunningBit();
  if (rb != v && rlw.size() == 0) {
    rlw.setRunningBit(v);
  } else if (rlw.getNumberOfLiteralWords() != 0 || rb != v) {
    push_back(this, 0);
    rlw.position = this.actualsizeinwords - 1;
    if (v) rlw.setRunningBit(v);
  }
  var runlen = rlw.getRunningLength();
  var whatwecanadd = Math.min(number, largestrunninglengthcount - runlen);
  rlw.setRunningLength(runlen + whatwecanadd);
  number -= whatwecanadd;
  while (number >= largestrunninglengthcount) {
    push_back(this, 0);
    rlw.position = this.actualsizeinwords - 1;
    if (v) rlw.setRunningBit(v);
    rlw.setRunningLength(largestrunninglengthcount);
    number -= largestrunninglengthcount;
  }
  if (number > 0) {
    push_back(this, 0);
    rlw.position = this.actualsizeinwords - 1;
    if (v) rlw.setRunningBit(v);
    rlw.setRunningLength(number);
  }
};

BitSet.prototype.addStreamOfDirtyWords = function(data, start, number, negate) {
  if (number == 0) return;
  var NumberOfLiteralWords = this.rlw.getNumberOfLiteralWords();
  var whatwecanadd = number < largestliteralcount - NumberOfLiteralWords ? number : largestliteralcount - NumberOfLiteralWords;
  this.rlw.setNumberOfLiteralWords(NumberOfLiteralWords + whatwecanadd);
  var leftovernumber = number - whatwecanadd;
  push_back_many.call(this, data, start, whatwecanadd, negate);
  this.sizeinbits += whatwecanadd << 5;
  if (leftovernumber > 0) {
    push_back(this, 0);
    this.rlw.position = this.actualsizeinwords - 1;
    this.addStreamOfDirtyWords(data, start + whatwecanadd, leftovernumber);
  }
};

BitSet.prototype.cardinality = function() {
  var counter = 0;
  var i = new Iterator(this.buffer, this.actualsizeinwords);
  while (i.hasNext()) {
    var localrlw = i.next();
    if (localrlw.getRunningBit()) counter += localrlw.getRunningLength() << 5;
    for (var a = i.rlw.array, j = i.dirtyWords(), n = j + localrlw.getNumberOfLiteralWords(); j < n; ++j) {
      counter += bits(a[j]);
    }
  }
  return counter;
}

BitSet.prototype.or = operation(function(a, b) { return a | b; });
BitSet.prototype.xor = operation(function(a, b) { return a ^ b; });
BitSet.prototype.and = operation(function(a, b) { return a & b; });
BitSet.prototype.andNot = operation(function(a, b) { return a & ~b; });

BitSet.prototype.orCardinality = cardinality(function(a, b) { return a | b; });
BitSet.prototype.xorCardinality = cardinality(function(a, b) { return a ^ b; });
BitSet.prototype.andCardinality = cardinality(function(a, b) { return a & b; });
BitSet.prototype.andNotCardinality = cardinality(function(a, b) { return a & ~b; });

function cardinality(op) {
  return function(a) {
    var container = new BitCounter;
    operation0.call(this, a, container, op);
    return container.n;
  };
}

function operation(op) {
  return function(a) {
    var container = new BitSet;
    reserve.call(container, Math.max(this.actualsizeinwords, a.actualsizeinwords));
    operation0.call(this, a, container, op);
    return container;
  };
};

function operation0(a, container, op) {
  // hack to detect andNot
  var andnot = op(1, 0) && !op(1, 1) && !op(0, 1) && !op(0, 0);
  var i = new Iterator(a.buffer, a.actualsizeinwords);
  var j = new Iterator(this.buffer, this.actualsizeinwords);
  if (!(i.hasNext() && j.hasNext())) {// this never happens...
    container.setSizeInBits(this.sizeinbits);
  }
  // at this point, this is safe:
  var rlwi = new BufferedRLW(i.next());
  if (andnot) rlwi.RunningBit = !rlwi.RunningBit;
  var rlwj = new BufferedRLW(j.next());
  while (true) {
    var i_is_prey = rlwi.size() < rlwj.size();
    var prey = i_is_prey ? rlwi : rlwj;
    var predator = i_is_prey ? rlwj : rlwi;

    if (andnot ? prey.RunningBit : op(0, prey.RunningBit) ^ op(1, prey.RunningBit)) {
      // we have a stream of 1x11
      var predatorrl = predator.RunningLength;
      var preyrl = prey.RunningLength;
      var tobediscarded = Math.min(preyrl, predatorrl);
      container.addStreamOfEmptyWords(predator.RunningBit, tobediscarded);
      var dw_predator = predator.dirtywordoffset + (i_is_prey ? j.dirtyWords() : i.dirtyWords());
      var data = i_is_prey ? j.rlw.array : i.rlw.array;
      container.addStreamOfDirtyWords(data, dw_predator, preyrl - tobediscarded, andnot && !i_is_prey);
      predator.discardFirstWords(preyrl);
    } else {
      container.addStreamOfEmptyWords(prey.RunningBit, prey.RunningLength);
      predator.discardFirstWords(prey.RunningLength);
    }
    prey.RunningLength = 0;

    var predatorrl = predator.RunningLength;
    if (predatorrl > 0) {
      var nbre_dirty_prey = prey.NumberOfLiteralWords;
      var tobediscarded = Math.min(nbre_dirty_prey, predatorrl);
      if (andnot ? predator.RunningBit : op(predator.RunningBit, 0) ^ op(predator.RunningBit, 1)) {
        var dw_prey = prey.dirtywordoffset + (i_is_prey ? i.dirtyWords() : j.dirtyWords());
        var data = i_is_prey ? i.rlw.array : j.rlw.array;
        container.addStreamOfDirtyWords(data, dw_prey, tobediscarded, andnot && i_is_prey);
        predator.discardFirstWords(tobediscarded);
        prey.discardFirstWords(tobediscarded);
      } else {
        predator.discardFirstWords(tobediscarded);
        prey.discardFirstWords(tobediscarded);
        container.addStreamOfEmptyWords(predator.RunningBit, tobediscarded);
      }
    }
    // all that is left to do now is to AND the dirty words
    var nbre_dirty_prey = prey.NumberOfLiteralWords;
    if (nbre_dirty_prey > 0) {
      var ip = predator,
          jp = prey;
      if (i_is_prey) {
        ip = prey;
        jp = predator;
      }
      var joff = jp.dirtywordoffset + j.dirtyWords(),
          ioff = ip.dirtywordoffset + i.dirtyWords();
      for (var k = 0; k < nbre_dirty_prey; ++k) {
        container.add(op(j.rlw.array[joff + k], i.rlw.array[ioff + k]));
      }
      predator.discardFirstWords(nbre_dirty_prey);
    }
    if (i_is_prey) {
      if (!i.hasNext()) {
        rlwi = null;
        break;
      }
      rlwi.resetRLW(i.next());
      if (andnot) rlwi.RunningBit = !rlwi.RunningBit;
    } else {
      if (!j.hasNext()) {
        rlwj = null;
        break;
      }
      rlwj.resetRLW(j.next());
    }
  }
  if (rlwi != null) (op(0, 1) ? discharge : dischargeAsEmpty)(rlwi, i, container);
  if (rlwj != null) (op(1, 0) ? discharge : dischargeAsEmpty)(rlwj, j, container);
  container.sizeinbits = Math.max(this.sizeinbits, a.sizeinbits);
}

BitSet.prototype.andGroupCardinality = function(bitmaps) {
  var a = this,
      n = bitmaps.length,
      ab = a.buffer,
      an = a.actualsizeinwords;
      buffers = bitmaps.map(function(d) { return d.buffer; }),
      indexes = zeroArray(n),
      positions = zeroArray(n),
      counts = zeroArray(n),
      ap = 0,
      ax = 0;
  while (ap < an) {
    var aw = ab[ap],
        al = ewahRunningLength(aw),
        ad = ewahDirtyLength(aw);
    ap++;
    for (var i = 0; i < n; i++) {
      var x = indexes[i], // index of running word
          dx = ax - x, // current offset
          pn = bitmaps[i].actualsizeinwords,
          adx = 0, // amount of a that we have "used" so far
          b = buffers[i],
          p = positions[i]; // position in buffer of running word
      do {
        var w = b[p],
            l = ewahRunningLength(w),
            d = ewahDirtyLength(w),
            distance = 0;
        // a clean, b clean
        if (adx < al && dx < l) {
          distance = Math.min(al - adx, l - dx);
          counts[i] += (w & aw & 1) * distance << 5;
          adx += distance;
          dx += distance;
        }
        if (adx < al && dx >= l) {
          // a clean, b dirty
          distance = Math.min(al - adx, l + d - dx);
          if (aw & 1) {
            for (var j = 0; j < distance; j++) {
              counts[i] += bits(b[p + 1 + dx - l + d + j]);
            }
          }
          adx += distance;
          dx += distance;
          if (dx === l + d) {
            x += l + d;
            p += 1 + d;
            dx = 0;
          }
        } else if (adx >= al && dx < l) {
          // a dirty, b clean
          distance = Math.min(al + ad - adx, l - dx);
          if (w & 1) {
            for (var j = 0; j < distance; j++) {
              counts[i] += bits(ab[ap + adx - al + j]);
            }
          }
          adx += distance;
          dx += distance;
        }
        if (adx >= al && dx >= l) {
          // a dirty, b dirty
          distance = Math.min(al + ad - adx, l + d - dx);
          for (var j = 0; j < distance; j++) {
            counts[i] += bits(ab[ap + adx - al + j] & b[p + 1 + dx - l + j]);
          }
          dx += distance;
          adx += distance;
          if (dx === l + d) {
            x += l + d;
            p += 1 + d;
            dx = 0;
          }
        }
      } while (p + dx < pn & adx < al + ad);
      indexes[i] = x;
      positions[i] = p;
    }
    ap += ad;
    ax += al + ad;
  }
  return counts;
}

function ewahRunningLength(d) { return d >>> 1 & 0xffff; }
function ewahDirtyLength(d) { return d >>> 17; }

function zeroArray(n) {
  return new Int32Array(n);
}

function negate(data, start, n) {
  for (var i = start; i < start + n; i++) data[i] = ~data[i];
}

function dischargeAsEmpty(initialWord, iterator, container) {
  var rlw = initialWord;
  for (;;) {
    container.addStreamOfEmptyWords(false, rlw.RunningLength + rlw.NumberOfLiteralWords);
    if (!iterator.hasNext()) break;
    rlw = new BufferedRLW(iterator.next());
  }
}

function discharge(initialWord, iterator, container) {
  var runningLengthWord = initialWord;
  for (;;) {
    var runningLength = runningLengthWord.RunningLength;
    container.addStreamOfEmptyWords(runningLengthWord.RunningBit, runningLength);
    container.addStreamOfDirtyWords(iterator.rlw.array, iterator.dirtyWords() + runningLengthWord.dirtywordoffset, runningLengthWord.NumberOfLiteralWords);
    if (!iterator.hasNext()) break;
    runningLengthWord = new BufferedRLW(iterator.next());
  }
}

function reserve(size) {
  if (size <= this.buffer.length) return;
  var old = this.buffer;
  this.buffer = intArray(size);
  this.buffer.set(old);
  this.rlw.array = this.buffer;
}

BitSet.prototype.toString = function() {
  return bitsetString.call(this);
};

BitSet.prototype.toDebugString = function() {
  return bitsetString.call(this, function(i, localrlw) {
    var s = [];
    for (var j = 0; j < localrlw.getNumberOfLiteralWords(); ++j) {
      s.push("\t", i.rlw.array[i.dirtyWords() + j], "\n");
    }
    return s.join("");
  });
};

function bitsetString(callback) {
  var s = "BitSet, size in bits = " + this.sizeinbits +
      " size in words = " + this.actualsizeinwords + "\n";
  var i = new Iterator(this.buffer, this.actualsizeinwords);
  while (i.hasNext()) {
    var localrlw = i.next();
    s += localrlw.getRunningLength() +
        (localrlw.getRunningBit() ? "1x11" : "0x00") + "\n" +
        localrlw.getNumberOfLiteralWords() + " dirties\n";
    if (callback) s += callback(i, localrlw);
  }
  return s;
}

function push_back(bitset, data) {
  if (bitset.actualsizeinwords == bitset.buffer.length) {
    var old = bitset.buffer;
    bitset.buffer = intArray(old.length << 1);
    bitset.buffer.set(old);
    bitset.rlw.array = bitset.buffer;
  }
  bitset.buffer[bitset.actualsizeinwords++] = data;
}

function push_back_many(data, start, number, negate) {
  while (this.actualsizeinwords + number >= this.buffer.length) {
    var old = this.buffer;
    this.buffer = intArray(old.length << 1);
    this.buffer.set(old);
    this.rlw.array = this.buffer;
  }
  this.buffer.set(data.subarray(start, start + number), this.actualsizeinwords);
  if (negate) {
    for (var i = this.actualsizeinwords; i < this.actualsizeinwords + number; i++) {
      this.buffer[i] = ~this.buffer[i];
    }
  }
  this.actualsizeinwords += number;
}

function addEmptyWord(v) {
  var noliteralword = this.rlw.getNumberOfLiteralWords() == 0;
  var runlen = this.rlw.getRunningLength();
  if (noliteralword && runlen == 0) this.rlw.setRunningBit(v);
  if (noliteralword && this.rlw.getRunningBit() == v && runlen < largestrunninglengthcount) {
    this.rlw.setRunningLength(runlen + 1);
  } else {
    push_back(this, 0);
    this.rlw.position = this.actualsizeinwords - 1;
    this.rlw.setRunningBit(v);
    this.rlw.setRunningLength(1);
  }
}

function addLiteralWord(newdata) {
  var numbersofar = this.rlw.getNumberOfLiteralWords();
  if (numbersofar >= largestliteralcount) {
    push_back(this, 0);
    this.rlw.position = this.actualsizeinwords - 1;
    this.rlw.setNumberOfLiteralWords(1);
    push_back(this, newdata);
  } else {
    this.rlw.setNumberOfLiteralWords(numbersofar + 1);
    push_back(this, newdata);
  }
}

BitSet.prototype.read = function(f) {
  var buffer = this.buffer,
      n = this.actualsizeinwords;
  for (var i = 0, x = 0, count = 0; i < n;) {
    var w = buffer[i++],
        l = ewahRunningLength(w),
        d = ewahDirtyLength(w);
    if (w & 1) {
      for (var j = 0; j < l; j++) {
        for (var k = 0; k < 32; k++) f(x++, count++);
      }
    } else x += l << 5;
    for (var limit = i + d; i < limit; i++, x += 32) {
      w = buffer[i];
      while (w) {
        var lsb = w & -w;
        w ^= lsb;
        f(x + log2pow2(lsb), count++);
      }
    }
  }
};

function Iterator(buffer, size) {
  this.rlw = new RLW(buffer, 0);
  this.size = size;
  this.pointer = 0;
}

Iterator.prototype.hasNext = function() {
  return this.pointer < this.size;
};

Iterator.prototype.next = function() {
  this.rlw.position = this.pointer;
  this.pointer += this.rlw.getNumberOfLiteralWords() + 1;
  return this.rlw;
};

Iterator.prototype.dirtyWords = function() {
  return this.pointer - this.rlw.getNumberOfLiteralWords();
};

function intArray(n) {
  return new Int32Array(n);
}

// http://graphics.stanford.edu/~seander/bithacks.html#CountBitsSetParallel
function bits(v) {
  v -= (v >> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
  return ((v + (v >> 4) & 0xF0F0F0F) * 0x1010101) >> 24;
}

// http://graphics.stanford.edu/~seander/bithacks.html#IntegerLogDeBruijn
var positions = new Uint8Array([
  0, 1, 28, 2, 29, 14, 24, 3, 30, 22, 20, 15, 25, 17, 4, 8, 
  31, 27, 13, 23, 21, 19, 16, 7, 26, 12, 18, 6, 11, 5, 10, 9
]);
// Assumes input is a power of two.
function log2pow2(v) {
  return positions[(v * 0x077CB531) >>> 27];
}

function RLW(array, position) {
  this.array = array;
  this.position = position;
}

RLW.prototype.getNumberOfLiteralWords = function() {
  return this.array[this.position] >>> 1 + runninglengthbits;
};

RLW.prototype.setNumberOfLiteralWords = function(n) {
  this.array[this.position] |= notrunninglengthplusrunningbit;
  this.array[this.position] &= (n << runninglengthbits + 1) | runninglengthplusrunningbit;
};

RLW.prototype.setRunningBit = function(b) {
  if (b) this.array[this.position] |= 1;
  else this.array[this.position] &= ~1;
};

RLW.prototype.getRunningBit = function() {
  return this.array[this.position] & 1 != 0;
};

RLW.prototype.getRunningLength = function() {
  return (this.array[this.position] >>> 1) & largestrunninglengthcount;
};

RLW.prototype.setRunningLength = function(n) {
  this.array[this.position] |= shiftedlargestrunninglengthcount;
  this.array[this.position] &= (n << 1) | notshiftedlargestrunninglengthcount;
};

RLW.prototype.size = function() {
  return this.getRunningLength() + this.getNumberOfLiteralWords();
};

function BufferedRLW(rlw) {
  this.reset(rlw.array[rlw.position]);
}

BufferedRLW.prototype.resetRLW = function(rlw) {
  this.reset(rlw.array[rlw.position]);
}

BufferedRLW.prototype.reset = function(a) {
  this.NumberOfLiteralWords = (a >>> (1 + runninglengthbits));
  this.RunningBit = (a & 1) != 0;
  this.RunningLength = ((a >>> 1) & largestrunninglengthcount);
  this.dirtywordoffset = 0;
};

BufferedRLW.prototype.discardFirstWords = function(x) {
  if (this.RunningLength >= x) this.RunningLength -= x;
  else {
    x -= this.RunningLength;
    this.RunningLength = 0;
    this.dirtywordoffset += x;
    this.NumberOfLiteralWords -= x;
  }
}

BufferedRLW.prototype.size = function() {
  return this.RunningLength + this.NumberOfLiteralWords;
};

function BitCounter() { this.n = 0; }
BitCounter.prototype.add = function(d) { this.n += bits(d); };
BitCounter.prototype.addStreamOfEmptyWords = function(v, n) {
  if (v) this.n += n << 5;
};
BitCounter.prototype.addStreamOfDirtyWords = function(d, i, n) {
  n += i;
  while (i < n) this.n += bits(d[i++]);
};

})(this);

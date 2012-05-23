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
var runninglengthplusrunningbit = (1 << (runninglengthbits + 1)) - 1;
var notrunninglengthplusrunningbit = ~runninglengthplusrunningbit;

function BitSet(n) {
  if (!arguments.length) n = 1;
  // TODO use NPOT
  this.buffer = intArray(n);
  this.rlw = new RLW(this.buffer, 0);
  this.actualsizeinwords = 1;
  this.sizeinbits = 0;
}

BitSet.prototype.set = function(i) {
  var s = this.sizeinbits;
  if (i < s) return false;
  var sameWord = false;
  if (s & 0x1f) {
    var possibleSizeInBits = (s >> 5 << 5) + 32;
    if (possibleSizeInBits < i + 1) this.sizeinbits = possibleSizeInBits;
    else sameWord = true;
  }
  this.addStreamOfEmptyWords(false, (i >> 5) - (this.sizeinbits >> 5));
  var bittoflip = i - (this.sizeinbits >> 5 << 5);
  // next, we set the bit
  if (this.rlw.getNumberOfLiteralWords() == 0 || ((this.sizeinbits - 1) >> 5 < i >> 5)) {
    var newdata = 1 << bittoflip;
    addLiteralWord(this, newdata);
    if (sameWord && !this.rlw.getRunningBit() && this.rlw.getRunningLength() > 0) {
      // the previous literal word is replacing the last running word
      this.rlw.setRunningLength(this.rlw.getRunningLength() - 1);
    }
  } else {
    var a = this.actualsizeinwords - 1;
    this.buffer[a] |= 1 << bittoflip;
    // check if we just completed a stream of 1s
    if (this.buffer[a] == ~0) {
      // we remove the last dirty word
      this.buffer[this.actualsizeinwords = a] = 0;
      this.rlw.setNumberOfLiteralWords(this.rlw.getNumberOfLiteralWords() - 1);
      // next we add one clean word
      addEmptyWord(true);
    }
  }
  this.sizeinbits = i + 1;
  return true;
};

BitSet.prototype.addStreamOfEmptyWords = function(v, number) {
  if (number == 0) return 0;
  var noliteralword = this.rlw.getNumberOfLiteralWords() == 0;
  var runlen = this.rlw.getRunningLength();
  if (noliteralword && runlen == 0) this.rlw.setRunningBit(v);
  var wordsadded = 0;
  if (noliteralword && this.rlw.getRunningBit() == v && runlen < largestrunninglengthcount) {
    var whatwecanadd = number < largestrunninglengthcount - runlen ? number
        : largestrunninglengthcount - runlen;
    this.rlw.setRunningLength(runlen + whatwecanadd);
    this.sizeinbits += whatwecanadd << 5;
    if (number - whatwecanadd > 0) wordsadded += this.addStreamOfEmptyWords(v, number - whatwecanadd);
  } else {
    push_back(this, 0);
    ++wordsadded;
    this.rlw.position = this.actualsizeinwords - 1;
    var whatwecanadd = number < largestrunninglengthcount ? number
      : largestrunninglengthcount;
    this.rlw.setRunningBit(v);
    this.rlw.setRunningLength(whatwecanadd);
    this.sizeinbits += whatwecanadd << 5;
    if (number - whatwecanadd > 0) wordsadded += this.addStreamOfEmptyWords(v, number - whatwecanadd);
  }
  return wordsadded;
};

function push_back(bitset, data) {
  if (bitset.actualsizeinwords == bitset.buffer.length) {
    var oldbuffer = bitset.buffer;
    bitset.buffer = intArray(oldbuffer.length << 1);
    bitset.buffer.set(oldbuffer);
    bitset.rlw.array = bitset.buffer;
  }
  bitset.buffer[bitset.actualsizeinwords++] = data;
}

function addLiteralWord(bitset, newdata) {
  var numbersofar = bitset.rlw.getNumberOfLiteralWords();
  if (numbersofar >= largestliteralcount) {
    push_back(bitset, 0);
    bitset.rlw.position = bitset.actualsizeinwords - 1;
    bitset.rlw.setNumberOfLiteralWords(1);
    push_back(bitset, newdata);
    return 2;
  }
  bitset.rlw.setNumberOfLiteralWords(numbersofar + 1);
  push_back(bitset, newdata);
  return 1;
}

BitSet.prototype.read = function(f) {
  var i = new Iterator(this.buffer, this.actualsizeinwords);
  var pos = 0;
  var localrlw = null;
  var initcapacity = 512;
  var localbuffer = intArray(initcapacity);
  var localbuffersize = 0;
  var bufferpos = 0;
  var status = queryStatus();

  function queryStatus() {
    while (localbuffersize == 0) {
      if (!loadNextRLE()) return false;
      loadBuffer();
    }
    return true;
  }

  function loadNextRLE() {
    while (i.hasNext()) {
      localrlw = i.next();
      return true;
    }
    return false;
  }

  function add(val) {
    ++localbuffersize;
    if (localbuffersize > localbuffer.length) {
      var oldbuffer = localbuffer;
      localbuffer = intArray(localbuffer.length * 2);
      localbuffer.set(oldbuffer);
    }
    localbuffer[localbuffersize - 1] = val;
  }

  function loadBuffer() {
    bufferpos = 0;
    localbuffersize = 0;
    if (localrlw.getRunningBit()) {
      for (var j = 0; j < localrlw.getRunningLength(); ++j) {
        for (var c = 0; c < WORDINBITS; ++c) add(pos++);
      }
    } else {
      pos += WORDINBITS * localrlw.getRunningLength();
    }
    for (var j = 0; j < localrlw.getNumberOfLiteralWords(); ++j) {
      var data = i.rlw.array[i.dirtyWords() + j];
      while (data != 0) {
        var ntz = trailingZeroes(data);
        data ^= (1 << ntz);
        add(ntz + pos) ;
      }
      pos += WORDINBITS;
    }
  }

  var count = 0;
  while (status) {
    var answer = localbuffer[bufferpos++];
    if (localbuffersize == bufferpos) {
      localbuffersize = 0;
      status = queryStatus();
    }
    f(answer, count++);
  }
};

BitSet.prototype.and = function() {
};

BitSet.prototype.or = function() {
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

function RLW(array, position) {
  this.array = array;
  this.position = position;
}

RLW.prototype.getNumberOfLiteralWords = function() {
  return this.array[this.position] >>> (1 + runninglengthbits);
};

RLW.prototype.setNumberOfLiteralWords = function(n) {
  this.array[this.position] |= notrunninglengthplusrunningbit;
  this.array[this.position] &= (n << (runninglengthbits + 1)) | runninglengthplusrunningbit;
};

RLW.prototype.setRunningBit = function(b) {
  if (b) this.array[this.position] |= 1;
  else this.array[this.position] &= ~1;
};

RLW.prototype.getRunningBit = function() {
  return (this.array[this.position] & 1) != 0;
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

})(this);

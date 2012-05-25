var BitSet = require("../bitset").BitSet;

var vows = require("vows"),
    assert = require("assert");

var suite = vows.describe("bitset");

suite.addBatch({
  "bitset": {
    topic: function() {
      return new BitSet;
    },
    "simple": function(b) {
      var data = [2, 200, 299, 300, 1 << 16];
      data.forEach(function(d) {
        b.set(d);
      });
      var count = 0;
      b.read(function(d, i) {
        assert.equal(d, data[i]);
        count++;
      });
      assert.equal(count, data.length);
    },
    "operations": operations([1, 2, 3, 100, 999, 1000, 2012], [3, 4, 5, 200, 999, 2012], {
      "or": [1, 2, 3, 4, 5, 100, 200, 999, 1000, 2012],
      "and": [3, 999, 2012],
      "xor": [1, 2, 4, 5, 100, 200, 1000],
      "andNot": [1, 2, 100, 1000]
    })
  }
});

suite.export(module);

function operations(a, b, expected) {
  var ba = new BitSet,
      bb = new BitSet,
      tests = {};
  a.forEach(function(d) {
    ba.set(d);
  });
  b.forEach(function(d) {
    bb.set(d);
  });
  for (var op in expected) {
    tests[op] = (function(op) {
      var e = expected[op];
      return function() {
        var c = ba[op](bb),
            count = 0;
        c.read(function(d, i) {
          assert.equal(d, e[i]);
          count++;
        });
        assert.equal(count, e.length);
      };
    })(op);
  }
  return tests;
}

function range(n) {
  var a = [], i = -1;
  while (++i < n) a[i] = i;
  return a;
}

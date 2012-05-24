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
    "andNot": function(b) {
      var a = new BitSet;
      a.set(1);
      a.set(2);
      a.set(3);
      var b = new BitSet;
      b.set(3);
      b.set(4);
      b.set(5);
      var c = a.andNot(b);
      var expected = [1, 2];
      var count = 0;
      c.read(function(d, i) {
        assert.equal(d, expected[i]);
        count++;
      });
      assert.equal(count, expected.length);
    }
  }
});

suite.export(module);

function range(n) {
  var a = [], i = -1;
  while (++i < n) a[i] = i;
  return a;
}

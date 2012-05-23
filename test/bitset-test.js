var BitSet = require("../bitset").BitSet;

var vows = require("vows"),
    assert = require("assert");

var suite = vows.describe("bitset");

suite.addBatch({
  "bitset": {
    topic: function() {
      return new BitSet(100);
    },
    "simple": function(b) {
      var data = [2, 20, 99, 100];
      data.forEach(function(d) {
        b.set(d);
      });
      var count = 0;
      b.read(function(d, i) {
        assert.equal(d, data[i]);
        count++;
      });
      assert.equal(count, data.length);
    }
  }
});

suite.export(module);

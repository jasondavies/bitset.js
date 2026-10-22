// Compares BitSet with TypedFastBitSet and Set.
// Usage: node test/bench.js [length] [densities,...] [structures,...]
// length defaults to 1,000,000 bits; densities default to 0.01,0.1,0.5.
// Each structure runs in its own process, so that one structure's code
// doesn't affect how V8 optimises another's.
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {BitSet} from "../bitset.js";
import {TypedFastBitSet} from "typedfastbitset";

const N = +(process.argv[2] || 1e6);
const densities = (process.argv[3] || "0.01,0.1,0.5").split(",").map(Number);
const onlyS = process.argv[4] ? process.argv[4].split(",") : null;
const REPS = 9;

let seed = 1;
const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;

const structures = {
  bitset: {
    build(indices) { const s = new BitSet(N); for (let i = 0; i < indices.length; i++) s.add(indices[i]); return s; },
    has: (s, i) => s.has(i),
    forEach(s) { let t = 0; s.forEach(i => { t += i; }); return t; },
    iterate(s) { let t = 0; for (const i of s) t += i; return t; },
    size: s => s.size,
    and: (a, b) => a.and(b),
    or: (a, b) => a.or(b),
  },
  typedfastbitset: {
    build(indices) { const s = new TypedFastBitSet; for (let i = 0; i < indices.length; i++) s.add(indices[i]); return s; },
    has: (s, i) => s.has(i),
    forEach(s) { let t = 0; s.forEach(i => { t += i; }); return t; },
    iterate(s) { let t = 0; for (const i of s) t += i; return t; },
    size: s => s.size(),
    and: (a, b) => a.intersection(b),
    or: (a, b) => a.union(b),
  },
  set: {
    build(indices) { const s = new Set; for (let i = 0; i < indices.length; i++) s.add(indices[i]); return s; },
    has: (s, i) => s.has(i),
    forEach(s) { let t = 0; s.forEach(i => { t += i; }); return t; },
    iterate(s) { let t = 0; for (const i of s) t += i; return t; },
    size: s => s.size,
  },
};

const now = () => performance.now();
const median = a => a.slice().sort((x, y) => x - y)[a.length >> 1];

// Returns the median time in milliseconds for one call of f, over REPS
// samples of at least 5ms each, after a warmup.
function time(f) {
  const t = [];
  for (let i = -3; i < REPS; i++) {
    let n = 0, t0 = now(), t1;
    do { f(); n++; } while ((t1 = now()) - t0 < 5);
    if (i >= 0) t.push((t1 - t0) / n);
  }
  return median(t);
}

// Each index is present with probability density, inserted in random order.
function randomIndices(density) {
  const a = [];
  for (let i = 0; i < N; i++) if (random() < density) a.push(i);
  for (let i = a.length - 1; i > 0; i--) { const j = random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return Uint32Array.from(a);
}

const probes = Uint32Array.from({length: 1e6}, () => random() * N);

const names = Object.keys(structures).filter(name => !onlyS || onlyS.includes(name));
if (names.length > 1) {
  const results = names.map(name => JSON.parse(execFileSync(process.execPath,
      [fileURLToPath(import.meta.url), N, densities.join(","), name], {encoding: "utf8"})));
  const f = v => v == null ? "–" : (v < 1 ? v.toFixed(3) : v.toFixed(2)) + "ms";
  densities.forEach((density, d) => {
    console.log(`\n## length ${N}, density ${density} (${results[0][d].count} indices)`);
    console.log("| | build | has (1M probes) | forEach | for…of | size | and | or |");
    console.log("|---|---|---|---|---|---|---|---|");
    names.forEach((name, i) => {
      const r = results[i][d];
      console.log(`| ${name}${r.ok ? "" : " (WRONG)"} | ${f(r.build)} | ${f(r.has)} | ${f(r.forEach)} | ${f(r.iterate)} | ${f(r.size)} | ${f(r.and)} | ${f(r.or)} |`);
    });
  });
} else {
  console.log(JSON.stringify(densities.map(density => run(structures[names[0]], density))));
}

function run(S, density) {
  const a = randomIndices(density),
      b = randomIndices(density),
      present = new Uint8Array(N);
  for (const i of a) present[i] = 1;
  const expectedSum = a.reduce((t, i) => t + i, 0),
      expectedHits = probes.reduce((t, i) => t + present[i], 0),
      r = {count: a.length};
  let ok = true;
  r.build = time(() => S.build(a));
  const s = S.build(a);
  r.has = time(() => {
    let n = 0;
    for (let i = 0; i < probes.length; i++) n += S.has(s, probes[i]);
    ok &&= n === expectedHits;
  });
  r.forEach = time(() => { ok &&= S.forEach(s) === expectedSum; });
  r.iterate = time(() => { ok &&= S.iterate(s) === expectedSum; });
  r.size = time(() => { ok &&= S.size(s) === a.length; });
  if (S.and) {
    // Both operations are idempotent, so repeating them on the same sets
    // does the same work each time.
    const x = S.build(a), y = S.build(b), z = S.build(a);
    r.and = time(() => S.and(x, y));
    r.or = time(() => S.or(z, y));
  }
  r.ok = ok;
  return r;
}

// Checks bitset.d.ts against typical usage; run with npm run check.
import {BitSet} from "@jasondavies/bitset";

const set: BitSet = new BitSet(100).add(1).add(2);
const length: number = set.length;
const size: number = set.size;
const words: Uint32Array = set.words;
const present: boolean = set.has(1);
const deleted: boolean = set.delete(1);
set.clear();
set.forEach((i: number) => {});
const values: number[] = [...set, ...set.values()];
for (const i of set) i.toFixed();
const copy: BitSet = set.clone();
const same: BitSet = set.and(copy).or(copy).xor(copy).andNot(copy);

// @ts-expect-error length is read-only.
set.length = 10;
// @ts-expect-error size is read-only.
set.size = 10;
// @ts-expect-error indices are numbers.
set.add("1");
// @ts-expect-error other must be a BitSet.
set.and(new Set<number>());

export {length, size, words, present, deleted, values, same};

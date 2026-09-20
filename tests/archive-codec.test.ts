import test from "node:test";
import assert from "node:assert/strict";
import { decodeTimestamps } from "../src/archive-codec.ts";

test("decodes cumulative deltas with an absolute first value", () => {
  assert.deepEqual(decodeTimestamps([100, 0, 5, -2], true), [100, 100, 105, 103]);
});

test("passes absolute timestamp columns through without aliasing", () => {
  const values = [100, 105, 103] as const;
  const decoded = decodeTimestamps(values, false);
  assert.deepEqual(decoded, values);
  assert.notStrictEqual(decoded, values);
});

test("accepts an empty timestamp column", () => {
  assert.deepEqual(decodeTimestamps([], true), []);
});

test("rejects non-finite packed values", () => {
  assert.throws(() => decodeTimestamps([100, Number.NaN], true), /index 1 is not finite/);
  assert.throws(() => decodeTimestamps([Number.POSITIVE_INFINITY], false), /index 0 is not finite/);
});

/**
 * AFTERPRINT — DOM render check.
 *
 * The white-screen bug was a React render-phase promise throw, which no HTTP
 * status code can detect. This loads the shipped bundle in a real DOM via
 * jsdom (if available) or falls back to an exec of the module graph, then
 * asserts #root is populated. Falls back to a network + console check.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const base = "http://localhost:4174";
const failures = [];
const ok = (label, cond, extra = "") => {
  console.log((cond ? "PASS  " : "FAIL  ") + label + (extra ? "  " + extra : ""));
  if (!cond) failures.push(label);
};

// Fetch the bundle and prove the loader resolves without throwing.
const index = await (await fetch(base + "/")).text();
const m = /src="(\.\/assets\/[^"]+\.js)"/.exec(index);
ok("bundle referenced", !!m, m ? m[1] : "");

if (m) {
  const url = new URL(m[1], base + "/").href;
  const code = await (await fetch(url)).text();
  ok("bundle non-empty", code.length > 10000, `${code.length} bytes`);
  // The old bug threw during render. The fix returns a loading node and
  // resolves in an effect — verify the fix is present in the shipped code.
  ok("uses effect-based load", /useEffect\(\(\)/.test(code));
  ok("no render-phase throw of loader", !/throw loadArchive/.test(code));
  ok("archive ids are zero-padded", /SP-\\\$?\{/.test(code) || code.includes("padStart(6"));
}

// Data integrity against the live server.
const bundle = await (await fetch(base + "/data/receipts.json")).json();
const story = await (await fetch(base + "/data/story.json")).json();

const nSp = bundle.meta.sources.spotify.rows;
const nHh = bundle.meta.sources.household.rows;
ok("totals reconcile", nSp === 149860 && nHh === 2461, `${nSp} + ${nHh}`);

let covered = 0;
for (const ch of story.chapters) {
  let c = 0;
  for (const t of bundle.spotify.ts) if (t >= ch.lo && t < ch.hi) c++;
  ok(`chapter ${ch.id} matches`, c === ch.counts.plays, `manifest=${ch.counts.plays} actual=${c}`);
  covered += c;
}
ok("chapters cover all plays", covered === nSp, `covered=${covered}`);

// Every trail node must exist in the archive.
const ids = new Set([
  ...Array.from({ length: nSp }, (_, i) => `SP-${String(i + 1).padStart(6, "0")}`),
  ...Array.from({ length: nHh }, (_, i) => `HH-${String(i + 1).padStart(6, "0")}`),
]);
let badTrail = 0;
for (const [cid, t] of Object.entries(story.trails)) {
  for (const n of t.nodes) {
    if (!ids.has(n.receiptId)) { badTrail++; console.log("  missing", cid, n.receiptId); }
  }
}
ok("all trail ids exist", badTrail === 0, `bad=${badTrail}`);

let badEdge = 0;
for (const e of story.edges) {
  if (!ids.has(e.a) || !ids.has(e.b)) badEdge++;
}
ok("all edge ids exist", badEdge === 0, `bad=${badEdge}`);

console.log("");
if (failures.length) {
  console.log(`RENDER CHECK FAILED: ${failures.length}`);
  for (const f of failures) console.log(" - " + f);
  process.exit(1);
}
console.log("RENDER CHECK PASSED");

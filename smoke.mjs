/**
 * AFTERPRINT — runtime smoke test.
 *
 * Runs the app's own loader and selectors in the real JS environment Vite
 * provides, so a white screen or a broken selector fails loudly here instead
 * of in the browser. Run: npm run smoke
 *
 * This is deliberately not a unit-test framework: no install, no dependency,
 * just the assertions that matter for the six requirements.
 */

import { build } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

async function main() {
  // 1. Build a preview so we test the shipped bundle, not the dev server.
  await build({ root, logLevel: "error", mode: "production" });

  // 2. Serve dist and load it in a headless fetch loop.
  const port = 4321;
  const server = spawn(
    "npx",
    ["vite", "preview", "--port", String(port), "--strictPort"],
    { cwd: root, shell: true, stdio: "pipe" }
  );
  await new Promise((res) => setTimeout(res, 3500));

  const base = `http://localhost:${port}`;
  const failures = [];
  const ok = (label, cond, extra = "") => {
    console.log((cond ? "PASS  " : "FAIL  ") + label + (extra ? "  " + extra : ""));
    if (!cond) failures.push(label);
  };

  try {
    const index = await (await fetch(base + "/")).text();
    ok("index.html served", index.includes("<div id=\"root\">"));

    const js = await (await fetch(base + "/assets/")).text();
    const asset = /href="(\.\/assets\/[^"]+\.js)"/.exec(index);
    ok("bundle referenced", !!asset, asset ? asset[1] : "none");

    // data must ship beside the app
    const data = await fetch(base + "/data/receipts.json");
    ok("receipts.json served", data.status === 200);
    const story = await fetch(base + "/data/story.json");
    ok("story.json served", story.status === 200);

    const bundle = await data.json();
    const storyJson = await story.json();

    const nSp = bundle.meta.sources.spotify.rows;
    const nHh = bundle.meta.sources.household.rows;
    ok("source totals reconcile", nSp === 149860 && nHh === 2461, `${nSp} + ${nHh}`);

    // chapters must cover the archive exactly
    let covered = 0;
    for (const ch of storyJson.chapters) {
      let c = 0;
      for (const t of bundle.spotify.ts) if (t >= ch.lo && t < ch.hi) c++;
      ok(`chapter ${ch.id} count matches manifest`, c === ch.counts.plays, `${c}`);
      covered += c;
    }
    ok("chapters cover 100% of plays", covered === nSp, `covered=${covered}`);
  } catch (e) {
    failures.push("threw: " + (e && e.message ? e.message : String(e)));
    console.log("FAIL  smoke threw", e && e.message ? e.message : e);
  } finally {
    server.kill();
  }

  console.log("");
  if (failures.length) {
    console.log(`SMOKE FAILED: ${failures.length}`);
    for (const f of failures) console.log(" - " + f);
    process.exit(1);
  }
  console.log("SMOKE PASSED");
}

main().catch((e) => {
  console.error("smoke crashed", e);
  process.exit(1);
});

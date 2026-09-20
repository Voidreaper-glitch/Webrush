import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { decodeTimestamps } from "../src/archive-codec.ts";

type AnyRecord = Record<string, any>;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8")) as AnyRecord;
const bundle = await readJson(resolve(root, "public/data/receipts.json"));
const story = await readJson(resolve(root, "src/storyData.json"));
const storyText = await readFile(resolve(root, "src/storyData.json"), "utf8");
const publicStoryText = await readFile(resolve(root, "public/data/story.json"), "utf8");
const seed = await readJson(resolve(root, "src/trailReceipts.json"));
const spotify = bundle.spotify as AnyRecord;
const household = bundle.household as AnyRecord;
const d = bundle.dicts as AnyRecord;
const spTs = decodeTimestamps(spotify.ts as number[], Boolean(bundle.meta?.encoding?.tsDelta));
let checks = 0;
const ok = (condition: unknown, message: string): asserts condition => { checks += 1; assert(condition, message); };
const same = (a: unknown, b: unknown, message: string) => { checks += 1; assert.deepEqual(a, b, message); };

same(storyText, publicStoryText, "src/storyData.json and public/data/story.json differ");
const spRows = (bundle.meta.sources.spotify.rows as number);
const hhRows = (bundle.meta.sources.household.rows as number);
same(spRows, spTs.length, "Spotify metadata row count does not match timestamp column");
same(hhRows, household.dt.length, "household metadata row count does not match date column");
for (const [name, column] of Object.entries(spotify)) same(column.length, spTs.length, `Spotify column ${name} has a different row count`);
for (const [name, column] of Object.entries(household)) same(column.length, hhRows, `household column ${name} has a different row count`);
for (const name of ["track", "artist", "album", "platform", "reason_start", "reason_end", "hh_category", "hh_subcategory", "hh_mode", "hh_ie"]) ok(Array.isArray(d[name]), `missing dictionary ${name}`);

const checkIndex = (name: string, value: unknown, length: number, allowMissing = true) => {
  ok(Number.isInteger(value), `${name} contains a non-integer dictionary index`);
  if (allowMissing && value === -1) return;
  ok((value as number) >= 0 && (value as number) < length, `${name} dictionary index is out of range`);
};
for (let i = 0; i < spTs.length; i += 1) {
  for (const [name, col, dict] of [["t", spotify.t, d.track], ["a", spotify.a, d.artist], ["al", spotify.al, d.album], ["p", spotify.p, d.platform], ["rs", spotify.rs, d.reason_start], ["re", spotify.re, d.reason_end]] as const) checkIndex(`spotify.${name}[${i}]`, col[i], dict.length);
  checkIndex(`spotify.i[${i}]`, spotify.i[i], d.uri.length);
  ok(Number.isFinite(spotify.ts[i]) && Number.isFinite(spTs[i]), `non-finite Spotify timestamp at ${i}`);
  ok(i === 0 || spTs[i] >= spTs[i - 1], `Spotify timestamps decrease at ${i}`);
}
for (let i = 0; i < hhRows; i += 1) {
  for (const [name, col, dict] of [["cat", household.cat, d.hh_category], ["sub", household.sub, d.hh_subcategory], ["mode", household.mode, d.hh_mode], ["ie", household.ie, d.hh_ie]] as const) checkIndex(`household.${name}[${i}]`, col[i], dict.length);
  ok(Number.isFinite(household.dt[i]), `non-finite household timestamp at ${i}`);
}

const chapter = (id: string) => story.chapters.find((c: AnyRecord) => c.id === id)!;
const record = (id: string): AnyRecord => {
  const [prefix, raw] = id.split("-");
  const row = Number(raw) - 1;
  ok(Number.isInteger(row) && row >= 0, `invalid receipt ID ${id}`);
  if (prefix === "SP") {
    return { id, source: "spotify", ts: spTs[row], kind: "music", track: d.track[spotify.t[row]], artist: d.artist[spotify.a[row]], album: d.album[spotify.al[row]], platform: d.platform[spotify.p[row]], ms: spotify.ms[row], skipped: spotify.sk[row] === 1, rs: spotify.rs[row] >= 0 ? d.reason_start[spotify.rs[row]] : "unknown", re: spotify.re[row] >= 0 ? d.reason_end[spotify.re[row]] : "unknown" };
  }
  ok(prefix === "HH", `unknown receipt prefix ${id}`);
  return { id, source: "household", ts: household.dt[row], kind: "transaction", category: d.hh_category[household.cat[row]], subcategory: household.sub[row] >= 0 ? d.hh_subcategory[household.sub[row]] : "", note: household.note[row] || "", amount: household.amt[row], mode: d.hh_mode[household.mode[row]], flow: d.hh_ie[household.ie[row]] };
};
const records = new Map<string, AnyRecord>();
const get = (id: string) => { const found = records.get(id); if (found) return found; const value = record(id); records.set(id, value); return value; };
const musicRowsIn = (c: AnyRecord) => { const out: AnyRecord[] = []; for (let i = 0; i < spTs.length; i += 1) if (c.lo <= spTs[i] && spTs[i] < c.hi) out.push(record(`SP-${String(i + 1).padStart(6, "0")}`)); return out; };
const hhRowsIn = (c: AnyRecord) => { const out: AnyRecord[] = []; for (let i = 0; i < hhRows; i += 1) if (c.lo <= household.dt[i] && household.dt[i] < c.hi) out.push(record(`HH-${String(i + 1).padStart(6, "0")}`)); return out; };

for (const c of story.chapters as AnyRecord[]) {
  const music = musicRowsIn(c);
  const hh = hhRowsIn(c);
  same(music.length, c.counts.plays, `${c.id} play count is stale`);
  same(hh.length, c.counts.transactions, `${c.id} transaction count is stale`);
  same(new Set(music.map((r) => r.artist)).size, c.counts.artists, `${c.id} artist count is stale`);
  const hours = music.reduce((sum, r) => sum + r.ms, 0) / 3_600_000;
  ok(Math.abs(hours - c.counts.hours) < 0.11, `${c.id} listening hours are stale`);
  const skipped = music.filter((r) => r.skipped).length / Math.max(1, music.length) * 100;
  ok(Math.abs(skipped - c.counts.skipRate) < 0.11, `${c.id} skip rate is stale`);
  const platforms: AnyRecord = {};
  for (const r of music) platforms[r.platform] = (platforms[r.platform] ?? 0) + 1;
  same(platforms, c.platforms, `${c.id} platform counts are stale`);
  const artists: AnyRecord = {};
  for (const r of music) artists[r.artist] = (artists[r.artist] ?? 0) + 1;
  const top = Object.entries(artists).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([artist, plays]) => ({ artist, plays }));
  same(top, c.topArtists, `${c.id} top artists are stale`);
  same(`${new Date(c.lo * 1000).toISOString().slice(0, 10)} to ${new Date((c.hi - 1) * 1000).toISOString().slice(0, 10)}`, c.dateSpan, `${c.id} dateSpan disagrees with epoch bounds`);
}

const edgeById = new Map<string, AnyRecord>();
const edgeKeys = new Set<string>();
for (const edge of story.edges as AnyRecord[]) {
  ok(typeof edge.id === "string" && edge.id.length > 0, "edge has no stable id");
  ok(!edgeById.has(edge.id), `duplicate edge id ${edge.id}`); edgeById.set(edge.id, edge);
  const key = `${edge.a}\u0000${edge.b}\u0000${edge.rule}`;
  ok(!edgeKeys.has(key), `duplicate edge endpoints/rule ${key}`); edgeKeys.add(key);
  const a = get(edge.a); const b = get(edge.b);
  const meta = edge.meta ?? {};
  switch (edge.rule) {
    case "same-artist": ok(a.kind === "music" && b.kind === "music" && a.artist === b.artist, `${edge.id} same-artist does not match source artists`); break;
    case "same-album": ok(a.kind === "music" && b.kind === "music" && a.album === b.album, `${edge.id} same-album does not match source albums`); break;
    case "same-platform": ok(a.kind === "music" && b.kind === "music" && a.platform === b.platform, `${edge.id} same-platform does not match source platforms`); break;
    case "same-subcategory": ok(a.kind === "transaction" && b.kind === "transaction" && a.subcategory === b.subcategory, `${edge.id} same-subcategory does not match source`); break;
    case "same-venue": ok(a.kind === "transaction" && b.kind === "transaction" && String(a.note).toLowerCase().includes(String(meta.venue ?? "").toLowerCase()) && String(b.note).toLowerCase().includes(String(meta.venue ?? "").toLowerCase()), `${edge.id} same-venue does not match notes`); break;
    case "device-shift": ok(a.kind === "music" && b.kind === "music" && a.platform !== b.platform, `${edge.id} device-shift has equal platforms`); break;
    case "same-language-strand": ok(a.kind === "music" && b.kind === "music" && String(edge.evidence).includes(a.artist) && String(edge.evidence).includes(b.artist), `${edge.id} language evidence omits an endpoint artist`); break;
    case "temporal+theme":
    case "co-occurrence": ok(typeof edge.evidence === "string" && edge.evidence.length > 0, `${edge.id} has no evidence`); break;
    default: assert.fail(`${edge.id} has unknown rule ${edge.rule}`);
  }
  if (Array.isArray(meta.ch) && Array.isArray(meta.counts) && typeof meta.artist === "string") {
    same(meta.counts, meta.ch.map((ch: string) => musicRowsIn(chapter(ch)).filter((r) => r.artist === meta.artist).length), `${edge.id} artist metadata counts are stale`);
  }
  if (Array.isArray(meta.ch) && Array.isArray(meta.counts) && typeof meta.platform === "string" && !meta.platform.includes("->")) {
    same(meta.counts, meta.ch.map((ch: string) => musicRowsIn(chapter(ch)).filter((r) => r.platform === meta.platform).length), `${edge.id} platform metadata counts are stale`);
  }
  if (typeof meta.subcategory === "string" && Array.isArray(meta.counts)) same(meta.counts[0], hhRowsIn({ lo: -Infinity, hi: Infinity }).filter((r) => r.subcategory === meta.subcategory).length, `${edge.id} subcategory count is stale`);
  if (typeof meta.venue === "string" && Array.isArray(meta.counts)) same(meta.counts[0], hhRowsIn({ lo: -Infinity, hi: Infinity }).filter((r) => String(r.note).toLowerCase().includes(meta.venue.toLowerCase())).length, `${edge.id} venue count is stale`);
  if (typeof meta.gap_days === "number") {
    const actualGap = Math.abs(a.ts - b.ts) / 86_400;
    ok(Number.isFinite(meta.gap_days) && Math.abs(actualGap - meta.gap_days) <= 7, `${edge.id} gap_days metadata is stale`);
  }
  const evidence = String(edge.evidence);
  if (typeof meta.artist === "string") {
    for (const claim of evidence.matchAll(/(\d[\d,]*)\s+plays in (\d{4}-\d{2})/g)) {
      const expected = musicRowsIn({ lo: -Infinity, hi: Infinity }).filter((r) => r.artist === meta.artist && new Date(r.ts * 1000).toISOString().startsWith(claim[2])).length;
      same(Number(claim[1].replace(/,/g, "")), expected, `${edge.id} monthly artist evidence is stale`);
    }
  }
  if (typeof meta.platform === "string" && !meta.platform.includes("->")) {
    for (const claim of evidence.matchAll(/(\d[\d,]*)\s+plays in CH(\d)/gi)) {
      const expected = musicRowsIn(chapter(`ch${claim[2]}`)).filter((r) => r.platform === meta.platform).length;
      same(Number(claim[1].replace(/,/g, "")), expected, `${edge.id} platform evidence is stale`);
    }
  }
  if (meta.platform === "android->mac") {
    const macTotal = musicRowsIn({ lo: -Infinity, hi: Infinity }).filter((r) => r.platform === "mac").length;
    const claim = evidence.match(/Mac records total ([\d,]+)/i);
    if (claim) same(Number(claim[1].replace(/,/g, "")), macTotal, `${edge.id} Mac total evidence is stale`);
  }
  const chapterNumberClaims = [...evidence.matchAll(/(\d[\d,]*)\s+(?:times|plays) in Chapter (\d)/g)];
  for (const claim of chapterNumberClaims) {
    const chapterId = `ch${claim[2]}`; const artist = typeof meta.artist === "string" ? meta.artist : null;
    if (artist) same(Number(claim[1].replace(/,/g, "")), musicRowsIn(chapter(chapterId)).filter((r) => r.artist === artist).length, `${edge.id} evidence count for ${artist} is stale`);
  }
  if (Array.isArray(meta.ch) && meta.ch.length > 0) {
    const endpointHasChapter = (ts: number) => (meta.ch as string[]).some((chapterId) => {
      const c = chapter(chapterId); return c.lo <= ts && ts < c.hi;
    });
    const outside = !endpointHasChapter(a.ts) || !endpointHasChapter(b.ts);
    ok(!outside || meta.crossChapter === true, `${edge.id} references an out-of-span endpoint without crossChapter:true`);
  }
}

for (const [chapterId, trail] of Object.entries(story.trails as Record<string, AnyRecord>)) {
  const c = chapter(chapterId);
  for (let i = 0; i < trail.nodes.length; i += 1) {
    const node = trail.nodes[i]; get(node.receiptId);
    if (!node.nextId) { ok(node.edgeId === null && node.rule === null, `${chapterId} terminal trail node has an edge`); continue; }
    const edge = edgeById.get(node.edgeId);
    ok(Boolean(edge), `${chapterId} trail points to missing edge ${node.edgeId}`);
    ok((edge.a === node.receiptId && edge.b === node.nextId) || (edge.b === node.receiptId && edge.a === node.nextId), `${chapterId} trail edge endpoints do not match`);
    same(node.rule, edge.rule, `${chapterId} trail rule disagrees with edge`);
    const next = get(node.nextId);
    ok(c.lo <= next.ts && next.ts < c.hi || edge.meta?.crossChapter === true, `${chapterId} out-of-span trail node lacks crossChapter exception`);
  }
}

for (const [id, seedReceipt] of Object.entries(seed as Record<string, AnyRecord>)) {
  const source = get(id);
  same(seedReceipt.ts, source.ts, `${id} seed timestamp differs from bundle`);
  same(seedReceipt.title, source.kind === "music" ? source.track : source.subcategory || source.category, `${id} seed title differs from bundle`);
  if (source.kind === "music") {
    same(seedReceipt.music.artist, source.artist, `${id} seed artist differs`); same(seedReceipt.music.album, source.album, `${id} seed album differs`); same(seedReceipt.music.platform, source.platform, `${id} seed platform differs`); same(seedReceipt.music.reasonStart, source.rs, `${id} seed reasonStart differs`); same(seedReceipt.music.reasonEnd, source.re, `${id} seed reasonEnd differs`); same(seedReceipt.music.msPlayed, source.ms, `${id} seed duration differs`); same(seedReceipt.music.shuffle, null, `${id} seed shuffle must remain unknown because the packed source has no shuffle column`);
  } else {
    same(seedReceipt.transaction.category, source.category, `${id} seed category differs`); same(seedReceipt.transaction.subcategory, source.subcategory, `${id} seed subcategory differs`); same(seedReceipt.transaction.note, source.note, `${id} seed note differs`); same(seedReceipt.transaction.amount, source.amount, `${id} seed amount differs`);
  }
}

console.log(`verify-data: ${checks} assertions passed; ${story.edges.length} edges, ${Object.keys(seed).length} seed receipts, ${spTs.length + hhRows} packed rows checked.`);

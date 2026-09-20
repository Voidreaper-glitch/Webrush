import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeTimestamps } from "../src/archive-codec.ts";

type AnyRecord = Record<string, any>;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const storyPath = resolve(root, "src/storyData.json");
const publicStoryPath = resolve(root, "public/data/story.json");
const seedPath = resolve(root, "src/trailReceipts.json");
const bundle = JSON.parse(await readFile(resolve(root, "public/data/receipts.json"), "utf8")) as AnyRecord;
const story = JSON.parse(await readFile(storyPath, "utf8")) as AnyRecord;
const seed = JSON.parse(await readFile(seedPath, "utf8")) as AnyRecord;
const spotify = bundle.spotify as AnyRecord;
const household = bundle.household as AnyRecord;
const dicts = bundle.dicts as AnyRecord;
const spotifyTs = decodeTimestamps(spotify.ts as number[], Boolean(bundle.meta?.encoding?.tsDelta));

const chapterById = new Map<string, AnyRecord>(story.chapters.map((c: AnyRecord) => [c.id, c]));
const sourceRecord = (id: string): AnyRecord => {
  const [prefix, raw] = id.split("-");
  const row = Number(raw) - 1;
  if (prefix === "SP") {
    const a = spotify.a[row];
    return {
      id, ts: spotifyTs[row], kind: "music",
      track: dicts.track[spotify.t[row]], artist: dicts.artist[a], album: dicts.album[spotify.al[row]],
      platform: dicts.platform[spotify.p[row]], ms: spotify.ms[row],
      rs: spotify.rs[row] >= 0 ? dicts.reason_start[spotify.rs[row]] : "unknown",
      re: spotify.re[row] >= 0 ? dicts.reason_end[spotify.re[row]] : "unknown",
      skipped: spotify.sk[row] === 1,
    };
  }
  return {
    id, ts: household.dt[row], kind: "transaction",
    category: dicts.hh_category[household.cat[row]],
    subcategory: household.sub[row] >= 0 ? dicts.hh_subcategory[household.sub[row]] : "",
    note: household.note[row] || "", amount: household.amt[row],
    mode: dicts.hh_mode[household.mode[row]], flow: dicts.hh_ie[household.ie[row]],
  };
};
const date = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);
const chapterFor = (ts: number) => story.chapters.find((c: AnyRecord) => c.lo <= ts && ts < c.hi)?.id;
const countMusic = (field: "artist" | "platform", value: string, chapterId: string) => {
  const c = chapterById.get(chapterId)!;
  let count = 0;
  for (let i = 0; i < spotifyTs.length; i += 1) {
    if (c.lo <= spotifyTs[i] && spotifyTs[i] < c.hi && dicts[field][spotify[field === "artist" ? "a" : "p"][i]] === value) count += 1;
  }
  return count;
};

// Chapter 4's numeric bounds already include the 2021-08-07 Beatles receipt;
// make the display span agree with those authoritative epoch bounds.
for (const chapter of story.chapters as AnyRecord[]) {
  chapter.dateSpan = `${date(chapter.lo)} to ${date(chapter.hi - 1)}`;
}

// Remove duplicate rule/end-point rows, retaining the richer evidence. The
// stable IDs are assigned after this operation so they remain deterministic.
const deduped: AnyRecord[] = [];
const byKey = new Map<string, AnyRecord>();
for (const edge of story.edges as AnyRecord[]) {
  const key = `${edge.a}\u0000${edge.b}\u0000${edge.rule}`;
  const previous = byKey.get(key);
  if (!previous || String(edge.evidence).length > String(previous.evidence).length) byKey.set(key, edge);
}
for (const edge of story.edges as AnyRecord[]) {
  const key = `${edge.a}\u0000${edge.b}\u0000${edge.rule}`;
  if (byKey.get(key) === edge) deduped.push(edge);
}
story.edges = deduped;
for (const [index, edge] of (story.edges as AnyRecord[]).entries()) edge.id = `edge-${String(index + 1).padStart(3, "0")}`;

for (const edge of story.edges as AnyRecord[]) {
  const a = sourceRecord(edge.a);
  const b = sourceRecord(edge.b);
  const meta = (edge.meta ??= {}) as AnyRecord;
  const oldCounts = Array.isArray(meta.counts) ? [...meta.counts] : [];
  if (typeof meta.artist === "string" && Array.isArray(meta.ch)) {
    meta.counts = meta.ch.map((chapterId: string) => countMusic("artist", meta.artist, chapterId));
    // Correct chapter-numbered claims without changing month-specific claims
    // such as the Killers' 330/688 monthly comparison.
    edge.evidence = String(edge.evidence).replace(/\b\d[\d,]*(?=(?: times| plays) in Chapter (\d))/g, (_match: string, chapterNumber: string) => {
      const chapterId = `ch${chapterNumber}`;
      const index = meta.ch.indexOf(chapterId);
      return index >= 0 ? String(meta.counts[index]) : _match;
    });
  } else if (typeof meta.platform === "string" && !meta.platform.includes("->") && Array.isArray(meta.ch)) {
    meta.counts = meta.ch.map((chapterId: string) => countMusic("platform", meta.platform, chapterId));
  }

  const endpointKey = `${edge.a}->${edge.b}`;
  if (endpointKey === "SP-015163->SP-081200") {
    edge.evidence = `Both records are plays of Howard Shore. Howard Shore is played ${countMusic("artist", "Howard Shore", "ch2").toLocaleString("en-US")} times in Chapter 2 and ${countMusic("artist", "Howard Shore", "ch3").toLocaleString("en-US")} times in Chapter 3.`;
  }
  if (endpointKey === "SP-009439->HH-001674") {
    edge.meaning = "Two unrelated supplied archives describe the same calendar months; shared-person identity is unverified.";
  }
  if (endpointKey === "SP-000578->SP-004158") {
    edge.rule = "co-occurrence";
    edge.strength = "tentative";
    edge.meta = { ch: ["ch1"] };
    edge.evidence = `SP-000578 is a Hozier play on iOS (${date(a.ts)}), and SP-004158 is an early Beatles play on Android (${date(b.ts)}); both are music records in Chapter 1. No shared artist is asserted.`;
    edge.meaning = "The early archive moves from portable Hozier listening to an emerging Beatles thread.";
  }
  if (Array.isArray(meta.ch) && meta.ch.length > 0) {
    const endpointHasChapter = (ts: number) => meta.ch.some((chapterId: string) => {
      const c = chapterById.get(chapterId)!; return c.lo <= ts && ts < c.hi;
    });
    if (!endpointHasChapter(a.ts) || !endpointHasChapter(b.ts)) meta.crossChapter = true;
  }
  if (edge.a === "SP-038664" || edge.b === "SP-038664") {
    if (Array.isArray(meta.ch) && meta.ch.includes("ch4")) meta.crossChapter = true;
    if (endpointKey === "SP-038664->SP-104390") {
      edge.evidence = `SP-038664 is a Jorge Drexler play from ${date(a.ts)} and SP-104390 is a Beatles play from ${date(b.ts)}; the records connect across the Chapter 4 boundary, rather than both falling inside it.`;
      edge.meaning = "An earlier Spanish-language record is revisited alongside the long-running Beatles strand.";
    } else if (endpointKey === "SP-104880->SP-038664") {
      edge.evidence = `SP-104880 is a Joaquín Sabina play from ${date(a.ts)} and SP-038664 is a Jorge Drexler play from ${date(b.ts)}; both are Spanish-language songwriters, with the earlier record predating Chapter 4.`;
      edge.meaning = "The Spanish-language strand has an earlier recorded thread as well as its 2021 session.";
    }
  }
}

// The old hand-authored trail labels occasionally described the edge before
// the node. Derive every trail edge ID/rule from the repaired edge table.
for (const [chapterId, trail] of Object.entries(story.trails as Record<string, AnyRecord>)) {
  for (let i = 0; i < trail.nodes.length; i += 1) {
    const node = trail.nodes[i];
    if (!node.nextId) { node.edgeId = null; node.rule = null; continue; }
    const edge = (story.edges as AnyRecord[]).find((candidate) =>
      (candidate.a === node.receiptId && candidate.b === node.nextId) ||
      (candidate.b === node.receiptId && candidate.a === node.nextId));
    if (!edge) throw new Error(`no edge for ${chapterId} trail ${node.receiptId} -> ${node.nextId}`);
    node.edgeId = edge.id;
    node.rule = edge.rule;
  }
}
const ch4Nodes = story.trails.ch4.nodes as AnyRecord[];
const oldDrexler = ch4Nodes.find((node) => node.receiptId === "SP-038664");
if (oldDrexler) oldDrexler.why = "A Jorge Drexler play from 2018-03-03; an earlier Spanish-language thread reappears across the Chapter 4 boundary.";
const oldBeatles = ch4Nodes.find((node) => node.receiptId === "SP-104390");
if (oldBeatles) oldBeatles.why = "First Beatles play in this chapter, 2021-08-07: 2,812 plays versus 4,844 before.";
if (story.trail?.ch2?.[1]) story.trail.ch2[1].why = "The first Netflix subscription in the ledger, dated 2016-10-07, before the Beatles chapter begins in 2017.";

// Refresh the seed's source-derived fields from the same bundle used above.
for (const [id, receipt] of Object.entries(seed as Record<string, AnyRecord>)) {
  const source = sourceRecord(id);
  receipt.ts = source.ts;
  if (source.kind === "music") {
    receipt.title = source.track; receipt.subtitle = source.artist;
    receipt.music = {
      track: source.track, artist: source.artist, album: source.album, platform: source.platform,
      msPlayed: source.ms, reasonStart: source.rs, reasonEnd: source.re,
      skipped: source.skipped, shuffle: null,
    };
    receipt.searchText = [source.track, source.artist, source.album, source.platform].join(" ").toLowerCase();
  } else {
    receipt.title = source.subcategory || source.category; receipt.subtitle = source.note;
    receipt.transaction = {
      category: source.category, subcategory: source.subcategory, note: source.note,
      amount: source.amount, mode: source.mode, flow: source.flow, currency: "INR",
    };
    receipt.searchText = [source.category, source.subcategory, source.note, source.mode, source.flow, source.amount].filter(Boolean).join(" ").toLowerCase();
  }
}
const formattedStory = `${JSON.stringify(story, null, 2)}\n`;
await writeFile(storyPath, formattedStory);
await writeFile(publicStoryPath, formattedStory);
await writeFile(seedPath, `${JSON.stringify(seed, null, 2)}\n`);
console.log(`Repaired ${story.edges.length} unique edges, ${Object.keys(seed).length} seed receipts, and synchronized both story copies.`);

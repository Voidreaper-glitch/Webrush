/**
 * AFTERPRINT — archive loader.
 *
 * Reads the two one-person sources as a single normalized archive. Nothing is
 * invented here: every field comes from the supplied CSVs, missing values fall
 * back to explicit empty strings or null, and no row is ever dropped.
 *
 * The fraud file is deliberately excluded — it describes 1,330 different card
 * holders, not one person. See README.
 */

import type {
  ArchiveBundle,
  Chapter,
  Edge,
  MusicDetail,
  Receipt,
  Story,
  TransactionDetail,
} from "./types";

export const ARCHIVE_URL = "./data/receipts.json";
export const STORY_URL = "./data/story.json";

export interface Archive {
  receipts: Receipt[];
  chapters: Chapter[];
  edges: Edge[];
  story: Story;
  /** Look up any receipt by id in O(1). */
  byId: Map<string, Receipt>;
  /** True totals straight from the source metadata. Never sum chapters. */
  totals: { spotify: number; household: number; all: number };
  sources: Record<string, { file: string; rows: number; idPrefix: string }>;
}

const noNaN = (n: number) => (Number.isFinite(n) ? n : 0);

function musicDetail(
  d: ArchiveBundle["dicts"],
  t: number,
  a: number,
  al: number,
  p: number,
  ms: number,
  rs: number,
  re: number,
  sk: number
): MusicDetail {
  return {
    track: t >= 0 ? d.track[t] : "",
    artist: a >= 0 ? d.artist[a] : "",
    album: al >= 0 ? d.album[al] : "",
    platform: p >= 0 ? d.platform[p] : "unknown",
    msPlayed: noNaN(ms),
    reasonStart: rs >= 0 ? d.reason_start[rs] : "unknown",
    reasonEnd: re >= 0 ? d.reason_end[re] : "unknown",
    skipped: sk === 1,
    shuffle: false,
  };
}

function fmtMoney(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function transactionDetail(
  d: ArchiveBundle["dicts"],
  cat: number,
  sub: number,
  note: string,
  amt: number | null,
  mode: number,
  flow: number
): TransactionDetail {
  return {
    category: cat >= 0 ? d.hh_category[cat] : "Uncategorized",
    subcategory: sub >= 0 ? d.hh_subcategory[sub] : "",
    note: note || "",
    amount: amt,
    mode: mode >= 0 ? d.hh_mode[mode] : "unknown",
    flow: flow >= 0 ? d.hh_ie[flow] : "",
    currency: "INR",
  };
}

/** Expand the columnar bundle into typed receipts. */
export function expandBundle(bundle: ArchiveBundle): Receipt[] {
  const d = bundle.dicts;
  const sp = bundle.spotify;
  const hh = bundle.household;
  const hasUriDict = Array.isArray(d.uri) && (d.uri as string[]).length > 0;

  const n = (sp.i as string[]).length;
  const out: Receipt[] = new Array(n + (hh.dt as number[]).length);

  // Timestamps are stored as a cumulative delta sequence when packed; rebuild
  // the absolute values in one pass. This is lossless.
  const tsCol = sp.ts as number[];
  const isDelta = !!bundle.meta.encoding?.tsDelta;
  const absTs: number[] = new Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc = i === 0 && !isDelta ? tsCol[0] : acc + tsCol[i];
    if (i === 0) acc = tsCol[0];
    absTs[i] = acc;
  }

  let ptr = 0;
  for (let i = 0; i < n; i++) {
    const ts = absTs[i];
    const a = (sp.a as number[])[i];
    const detail = musicDetail(
      d,
      (sp.t as number[])[i],
      a,
      (sp.al as number[])[i],
      (sp.p as number[])[i],
      (sp.ms as number[])[i],
      (sp.rs as number[])[i],
      (sp.re as number[])[i],
      (sp.sk as number[])[i]
    );
    const id = `SP-${String(i + 1).padStart(6, "0")}`;
    const uriIdx = (sp.i as number[])[i];
    const uri = hasUriDict && typeof uriIdx === "number"
      ? (d.uri as string[])[uriIdx] ?? ""
      : "";
    const searchText = [detail.track, detail.artist, detail.album, detail.platform, uri]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    out[ptr++] = {
      id,
      source: "spotify",
      kind: "music",
      ts,
      title: detail.track || "Untitled track",
      subtitle: detail.artist,
      searchText,
      music: detail,
      transaction: null,
    };
  }

  const m = (hh.dt as number[]).length;
  for (let i = 0; i < m; i++) {
    const ts = (hh.dt as number[])[i];
    const detail = transactionDetail(
      d,
      (hh.cat as number[])[i],
      (hh.sub as number[])[i],
      String((hh.note as string[])[i] ?? ""),
      (hh.amt as (number | null)[])[i],
      (hh.mode as number[])[i],
      (hh.ie as number[])[i]
    );
    const id = `HH-${String(i + 1).padStart(6, "0")}`;
    const searchText = [
      detail.category,
      detail.subcategory,
      detail.note,
      detail.mode,
      detail.flow,
      detail.amount !== null ? String(detail.amount) : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    out[ptr++] = {
      id,
      source: "household",
      kind: "transaction",
      ts,
      title: detail.subcategory || detail.category,
      subtitle: detail.note,
      searchText,
      music: null,
      transaction: detail,
    };
  }

  return out;
}

/** Load both bundles and build the lookup index. */
export async function loadArchive(): Promise<Archive> {
  const [bundleRes, storyRes] = await Promise.all([
    fetch(ARCHIVE_URL),
    fetch(STORY_URL),
  ]);
  if (!bundleRes.ok) throw new Error(`archive load failed: ${bundleRes.status}`);
  if (!storyRes.ok) throw new Error(`story load failed: ${storyRes.status}`);

  const bundle = (await bundleRes.json()) as ArchiveBundle;
  const story = (await storyRes.json()) as Story;

  const receipts = expandBundle(bundle);
  const byId = new Map<string, Receipt>();
  for (const r of receipts) byId.set(r.id, r);

  return {
    receipts,
    chapters: story.chapters,
    edges: story.edges,
    story,
    byId,
    totals: {
      spotify: bundle.meta.sources.spotify.rows,
      household: bundle.meta.sources.household.rows,
      all: bundle.meta.sources.spotify.rows + bundle.meta.sources.household.rows,
    },
    sources: bundle.meta.sources,
  };
}

/* ---------------------------- derived helpers ---------------------------- */

export function dateLabel(ts: number): string {
  if (!ts || ts < 0) return "Undated";
  return new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateTimeLabel(ts: number): string {
  if (!ts || ts < 0) return "Undated";
  const d = new Date(ts * 1000);
  return (
    d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
}

export function durationLabel(ms: number): string {
  if (!ms || ms <= 0) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

export function hoursLabel(h: number): string {
  return h.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "h";
}

export function pctLabel(p: number): string {
  return p.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%";
}

export { fmtMoney };

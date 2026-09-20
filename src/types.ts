/**
 * AFTERPRINT — data archive types.
 *
 * One receipt = one row from one of the two supplied one-person sources.
 * Source IDs are the 1-based row numbers of the original CSVs, so any claim
 * in the UI can be traced back to an exact line in the supplied data.
 *
 * The archive is loaded as a columnar compressed JSON and expanded at load
 * time; 152,321 records stay cheap because nothing is copied per render.
 */

export type ReceiptKind = "music" | "transaction";

/** A single normalized receipt. */
export interface Receipt {
  /** Stable internal key: SP-000001 / HH-000001. */
  id: string;
  /** Which supplied file this record came from. */
  source: "spotify" | "household";
  /** Normalized activity type. */
  kind: ReceiptKind;
  /** UTC epoch seconds. -1 would mean undated; the supplied data has none. */
  ts: number;
  /** Display title — track name, or transaction category + subcategory. */
  title: string;
  /** Secondary line — artist, or the free-text note. */
  subtitle: string;
  /** Long form, all meaningful text fields concatenated for search. */
  searchText: string;
  /** Typed detail block. Only the block matching `kind` is populated. */
  music: MusicDetail | null;
  transaction: TransactionDetail | null;
}

export interface MusicDetail {
  artist: string;
  album: string;
  track: string;
  platform: string;
  msPlayed: number;
  reasonStart: string;
  reasonEnd: string;
  skipped: boolean;
  shuffle: boolean;
}

export interface TransactionDetail {
  category: string;
  subcategory: string;
  note: string;
  amount: number | null;
  mode: string;
  flow: string;
  currency: string;
}

/** Shape of the compressed bundle on disk. */
export interface ArchiveBundle {
  meta: {
    sources: Record<string, { file: string; rows: number; idPrefix: string }>;
  };
  dicts: Record<string, string[]>;
  spotify: Record<string, number[] | string[]>;
  household: Record<string, number[] | string[] | (number | null)[]>;
}

/** A chapter: an evidence-backed reading of a span of the archive. */
export interface Chapter {
  id: string;
  title: string;
  dateSpan: string;
  /** Inclusive lower bound, exclusive upper bound (epoch seconds). */
  lo: number;
  hi: number;
  hook: string;
  motif: string;
  seed: string;
  counts: {
    plays: number;
    artists: number;
    hours: number;
    skipRate: number;
    transactions: number;
  };
  topArtists: { artist: string; plays: number }[];
  platforms: Record<string, number>;
  types: string[];
}

export type EdgeRule =
  | "same-artist"
  | "same-album"
  | "same-platform"
  | "same-subcategory"
  | "same-venue"
  | "same-language-strand"
  | "temporal+theme"
  | "co-occurrence"
  | "device-shift";

export type EdgeStrength = "direct" | "tentative";

/** A relationship between two receipts, with its evidence attached. */
export interface Edge {
  a: string;
  b: string;
  rule: EdgeRule;
  /** The exact shared detail. Shown verbatim in "Why this connection?". */
  evidence: string;
  strength: EdgeStrength;
  /** What the link might mean. Interpretation, clearly separated. */
  meaning: string;
  meta: Record<string, unknown>;
}

/** One node in a chapter's clue trail. */
export interface TrailNode {
  receiptId: string;
  clue: string;
  why: string;
  rule: EdgeRule | null;
  nextId: string | null;
  edgeId: string | null;
}

export interface Story {
  chapters: Chapter[];
  edges: Edge[];
  trails: Record<string, { start: string; nodes: TrailNode[] }>;
}

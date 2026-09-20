/**
 * AFTERPRINT — derived selectors.
 *
 * Every count shown in the UI is computed here from the archive, never stored
 * in a second place that could drift. Selectors are memo-free and cheap
 * because they iterate once; the archive is static after load.
 */

import type { Chapter, Edge, Receipt, ReceiptKind } from "./types";
import type { Archive } from "./data";

export function inChapter(r: Receipt, lo: number, hi: number): boolean {
  return r.ts >= lo && r.ts < hi;
}

/** Receipts belonging to a chapter. Overlap between chapters is permitted. */
export function chapterReceipts(arc: Archive, chapterId: string): Receipt[] {
  const ch = arc.chapters.find((c: Chapter) => c.id === chapterId);
  if (!ch) return [];
  return arc.receipts.filter((r: Receipt) => inChapter(r, ch.lo, ch.hi));
}

/** Edges touching a chapter's span. */
export function chapterEdges(arc: Archive, chapterId: string): Edge[] {
  const ids = new Set(chapterReceipts(arc, chapterId).map((r) => r.id));
  return arc.edges.filter((e) => ids.has(e.a) && ids.has(e.b));
}

/** Edges touching a given receipt, either direction. */
export function edgesFor(arc: Archive, id: string): Edge[] {
  return arc.edges.filter((e) => e.a === id || e.b === id);
}

/** The other end of an edge. */
export function otherEnd(e: Edge, id: string): string {
  return e.a === id ? e.b : e.a;
}

/**
 * Related receipts, ranked. Direct matches first, tentative second.
 * Falls back to [] honestly when nothing is known.
 */
export function relatedReceipts(arc: Archive, id: string): Edge[] {
  return edgesFor(arc, id).sort((a, b) => {
    if (a.strength === b.strength) return 0;
    return a.strength === "direct" ? -1 : 1;
  });
}

export function searchArchive(
  arc: Archive,
  query: string,
  kinds: ReceiptKind[] | null,
  chapterId: string | null
): Receipt[] {
  const q = query.trim().toLowerCase();
  let rows = arc.receipts;

  if (chapterId) {
    const ch = arc.chapters.find((c) => c.id === chapterId);
    if (ch) rows = rows.filter((r) => inChapter(r, ch.lo, ch.hi));
  }
  if (kinds && kinds.length > 0) {
    const set = new Set(kinds);
    rows = rows.filter((r) => set.has(r.kind));
  }
  if (q) {
    rows = rows.filter((r) => r.searchText.includes(q));
  }
  return rows;
}

export const KIND_LABEL: Record<ReceiptKind, string> = {
  music: "Music plays",
  transaction: "Transactions",
};

export const KIND_LABEL_SINGULAR: Record<ReceiptKind, string> = {
  music: "Play",
  transaction: "Transaction",
};

/**
 * AFTERPRINT — Receipt Explorer.
 *
 * The evidence layer: every supplied receipt, searchable and filterable.
 * Search runs over normalized text fields, filters combine, counts are live,
 * and a chapter restriction is visible and clearable. No row is dropped
 * because a field is missing — missing values render as explicit fallbacks.
 */

import { useMemo } from "react";
import type { ReceiptKind } from "../types";
import type { Archive } from "../data";
import { dateLabel, fmtMoney } from "../data";
import { KIND_LABEL } from "../selectors";

interface Props {
  archive: Archive;
  query: string;
  kinds: ReceiptKind[];
  chapterScope: string | null;
  openId: string | null;
  onQuery: (q: string) => void;
  onKinds: (k: ReceiptKind[]) => void;
  onScope: (id: string | null) => void;
  onOpen: (id: string) => void;
}

const ALL_KINDS: ReceiptKind[] = ["music", "transaction"];
const PAGE = 60;

export function Explorer({
  archive,
  query,
  kinds,
  chapterScope,
  openId,
  onQuery,
  onKinds,
  onScope,
  onOpen,
}: Props) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let r = archive.receipts;

    if (chapterScope) {
      const ch = archive.chapters.find((c) => c.id === chapterScope);
      if (ch) r = r.filter((x) => x.ts >= ch.lo && x.ts < ch.hi);
    }
    if (kinds.length) {
      const s = new Set(kinds);
      r = r.filter((x) => s.has(x.kind));
    }
    if (q) r = r.filter((x) => x.searchText.includes(q));

    return r.sort((a, b) => b.ts - a.ts);
  }, [archive, query, kinds, chapterScope]);

  const scopeChapter = chapterScope
    ? archive.chapters.find((c) => c.id === chapterScope)
    : null;

  return (
    <section className="section" id="explorer" aria-labelledby="explorer-h">
      <div className="shell">
        <div className="section-head">
          <div className="eyebrow">
            <span className="eyebrow-num">03</span>
            <span className="rule-dash" aria-hidden="true" />
            <span className="t-label">The Receipt Explorer</span>
          </div>
          <h2 id="explorer-h" className="t-statement">
            Every receipt. Including the ones outside every chapter.
          </h2>
          <p className="t-lead">
            {archive.totals.all.toLocaleString()} records from two supplied
            sources. Search and filters combine; the count below is live and
            always reconciles with the input data.
          </p>
        </div>

        <div className="explorer-controls">
          <div className="field">
            <label className="t-label" htmlFor="q">
              Search receipts
            </label>
            <input
              id="q"
              className="input"
              type="search"
              placeholder="artist, track, category, note…"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              onQuery("");
              onKinds([]);
              onScope(null);
            }}
            disabled={!query && !kinds.length && !chapterScope}
          >
            Clear all
          </button>
        </div>

        <div className="filterbar" role="group" aria-label="Filter by activity type">
          <span className="t-label" style={{ marginRight: "0.25rem" }}>
            Type
          </span>
          {ALL_KINDS.map((k) => (
            <button
              key={k}
              className="toggle"
              aria-pressed={kinds.includes(k)}
              onClick={() => {
                const has = kinds.includes(k);
                onKinds(has ? kinds.filter((x) => x !== k) : [...kinds, k]);
              }}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
          {scopeChapter && (
            <button
              className="toggle"
              aria-pressed={true}
              onClick={() => onScope(null)}
              style={{ marginLeft: "0.5rem" }}
            >
              Chapter: {scopeChapter.title} · clear ✕
            </button>
          )}
        </div>

        <div className="count-line">
          <span className="t-data" style={{ fontSize: "0.72rem" }}>
            <strong style={{ color: "var(--ink-900)" }}>
              {rows.length.toLocaleString()}
            </strong>{" "}
            of {archive.totals.all.toLocaleString()} receipts
          </span>
          {scopeChapter && (
            <span className="t-data" style={{ fontSize: "0.68rem", color: "var(--text-subtle)" }}>
              restricted to “{scopeChapter.title}” ({scopeChapter.dateSpan})
            </span>
          )}
          <span className="t-data" style={{ fontSize: "0.68rem", color: "var(--text-subtle)" }}>
            showing first {Math.min(rows.length, PAGE)}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <div className="t-h3">No receipts match.</div>
            <p className="t-body" style={{ marginTop: "0.6rem", color: "var(--text-muted)" }}>
              That combination of search text and filters returns nothing in the
              archive. Loosen a filter or clear the search to restore the full
              {archive.totals.all.toLocaleString()} records.
            </p>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: "1rem" }}
              onClick={() => {
                onQuery("");
                onKinds([]);
                onScope(null);
              }}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="receipt-rows">
            {rows.slice(0, PAGE).map((r) => (
              <button
                key={r.id}
                className="row"
                aria-current={openId === r.id ? "true" : undefined}
                onClick={() => onOpen(r.id)}
                aria-label={`Open receipt ${r.id}: ${r.title}`}
              >
                <span className="row-date t-data">{dateLabel(r.ts)}</span>
                <span>
                  <span className="row-title">{r.title}</span>
                  <span className="row-sub" style={{ display: "block" }}>
                    {r.subtitle || "— no further text in the source record —"}
                  </span>
                </span>
                <span className="row-kind" data-kind={r.kind}>
                  {r.kind === "music"
                    ? r.music
                      ? r.music.artist
                      : ""
                    : fmtMoney(r.transaction ? r.transaction.amount : null)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

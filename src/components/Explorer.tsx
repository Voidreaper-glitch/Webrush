import { useDeferredValue, useMemo, useState } from "react";
import type { ReceiptKind } from "../types";
import type { Archive } from "../data";
import type { ArchiveStatus } from "../hooks/useArchive";
import { dateLabel, fmtMoney } from "../data";
import { KIND_LABEL, searchArchive } from "../selectors";

interface Props {
  archive: Archive; status: ArchiveStatus; query: string; kinds: ReceiptKind[];
  chapterScope: string | null; artist: string | null; openId: string | null;
  onQuery: (query: string) => void; onKinds: (kinds: ReceiptKind[]) => void;
  onScope: (scope: string | null) => void; onArtist: (artist: string | null) => void;
  onOpen: (id: string) => void;
}
const PAGE_SIZE = 60;
const ALL_KINDS: ReceiptKind[] = ["music", "transaction"];

export function Explorer({ archive, status, query, kinds, chapterScope, artist, openId, onQuery, onKinds, onScope, onArtist, onOpen }: Props) {
  const deferredQuery = useDeferredValue(query);
  const filterKey = JSON.stringify([deferredQuery, kinds, chapterScope, artist]);
  const [pagination, setPagination] = useState({ key: filterKey, page: 0 });
  const rows = useMemo(() => {
    const matches = searchArchive(archive, deferredQuery, kinds, chapterScope);
    return artist ? matches.filter((receipt) => receipt.music?.artist === artist) : matches;
  }, [archive, deferredQuery, kinds, chapterScope, artist]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = pagination.key === filterKey ? Math.min(pagination.page, pages - 1) : 0;
  const visibleRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const scopeChapter = archive.chapters.find((chapter) => chapter.id === chapterScope);
  const hasFilters = Boolean(query || kinds.length || chapterScope || artist);
  const clear = () => { onQuery(""); onKinds([]); onScope(null); onArtist(null); };
  const changePage = (next: number) => {
    setPagination({ key: filterKey, page: next });
    requestAnimationFrame(() => document.getElementById("results-heading")?.focus());
  };
  return <section className="section explorer-view" id="explorer" aria-labelledby="explorer-h"><div className="shell">
    <div className="section-head">
      <span className="t-label t-label-teal">The Receipt Explorer</span>
      <h2 id="explorer-h" className="t-statement">Find your own thread.</h2>
      <p className="t-lead">Search the records behind the story. Combine filters, inspect a receipt, and follow a recurring artist or category.</p>
    </div>
    <div className="explorer-controls">
      <div className="field"><label className="t-label" htmlFor="q">Search receipts</label>
        <input id="q" className="input" type="search" placeholder="artist, track, category, note…" value={query} onChange={(event) => onQuery(event.target.value)} autoComplete="off" spellCheck={false} />
      </div>
      <button className="btn btn-ghost btn-sm" onClick={clear} disabled={!hasFilters}>Clear all</button>
    </div>
    <div className="filterbar" role="group" aria-label="Filter by activity type">
      {ALL_KINDS.map((kind) => <button key={kind} className="toggle" aria-pressed={kinds.includes(kind)} onClick={() => onKinds(kinds.includes(kind) ? kinds.filter((item) => item !== kind) : [...kinds, kind])}>{KIND_LABEL[kind]}</button>)}
      {scopeChapter && <button className="toggle" aria-pressed="true" onClick={() => onScope(null)} aria-label={`Clear chapter scope ${scopeChapter.title}`}>Chapter: {scopeChapter.title} · clear ×</button>}
      {artist && <button className="toggle" aria-pressed="true" onClick={() => onArtist(null)} aria-label={`Clear artist filter ${artist}`}>Artist: {artist} · clear ×</button>}
    </div>
    {status !== "ready" && <p className="preview-notice" role="status">{status === "loading" ? "Loading the complete archive. " : "Full archive unavailable. "}Only {archive.receipts.length} curated preview receipts can be searched right now.</p>}
    <div className="count-line" id="results-heading" tabIndex={-1} aria-live="polite" aria-busy={query !== deferredQuery}>
      <span><strong>{rows.length.toLocaleString()}</strong> {status === "ready" ? `of ${archive.totals.all.toLocaleString()} receipts` : "preview matches"}</span>
      {rows.length > 0 && <span>Showing {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, rows.length).toLocaleString()}</span>}
    </div>
    {rows.length === 0 ? <div className="empty"><h3 className="t-h3">{status === "ready" ? "No receipts match." : "No preview receipts match."}</h3><p className="t-body">{status === "ready" ? "Try a different search or clear a filter." : "The complete archive has not loaded; this is not a search of all records."}</p><button className="btn btn-ghost btn-sm" onClick={clear}>Clear all filters</button></div> : <>
      <div className="receipt-rows">{visibleRows.map((receipt) => <button key={receipt.id} className="row" aria-current={openId === receipt.id ? "true" : undefined} onClick={() => onOpen(receipt.id)} aria-label={`Open receipt ${receipt.id}: ${receipt.title}`}>
        <span className="row-date t-data">{dateLabel(receipt.ts)}</span>
        <span className="row-content"><span className="row-title">{receipt.title}</span><span className="row-sub">{receipt.subtitle || "No further text in the source record"}</span></span>
        <span className="row-kind" data-kind={receipt.kind}>{receipt.music?.platform || fmtMoney(receipt.transaction?.amount ?? null)}</span>
      </button>)}</div>
      <nav className="pagination" aria-label="Receipt pages">
        <button className="btn btn-ghost" onClick={() => changePage(page - 1)} disabled={page === 0}>Previous page</button>
        <span className="t-data">Page {page + 1} of {pages.toLocaleString()}</span>
        <button className="btn btn-ghost" onClick={() => changePage(page + 1)} disabled={page >= pages - 1}>Next page</button>
      </nav>
    </>}
  </div></section>;
}

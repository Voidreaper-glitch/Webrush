/**
 * AFTERPRINT — Chapter Atlas.
 *
 * The journey as a compact, interactive ribbon plus a catalogue list.
 * The ribbon is an SVG projection of the same chapter spans the list shows,
 * so nothing exists only inside a graphic. On small screens the list carries
 * everything and the ribbon stays legible.
 */

import type { Chapter } from "../types";
import type { Archive } from "../data";
import { hoursLabel, pctLabel } from "../data";

interface Props {
  archive: Archive;
  activeChapter: string | null;
  onPick: (id: string) => void;
  onExploreArtist: (artist: string, chapter: string | null) => void;
}

export function ChapterAtlas({ archive, activeChapter, onPick, onExploreArtist }: Props) {
  const chapters = archive.chapters;

  return (
    <section className="section" id="atlas" aria-labelledby="atlas-h">
      <div className="shell">
        <div className="section-head">
          <div className="eyebrow">
            <span className="eyebrow-num">01</span>
            <span className="rule-dash" aria-hidden="true" />
            <span className="t-label">The Chapter Atlas</span>
          </div>
          <h2 id="atlas-h" className="t-statement">
            Four chapters. Different rhythms.
          </h2>
          <p className="t-lead">
            Each chapter is a defensible reading of real receipts — one motif the
            records support, with its span, count and activity types shown.
            Chapters may overlap; their counts are never summed into the archive
            total.
          </p>
        </div>

        <Ribbon chapters={chapters} active={activeChapter} onPick={onPick} />

        <div className="atlas-list">
          {chapters.map((c, i) => (
            <ChapterCard
              key={c.id}
              chapter={c}
              index={i + 1}
              active={activeChapter === c.id}
              onPick={onPick}
              onExploreArtist={onExploreArtist}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Ribbon({
  chapters,
  active,
  onPick,
}: {
  chapters: Chapter[];
  active: string | null;
  onPick: (id: string) => void;
}) {
  const MIN_DATE = Math.min(...chapters.map((chapter) => chapter.lo));
  const MAX_DATE = Math.max(...chapters.map((chapter) => chapter.hi));
  const span = MAX_DATE - MIN_DATE;
  const pos = (t: number) => ((t - MIN_DATE) / span) * 100;

  const W = 1000;
  const H = 84;
  const trackY = 36;
  const barH = 24;

  return (
    <div className="ribbon-wrap">
      <div
        className="t-label"
        style={{
          marginBottom: "0.6rem",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem 1rem",
        }}
      >
        <span>2013 — 2024 · select a span to open its chapter</span>
        <span className="t-label-teal">{chapters.length} evidence-backed chapters</span>
      </div>

      <svg
        className="ribbon"
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label="Chapter spans across 2013 to 2024"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1={trackY + barH + 9}
          x2={W}
          y2={trackY + barH + 9}
          stroke="var(--rule-strong)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {chapters.map((c, i) => {
          const x = (pos(c.lo) / 100) * W;
          const w = Math.max(((pos(c.hi) - pos(c.lo)) / 100) * W, 6);
          const isActive = active === c.id;
          return (
            <g key={c.id}>
              <rect
                className="ribbon-bar"
                x={x}
                y={trackY}
                width={Math.max(w - 3, 5)}
                height={barH}
                fill={isActive ? "var(--teal-700)" : "var(--teal-400)"}
                opacity={isActive ? 1 : 0.55}
                rx="2"
                onClick={() => onPick(c.id)}
                tabIndex={0}
                role="button"
                aria-label={`Open chapter ${i + 1}: ${c.title}, ${c.dateSpan}, ${c.counts.plays} plays`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick(c.id);
                  }
                }}
              />
              <text
                x={x + 5}
                y={trackY - 8}
                fontSize="11"
                fill="var(--text-subtle)"
                style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}
              >
                {String(i + 1).padStart(2, "0")} · {c.title}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Accessible button switcher on mobile viewports */}
      <div
        className="mobile-chapter-grid"
        role="group"
        aria-label="Chapter quick navigation"
        style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}
      >
        {chapters.map((c, i) => {
          const isActive = active === c.id;
          return (
            <button
              key={c.id}
              className="btn btn-ghost btn-sm"
              style={{
                minHeight: "44px",
                justifyContent: "flex-start",
                borderColor: isActive ? "var(--teal-700)" : undefined,
                background: isActive ? "var(--direct-bg)" : undefined,
                color: isActive ? "var(--teal-800)" : undefined,
                fontWeight: isActive ? 600 : 400,
              }}
              onClick={() => onPick(c.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="t-data">{String(i + 1).padStart(2, "0")}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Accessible equivalent of the graphic above */}
      <ul className="sr-only">
        {chapters.map((c, i) => (
          <li key={c.id}>
            Chapter {i + 1}: {c.title}, {c.dateSpan}, {c.counts.plays} plays,{" "}
            {c.counts.artists} artists.{" "}
            
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChapterCard({
  chapter,
  index,
  active,
  onPick,
  onExploreArtist,
}: {
  chapter: Chapter;
  index: number;
  active: boolean;
  onPick: (id: string) => void;
  onExploreArtist: (artist: string, chapter: string | null) => void;
}) {
  const mixed = chapter.counts.transactions > 0;

  return (
    <article
      className="chapter-card"
      data-active={active}
      data-mixed={mixed}
      aria-labelledby={`ch-${chapter.id}-h`}
    >
      <span className="ch-num" aria-hidden="true">
        {String(index).padStart(2, "0")}
      </span>

      <div style={{ paddingRight: "clamp(2rem, 5vw, 3.5rem)" }}>
        <h3 id={`ch-${chapter.id}-h`} className="t-h2">
          {chapter.title}
        </h3>
        <p className="t-lead" style={{ marginTop: "0.7rem" }}>
          {chapter.hook}
        </p>
        <p className="t-body" style={{ marginTop: "0.6rem" }}>
          {chapter.motif}
        </p>

        <div className="ch-meta">
          <span>{chapter.dateSpan}</span>
          <span>{chapter.counts.plays.toLocaleString()} plays</span>
          <span>{chapter.counts.artists.toLocaleString()} artists</span>
          <span>{hoursLabel(chapter.counts.hours)} listened</span>
          <span>skip {pctLabel(chapter.counts.skipRate)}</span>
          {mixed && (
            <span>
              {chapter.counts.transactions.toLocaleString()} transactions
            </span>
          )}
        </div>

        <div className="ch-chiprow">
          {chapter.topArtists.slice(0, 3).map((a) => (
            <button className="chip motif-chip" data-kind="music" key={a.artist} onClick={() => onExploreArtist(a.artist, chapter.id)} aria-label={`Explore ${a.artist} in ${chapter.title}`}>
              {a.artist} · {a.plays.toLocaleString()} ↗
            </button>
          ))}
          {mixed && (
            <span className="chip" data-kind="transaction">
              ledger overlap
            </span>
          )}
        </div>
      </div>

      <div className="ch-side">
        <button
          className="btn"
          onClick={() => onPick(chapter.id)}
          aria-pressed={active}
          aria-label={`Explore chapter ${index}: ${chapter.title}`}
        >
          Explore this chapter →
        </button>
      </div>
    </article>
  );
}
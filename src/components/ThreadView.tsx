/**
 * AFTERPRINT — Follow the Thread.
 *
 * The signature interaction. Opening a chapter drops the user on the first
 * clue with its evidence panel open. Each step shows which two receipts are
 * connected, the exact shared detail, whether the link is direct or
 * tentative, and what it might mean in this chapter.
 *
 * The visual trail is a projection of the same edges the accessible list
 * describes — never a decorative graph.
 */

import { Fragment, useMemo } from "react";
import type { Edge, Receipt, TrailNode } from "../types";
import type { Archive } from "../data";
import { dateLabel, dateTimeLabel, durationLabel, fmtMoney } from "../data";

interface Props {
  archive: Archive;
  chapterId: string;
  path: string[];
  onJump: (id: string) => void;
  onBack: () => void;
  onReset: () => void;
  onInspect: (id: string) => void;
}

export function ThreadView({
  archive,
  chapterId,
  path,
  onJump,
  onBack,
  onReset,
  onInspect,
}: Props) {
  const chapter = archive.chapters.find((c) => c.id === chapterId);
  const trail = archive.story.trails[chapterId];

  const { nodes, currentId } = useMemo(() => {
    if (!trail) return { nodes: [] as TrailNode[], currentId: null as string | null };
    const ids = new Set(trail.nodes.map((n: TrailNode) => n.receiptId));
    const cur = path.find((p: string) => ids.has(p)) ?? trail.start;
    return { nodes: trail.nodes, currentId: cur };
  }, [trail, path]);

  if (!chapter) return null;

  const current = currentId ? archive.byId.get(currentId) : undefined;
  const currentEdge = useMemo(() => {
    if (!currentId) return null;
    const idx = nodes.findIndex((n: TrailNode) => n.receiptId === currentId);
    if (idx <= 0) return null;
    const prev = nodes[idx - 1];
    return (
      archive.edges.find(
        (e: Edge) =>
          (e.a === prev.receiptId && e.b === currentId) ||
          (e.b === prev.receiptId && e.a === currentId)
      ) ?? null
    );
  }, [currentId, nodes, archive]);

  const idx = nodes.findIndex((n: TrailNode) => n.receiptId === currentId);
  const nextNode = idx >= 0 && idx + 1 < nodes.length ? nodes[idx + 1] : null;

  return (
    <section className="section" id="thread" aria-labelledby="thread-h">
      <div className="shell">
        <div className="section-head">
          <div className="eyebrow">
            <span className="eyebrow-num">02</span>
            <span className="rule-dash" aria-hidden="true" />
            <span className="t-label">
              Follow the Thread · {chapter.title}
            </span>
          </div>
          <h2 id="thread-h" className="t-statement">
            Why do these moments belong together?
          </h2>
          <p className="t-lead">
            Each step is a real connection with its evidence attached. Direct
            matches say so. Tentative ones say that too — and nothing here is
            presented as more than the receipts support.
          </p>
        </div>

        <div className="workspace">
          {/* ---------------- clue rail ---------------- */}
          <div>
            <div className="crumbs" role="group" aria-label="Trail path">
              <span className="t-label" style={{ marginRight: "0.3rem" }}>
                Path
              </span>
              {path.length === 0 && (
                <span className="crumb" aria-current="page">
                  start
                </span>
              )}
              {path.map((pid, i) => {
                const r: Receipt | undefined = archive.byId.get(pid);
                return (
                  <Fragment key={`${pid}-${i}`}>
                    {i > 0 && <span className="crumb-sep" aria-hidden="true">›</span>}
                    <button
                      className="crumb"
                      onClick={() => onJump(pid)}
                      aria-current={i === path.length - 1 ? "page" : undefined}
                    >
                      {r ? `${r.id}` : pid}
                    </button>
                  </Fragment>
                );
              })}
              <span style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-sm" onClick={onBack} disabled={path.length <= 1}>
                ← Back
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={onReset}
                disabled={path.length === 0}
              >
                Reset
              </button>
            </div>

            <ul className="trail-list">
              {nodes.map((n: TrailNode, i: number) => {
                const r: Receipt | undefined = archive.byId.get(n.receiptId);
                const isCur = n.receiptId === currentId;
                const done = i < idx;
                return (
                  <li key={n.receiptId}>
                    <button
                      className="trail-node"
                      onClick={() => onJump(n.receiptId)}
                      aria-current={isCur ? "true" : undefined}
                      aria-label={`Clue ${i + 1}: ${n.clue}${isCur ? " (current)" : ""}`}
                    >
                      <span className="trail-dot" aria-hidden="true" />
                      <span>
                        <span
                          className="t-label"
                          style={{
                            color: isCur
                              ? "var(--teal-700)"
                              : done
                              ? "var(--text-subtle)"
                              : "var(--text-subtle)",
                          }}
                        >
                          Clue {String(i + 1).padStart(2, "0")}
                          {isCur ? " · current" : done ? " · visited" : ""}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontFamily: "var(--font-display)",
                            fontSize: "1.02rem",
                            marginTop: "0.15rem",
                          }}
                        >
                          {n.clue}
                        </span>
                        <span
                          className="row-sub"
                          style={{ display: "block", marginTop: "0.15rem" }}
                        >
                          {r ? `${r.id} · ${dateLabel(r.ts)} · ${r.title}` : n.receiptId}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ---------------- evidence panel ---------------- */}
          <div className="panel">
            <div className="t-label">Evidence</div>
            {current ? (
              <>
                <h3 className="t-h3" style={{ marginTop: "0.45rem" }}>
                  {current.title}
                </h3>
                {current.subtitle && (
                  <div className="row-sub" style={{ marginTop: "0.2rem" }}>
                    {current.subtitle}
                  </div>
                )}

                <div
                  style={{
                    marginTop: "1.1rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.45rem",
                    alignItems: "center",
                  }}
                >
                  <span className="t-data" style={{ fontSize: "0.68rem", color: "var(--text-subtle)" }}>
                    {current.id}
                  </span>
                  {currentEdge && (
                    <span className="badge" data-strength={currentEdge.strength}>
                      {labelForRule(currentEdge.rule)} · {currentEdge.strength}
                    </span>
                  )}
                  {!currentEdge && idx === 0 && (
                    <span className="badge" data-strength="direct">
                      trail head · starting point
                    </span>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onInspect(current.id)}
                  >
                    Full record →
                  </button>
                </div>

                {currentEdge && (
                  <div className="why-box" data-strength={currentEdge.strength}>
                    <div className="t-label">Why this connection?</div>
                    <p className="t-body" style={{ marginTop: "0.5rem" }}>
                      {currentEdge.evidence}
                    </p>
                    <p
                      className="t-body"
                      style={{ marginTop: "0.6rem", color: "var(--text-muted)" }}
                    >
                      <strong style={{ color: "var(--ink-900)" }}>Reading:</strong>{" "}
                      {currentEdge.meaning}
                    </p>
                    <p
                      className="t-label"
                      style={{ marginTop: "0.7rem", lineHeight: 1.5 }}
                    >
                      Evidence is observable. The reading is an interpretation.
                    </p>
                  </div>
                )}

                <dl className="kv">
                  <dt>Timestamp</dt>
                  <dd className="t-data">{dateTimeLabel(current.ts)}</dd>
                  {current.music && (
                    <>
                      <dt>Artist</dt>
                      <dd>{current.music.artist || "—"}</dd>
                      <dt>Album</dt>
                      <dd>{current.music.album || "—"}</dd>
                      <dt>Played</dt>
                      <dd className="t-data">
                        {durationLabel(current.music.msPlayed)}
                        {current.music.skipped ? " · skipped" : ""}
                      </dd>
                      <dt>Platform</dt>
                      <dd>{current.music.platform}</dd>
                    </>
                  )}
                  {current.transaction && (
                    <>
                      <dt>Category</dt>
                      <dd>{current.transaction.category}</dd>
                      {current.transaction.subcategory && (
                        <>
                          <dt>Subcategory</dt>
                          <dd>{current.transaction.subcategory}</dd>
                        </>
                      )}
                      <dt>Amount</dt>
                      <dd className="t-data">
                        {fmtMoney(current.transaction.amount)} {current.transaction.currency}
                      </dd>
                      <dt>Mode</dt>
                      <dd>{current.transaction.mode}</dd>
                    </>
                  )}
                </dl>

                {nextNode && (
                  <div style={{ marginTop: "1.3rem" }}>
                    <div className="t-label">Next supported connection</div>
                    <button
                      className="trail-node"
                      style={{ marginTop: "0.55rem" }}
                      onClick={() => onJump(nextNode.receiptId)}
                    >
                      <span className="trail-dot" aria-hidden="true" />
                      <span>
                        <span style={{ display: "block", fontSize: "0.9rem" }}>
                          {nextNode.clue}
                        </span>
                        <span
                          className="row-sub"
                          style={{ display: "block", marginTop: "0.15rem" }}
                        >
                          {nextNode.why}
                        </span>
                      </span>
                    </button>
                  </div>
                )}
                {!nextNode && (
                  <p
                    className="t-body"
                    style={{
                      marginTop: "1.3rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    End of this thread. The data supports no further step from
                    here — reset to walk another route.
                  </p>
                )}
              </>
            ) : (
              <p className="t-body" style={{ marginTop: "0.6rem" }}>
                No receipt found for {currentId}.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function labelForRule(rule: Edge["rule"]): string {
  switch (rule) {
    case "same-artist":
      return "Same artist";
    case "same-album":
      return "Same album";
    case "same-platform":
      return "Same device";
    case "same-subcategory":
      return "Same subcategory";
    case "same-venue":
      return "Same venue";
    case "same-language-strand":
      return "Shared language strand";
    case "temporal+theme":
      return "Close in time + shared theme";
    case "co-occurrence":
      return "Same chapter window";
    case "device-shift":
      return "Device change";
    default:
      return rule;
  }
}

/* keep import used for tree-shaking clarity */
export { fmtMoney as _fmt };

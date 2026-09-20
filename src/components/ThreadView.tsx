/**
 * AFTERPRINT — Follow the Thread.
 *
 * The trail is a projection of the curated edge sequence, not a decorative
 * graph. The current receipt and its evidence stay ahead of the optional clue
 * index so the investigation remains useful on a narrow screen.
 */

import { Fragment } from "react";
import type { Edge, Receipt, TrailNode } from "../types";
import type { Archive } from "../data";
import { dateLabel, dateTimeLabel, durationLabel, fmtMoney } from "../data";
import { edgeId, labelForRule } from "../relationship-labels";
import "./ThreadView.css";

interface Props {
  archive: Archive;
  chapterId: string;
  path: string[];
  onJump: (id: string) => void;
  onBack: () => void;
  onReset: () => void;
  onInspect: (id: string) => void;
}

type Trail = { start: string; nodes: TrailNode[] };

function dedupeAdjacent(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (out[out.length - 1] !== id) out.push(id);
  }
  return out;
}

function edgeBetween(
  edges: Edge[],
  from: string,
  to: string,
  expectedId?: string | null,
  expectedRule?: Edge["rule"] | null
): Edge | null {
  const candidates = edges.filter(
    (edge) =>
      (edge.a === from && edge.b === to) ||
      (edge.a === to && edge.b === from)
  );
  if (expectedId) {
    const byId = candidates.find((edge) => edgeId(edge) === expectedId);
    if (byId) return byId;
  }
  if (expectedRule) {
    return candidates.find((edge) => edge.rule === expectedRule) ?? null;
  }
  return candidates[0] ?? null;
}

/** Find only the edge promised by the guided node, never an unrelated edge. */
function guidedEdge(
  archive: Archive,
  from: string,
  to: string,
  node?: TrailNode
): Edge | null {
  if (!node || node.nextId !== to) return null;
  return edgeBetween(archive.edges, from, to, node.edgeId, node.rule);
}

function trailNodeKey(node: TrailNode): string {
  if (node.edgeId) return node.edgeId;
  return `${node.receiptId}->${node.nextId ?? "end"}:${node.rule ?? "end"}`;
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
  // Keep all data derivation before rendering; absent chapters/trails are a
  // valid loading or stale-navigation state and must not create hook-order bugs.
  const chapter = archive.chapters.find((item) => item.id === chapterId);
  const trail = archive.story.trails[chapterId] as Trail | undefined;
  if (!chapter || !trail) return null;

  const nodes = trail.nodes;
  const nodeIds = new Set(nodes.map((node) => node.receiptId));
  // App stores advances without the starting receipt. Rebuilding this list is
  // what lets a first advance explain itself using the real start node.
  const visited = dedupeAdjacent([trail.start, ...path]);
  const currentId =
    [...visited].reverse().find((id) => nodeIds.has(id)) ?? trail.start;
  const current = archive.byId.get(currentId);
  const currentIndex = nodes.findIndex((node) => node.receiptId === currentId);
  const visitIndex = visited.lastIndexOf(currentId);
  const priorId = visitIndex > 0 ? visited[visitIndex - 1] : null;
  const priorNode = priorId
    ? nodes.find((node) => node.receiptId === priorId)
    : undefined;

  // An independently selected receipt is intentionally not paired with any
  // merely coincidental archive edge. Only the edge declared by the prior
  // guided path item can be shown as the current explanation.
  const currentEdge =
    priorId && currentId !== priorId
      ? guidedEdge(archive, priorId, currentId, priorNode)
      : null;
  const currentNode = nodes.find((node) => node.receiptId === currentId);
  const nextNode =
    currentNode?.nextId
      ? nodes.find((node) => node.receiptId === currentNode.nextId) ?? null
      : null;
  const nextEdge =
    nextNode && currentNode
      ? guidedEdge(archive, currentId, nextNode.receiptId, currentNode)
      : null;
  const canAdvance = Boolean(nextNode && nextEdge);
  const isIndependent = Boolean(priorId && currentId !== priorId && !currentEdge);

  const pathItems = visited.filter((id) => nodeIds.has(id));
  const visitedNodeIds = new Set(pathItems);

  return (
    <section className="section thread-view" id="thread" aria-labelledby="thread-h">
      <div className="shell">
        <div className="section-head thread-heading">
          <div className="eyebrow">
            <span className="eyebrow-num">02</span>
            <span className="rule-dash" aria-hidden="true" />
            <span className="t-label">Follow the Thread · {chapter.title}</span>
          </div>
          <h2 id="thread-h" className="t-statement">{chapter.title}</h2>
          <p className="t-lead thread-context">{chapter.hook}</p>
        </div>

        <div className="connection-diagram-wrap thread-progress" aria-label="Guided clue progress">
          <div className="thread-progress-head">
            <div>
              <div className="t-label">Clue progress</div>
              <p className="thread-progress-caption">
                {currentIndex >= 0 ? `Clue ${currentIndex + 1} of ${nodes.length}` : "Starting point"}
              </p>
            </div>
            <span className="t-label-teal thread-progress-count">
              {nodes.length} curated moments
            </span>
          </div>
          <ol className="thread-progress-list">
            {nodes.map((node, index) => {
              const isCurrent = node.receiptId === currentId;
              const isDone = visitedNodeIds.has(node.receiptId) && !isCurrent;
              return (
                <Fragment key={`progress-${node.receiptId}`}>
                  <li className="thread-progress-item">
                    <button
                      className="thread-progress-button"
                      onClick={() => onJump(node.receiptId)}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`Jump to clue ${index + 1}: ${node.clue}${isCurrent ? " (current)" : ""}`}
                    >
                      <span className="thread-progress-dot" data-state={isCurrent ? "current" : isDone ? "done" : "next"} aria-hidden="true" />
                      <span>
                        <span className="t-label">{String(index + 1).padStart(2, "0")}</span>
                        <span className="thread-progress-title">{node.clue}</span>
                      </span>
                    </button>
                  </li>
                  {index < nodes.length - 1 && (
                    <li className="thread-progress-arrow" aria-hidden="true">
                      <span>→</span>
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ol>
        </div>

        <div className="workspace thread-workspace">
          <div className="thread-evidence-column">
            <nav className="crumbs" aria-label="Trail path">
              <span className="t-label thread-path-label">Path</span>
              {pathItems.map((id, index) => {
                const receipt = archive.byId.get(id);
                const clue = nodes.find((node) => node.receiptId === id)?.clue;
                return (
                  <Fragment key={`${id}-${index}`}>
                    {index > 0 && <span className="crumb-sep" aria-hidden="true">›</span>}
                    <button
                      className="crumb"
                      onClick={() => onJump(id)}
                      aria-current={index === pathItems.length - 1 ? "page" : undefined}
                      aria-label={`Go to ${clue ?? receipt?.title ?? id}`}
                    >
                      {clue ?? receipt?.title ?? id}
                    </button>
                  </Fragment>
                );
              })}
              <span className="thread-path-spacer" />
              <button className="btn btn-ghost btn-sm" onClick={onBack} disabled={path.length === 0}>
                ← Back
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onReset} disabled={path.length === 0}>
                Reset
              </button>
            </nav>

            <div className="panel thread-evidence-panel">
              <div className="t-label">Current receipt · evidence</div>
              {current ? (
                <>
                  <div className="thread-receipt-heading">
                    <div>
                      <h3 className="t-h3">{current.title}</h3>
                      {current.subtitle && <div className="row-sub">{current.subtitle}</div>}
                    </div>
                    <span className="t-data thread-receipt-id">{current.id}</span>
                  </div>

                  {currentIndex === 0 && (
                    <div className="thread-context-box">
                      <div className="t-label">Chapter context</div>
                      <p className="t-body">{chapter.hook}</p>
                      <p className="t-body thread-motif">{chapter.motif}</p>
                    </div>
                  )}

                  <div className="thread-evidence-meta">
                    {currentEdge ? (
                      <span className="badge" data-strength={currentEdge.strength}>
                        {labelForRule(currentEdge.rule)} · {currentEdge.strength}
                      </span>
                    ) : currentIndex === 0 && !isIndependent ? (
                      <span className="badge" data-strength="direct">Trail head · starting point</span>
                    ) : isIndependent ? (
                      <span className="badge" data-strength="tentative">Selected independently</span>
                    ) : null}
                    <button className="btn btn-ghost btn-sm" onClick={() => onInspect(current.id)}>
                      Full record →
                    </button>
                  </div>

                  {currentEdge && (
                    <div className="why-box" data-strength={currentEdge.strength}>
                      <div className="t-label">Why this connection?</div>
                      <p className="t-body thread-evidence-copy">{currentEdge.evidence}</p>
                      <p className="t-body thread-reading-copy">
                        <strong>Reading:</strong> {currentEdge.meaning}
                      </p>
                      <p className="t-label thread-honesty-note">
                        Evidence is observable. The reading is an interpretation.
                      </p>
                    </div>
                  )}
                  {isIndependent && (
                    <p className="t-body thread-independent-note">
                      This receipt was selected independently; no supported guided edge connects it to the prior path item.
                    </p>
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
                        <dd className="t-data">{fmtMoney(current.transaction.amount)}</dd>
                        <dt>Mode</dt>
                        <dd>{current.transaction.mode}</dd>
                        {current.transaction.flow && (
                          <>
                            <dt>Flow</dt>
                            <dd>{current.transaction.flow}</dd>
                          </>
                        )}
                        {current.transaction.note && (
                          <>
                            <dt>Note</dt>
                            <dd>{current.transaction.note}</dd>
                          </>
                        )}
                      </>
                    )}
                  </dl>

                  {canAdvance && nextNode && (
                    <div className="thread-next-step">
                      <div className="t-label">Next supported connection</div>
                      <button
                        className="trail-node"
                        onClick={() => onJump(nextNode.receiptId)}
                        aria-label={`Advance to next clue: ${nextNode.clue}`}
                      >
                        <span className="trail-dot" aria-hidden="true" />
                        <span>
                          <span className="thread-next-title">{nextNode.clue}</span>
                          <span className="thread-next-why">{nextNode.why}</span>
                        </span>
                      </button>
                    </div>
                  )}
                  {!canAdvance && !nextNode && (
                    <p className="t-body thread-end-note">
                      End of this thread. The curated trail has no further supported step from here.
                    </p>
                  )}
                  {!canAdvance && nextNode && (
                    <p className="t-body thread-end-note">
                      The next clue is not available as a supported edge in this preview.
                    </p>
                  )}
                </>
              ) : (
                <p className="t-body thread-end-note">No receipt found for {currentId}.</p>
              )}
            </div>
          </div>

          <details className="trail-disclosure">
            <summary>
              <span>Review all clues</span>
              <span className="t-label">{nodes.length} guided moments</span>
            </summary>
            <p className="trail-disclosure-note">
              This is the curated sequence for this chapter, not a claim that every possible branch is shown.
            </p>
            <ul className="trail-list">
              {nodes.map((node, index) => {
                const receipt: Receipt | undefined = archive.byId.get(node.receiptId);
                const isCurrent = node.receiptId === currentId;
                const done = visitedNodeIds.has(node.receiptId) && !isCurrent;
                return (
                  <li key={trailNodeKey(node)}>
                    <button
                      className="trail-node"
                      onClick={() => onJump(node.receiptId)}
                      aria-current={isCurrent ? "true" : undefined}
                      aria-label={`Clue ${index + 1}: ${node.clue}${isCurrent ? " (current)" : ""}`}
                    >
                      <span className="trail-dot" aria-hidden="true" />
                      <span>
                        <span className="t-label">
                          Clue {String(index + 1).padStart(2, "0")}
                          {isCurrent ? " · current" : done ? " · visited" : ""}
                        </span>
                        <span className="trail-clue-title">{node.clue}</span>
                        <span className="row-sub trail-receipt-line">
                          {receipt ? `${receipt.id} · ${dateLabel(receipt.ts)} · ${receipt.title}` : node.receiptId}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      </div>
    </section>
  );
}

/* Keep this named export available for older imports that used the data helper. */
export { fmtMoney as _fmt };

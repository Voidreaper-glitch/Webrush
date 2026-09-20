/**
 * AFTERPRINT — receipt detail modal.
 *
 * The modal exposes only fields present in the source receipt and only curated
 * connections whose other endpoint is available in the current preview.
 */

import { useEffect, useRef } from "react";
import type { Receipt } from "../types";
import type { Archive } from "../data";
import { dateLabel, dateTimeLabel, durationLabel, fmtMoney } from "../data";
import { edgesFor, KIND_LABEL_SINGULAR, otherEnd } from "../selectors";
import { edgeKey, labelForRule } from "../relationship-labels";
import "./ThreadView.css";

interface Props {
  receipt: Receipt;
  archive: Archive;
  onClose: () => void;
  onOpenRelated: (id: string) => void;
  onExplore?: (receipt: Receipt) => void;
}

export function ReceiptModal({
  receipt,
  archive,
  onClose,
  onOpenRelated,
  onExplore,
}: Props) {
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  // A parent render may replace onClose while this modal stays mounted. Keep
  // the latest callback without restarting the open lifecycle or focus restore.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [receipt.id]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const host = scrimRef.current;
    const background = host?.parentElement
      ? Array.from(host.parentElement.children).filter((node) => node !== host)
      : [];
    const previousBackgroundState = background.map((node) => {
      const element = node as HTMLElement;
      return {
        element,
        ariaHidden: element.getAttribute("aria-hidden"),
        inert: element.inert,
      };
    });

    for (const node of background) {
      const element = node as HTMLElement;
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }

    closeBtnRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      for (const state of previousBackgroundState) {
        state.element.inert = state.inert;
        if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
        else state.element.setAttribute("aria-hidden", state.ariaHidden);
      }
      if (previous && previous.isConnected && typeof previous.focus === "function") {
        previous.focus();
      }
    };
  }, []);

  const related = edgesFor(archive, receipt.id);
  const availableRelated = related.flatMap((edge) => {
    const other = archive.byId.get(otherEnd(edge, receipt.id));
    return other ? [{ edge, other }] : [];
  });
  const hasMissingEndpoints = availableRelated.length < related.length;
  const music = receipt.music;
  const transaction = receipt.transaction;
  const sourceName = receipt.source === "spotify" ? "Spotify" : "Household";
  const exploreLabel = music?.artist
    ? "Explore this artist →"
    : transaction?.category
    ? "Explore this category →"
    : "Explore this record →";

  return (
    <div
      ref={scrimRef}
      className="scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div>
            <div className="t-label">
              {KIND_LABEL_SINGULAR[receipt.kind]} · {sourceName} Archive
            </div>
            <h2 id="receipt-modal-title" className="t-h3" style={{ marginTop: "0.35rem" }}>
              {receipt.title}
            </h2>
            {receipt.subtitle && (
              <div className="row-sub" style={{ marginTop: "0.25rem", whiteSpace: "normal" }}>
                {receipt.subtitle}
              </div>
            )}
          </div>
          <button
            ref={closeBtnRef}
            className="x-btn"
            style={{ minWidth: "44px", minHeight: "44px" }}
            onClick={() => onCloseRef.current()}
            aria-label="Close receipt detail"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="modal-body">
          <div className="perf-edge" aria-hidden="true" />
          <dl className="kv">
            <dt>Source ID</dt>
            <dd className="t-data">{receipt.id}</dd>
            <dt>Timestamp</dt>
            <dd className="t-data">{dateTimeLabel(receipt.ts)}</dd>

            {music && (
              <>
                <dt>Artist</dt>
                <dd>{music.artist || "—"}</dd>
                <dt>Album</dt>
                <dd>{music.album || "—"}</dd>
                <dt>Platform</dt>
                <dd>{music.platform}</dd>
                <dt>Played</dt>
                <dd className="t-data">
                  {durationLabel(music.msPlayed)}
                  {music.skipped ? " · skipped" : " · not skipped"}
                </dd>
                <dt>Start reason</dt>
                <dd>{music.reasonStart}</dd>
                <dt>End reason</dt>
                <dd>{music.reasonEnd}</dd>
              </>
            )}

            {transaction && (
              <>
                <dt>Category</dt>
                <dd>{transaction.category}</dd>
                {transaction.subcategory && (
                  <>
                    <dt>Subcategory</dt>
                    <dd>{transaction.subcategory}</dd>
                  </>
                )}
                <dt>Amount</dt>
                <dd className="t-data">{fmtMoney(transaction.amount)}</dd>
                <dt>Flow</dt>
                <dd>{transaction.flow || "—"}</dd>
                <dt>Mode</dt>
                <dd>{transaction.mode}</dd>
                {transaction.note && (
                  <>
                    <dt>Note</dt>
                    <dd>{transaction.note}</dd>
                  </>
                )}
              </>
            )}

            {!music && !transaction && (
              <>
                <dt>Detail</dt>
                <dd>No further fields are present in the source record.</dd>
              </>
            )}
          </dl>

          <div className="receipt-modal-explore" style={{ marginTop: "1.3rem" }}>
            {onExplore && (
              <button className="btn btn-ghost btn-sm" onClick={() => onExplore(receipt)}>
                {exploreLabel}
              </button>
            )}
          </div>

          <div style={{ marginTop: "1.6rem" }}>
            <div className="t-label">Supported connections</div>
            {related.length === 0 ? (
              <p className="t-body" style={{ marginTop: "0.55rem", color: "var(--text-muted)" }}>
                No curated connection has been added for this receipt yet.
              </p>
            ) : availableRelated.length === 0 ? (
              <p className="t-body" style={{ marginTop: "0.55rem", color: "var(--text-muted)" }}>
                Curated connections for this receipt refer to records not included in this preview, so they cannot be opened here.
              </p>
            ) : (
              <>
                {hasMissingEndpoints && (
                  <p className="t-body" style={{ marginTop: "0.55rem", color: "var(--text-muted)" }}>
                    Some curated connections refer to records not included in this preview; only available endpoints are listed.
                  </p>
                )}
                <ul className="next-list">
                  {availableRelated.map(({ edge, other }) => (
                    <li key={edgeKey(edge)}>
                      <button
                        className="trail-node"
                        onClick={() => onOpenRelated(other.id)}
                        aria-label={`Open related ${KIND_LABEL_SINGULAR[other.kind]}: ${other.title}`}
                      >
                        <span className="trail-dot" aria-hidden="true" />
                        <span>
                          <span className="t-data" style={{ fontSize: "0.72rem", color: "var(--text-subtle)" }}>
                            {other.id} · {dateLabel(other.ts)}
                          </span>
                          <span style={{ display: "block", fontSize: "0.92rem", fontWeight: 600 }}>
                            {other.title}
                          </span>
                          <span className="badge" data-strength={edge.strength} style={{ marginTop: "0.35rem" }}>
                            {labelForRule(edge.rule)} · {edge.strength}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

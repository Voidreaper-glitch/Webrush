/**
 * AFTERPRINT — receipt detail modal.
 *
 * Shows the source record's real fields, plus every supported connection.
 * Focus is moved into the modal on open and returned on close.
 * Escape closes. The scrim click closes. Nothing is invented.
 */

import { useEffect, useRef } from "react";
import type { Edge, Receipt } from "../types";
import type { Archive } from "../data";
import {
  dateLabel,
  dateTimeLabel,
  durationLabel,
  fmtMoney,
} from "../data";
import { edgesFor, KIND_LABEL_SINGULAR, otherEnd } from "../selectors";

interface Props {
  receipt: Receipt;
  archive: Archive;
  onClose: () => void;
  onOpenRelated: (id: string) => void;
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

export function ReceiptModal({ receipt, archive, onClose, onOpenRelated }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Scroll to top whenever receipt changes
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [receipt.id]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    if (closeBtnRef.current) {
      closeBtnRef.current.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" && panelRef.current) {
        const el = panelRef.current;
        const focusable = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((n) => !n.hasAttribute("disabled"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [onClose]);

  const rels = edgesFor(archive, receipt.id);
  const m = receipt.music;
  const t = receipt.transaction;
  const sourceName = receipt.source === "spotify" ? "Spotify" : "Household";

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
            onClick={onClose}
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

            {m && (
              <>
                <dt>Artist</dt>
                <dd>{m.artist || "—"}</dd>
                <dt>Album</dt>
                <dd>{m.album || "—"}</dd>
                <dt>Platform</dt>
                <dd>{m.platform}</dd>
                <dt>Played</dt>
                <dd className="t-data">
                  {durationLabel(m.msPlayed)}
                  {m.skipped ? " · skipped" : " · not skipped"}
                </dd>
                <dt>Start reason</dt>
                <dd>{m.reasonStart}</dd>
                <dt>End reason</dt>
                <dd>{m.reasonEnd}</dd>
              </>
            )}

            {t && (
              <>
                <dt>Category</dt>
                <dd>{t.category}</dd>
                {t.subcategory && (
                  <>
                    <dt>Subcategory</dt>
                    <dd>{t.subcategory}</dd>
                  </>
                )}
                <dt>Amount</dt>
                <dd className="t-data">
                  {fmtMoney(t.amount)}
                </dd>
                <dt>Flow</dt>
                <dd>{t.flow || "—"}</dd>
                <dt>Mode</dt>
                <dd>{t.mode}</dd>
                {t.note && (
                  <>
                    <dt>Note</dt>
                    <dd>{t.note}</dd>
                  </>
                )}
              </>
            )}

            {!m && !t && (
              <>
                <dt>Detail</dt>
                <dd>No further fields are present in the source record.</dd>
              </>
            )}
          </dl>

          <div style={{ marginTop: "1.6rem" }}>
            <div className="t-label">Supported connections ({rels.length})</div>
            {rels.length === 0 ? (
              <p className="t-body" style={{ marginTop: "0.55rem", color: "var(--text-muted)" }}>
                No connection from this record is supported by the data. That is a
                finding, not an error: this receipt stands alone in the archive.
              </p>
            ) : (
              <ul className="next-list">
                {rels.map((e: Edge) => {
                  const other = archive.byId.get(otherEnd(e, receipt.id));
                  if (!other) return null;
                  return (
                    <li key={`${e.a}-${e.b}`}>
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
                          <span className="badge" data-strength={e.strength} style={{ marginTop: "0.35rem" }}>
                            {labelForRule(e.rule)} · {e.strength}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AFTERPRINT — application shell.
 *
 * Route-free navigation: a single page with three views switched by state.
 * Application state stays small — active view, active chapter, trail path,
 * search query, category filter, and the open receipt id. Every visible
 * count is derived from the archive, never stored twice.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReceiptKind } from "./types";
import type { Archive } from "./data";
import { getInitialArchive, loadArchive } from "./data";
import { ChapterAtlas } from "./components/ChapterAtlas";
import { ThreadView } from "./components/ThreadView";
import { Explorer } from "./components/Explorer";
import { ReceiptModal } from "./components/ReceiptModal";

type View = "atlas" | "thread" | "explorer";

export function App() {
  const [archive, setArchive] = useState<Archive>(getInitialArchive);
  const [isArchiveLoaded, setIsArchiveLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadArchive(archive.story)
      .then((a) => {
        if (alive) {
          setArchive(a);
          setIsArchiveLoaded(true);
        }
      })
      .catch((e) => {
        if (alive) {
          console.warn("Background load warning:", e);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const [view, setView] = useState<View>("atlas");
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<ReceiptKind[]>([]);
  const [scope, setScope] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const pickChapter = useCallback(
    (id: string) => {
      setChapterId(id);
      setPath([]);
      setScope(id);
      setView("thread");
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        document.getElementById("thread")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    []
  );

  const jump = useCallback(
    (id: string) => {
      setPath((p) => {
        const at = p.indexOf(id);
        if (at >= 0) return p.slice(0, at + 1);
        return [...p, id];
      });
    },
    []
  );

  const back = useCallback(() => {
    setPath((p) => (p.length > 1 ? p.slice(0, -1) : p));
  }, []);

  const reset = useCallback(() => {
    setPath([]);
  }, []);

  const openReceipt = useCallback((id: string) => {
    setOpenId(id);
  }, []);

  const openRelated = useCallback(
    (id: string) => {
      setOpenId(id);
    },
    []
  );

  const open = openId && archive ? archive.byId.get(openId) : null;

  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />

      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="chrome">
        <div className="shell chrome-inner">
          <a
            className="brand"
            href="#main"
            onClick={(e) => {
              e.preventDefault();
              setView("atlas");
              document.getElementById("main")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <span className="brand-mark">AFTERPRINT</span>
            <span className="brand-sub">your life, between the lines</span>
          </a>

          <nav className="nav" aria-label="Primary">
            <button
              className="nav-btn"
              aria-current={view === "atlas" ? "page" : undefined}
              onClick={() => setView("atlas")}
            >
              Atlas
            </button>
            <button
              className="nav-btn"
              aria-current={view === "thread" ? "page" : undefined}
              onClick={() => {
                if (chapterId) setView("thread");
                else setView("atlas");
              }}
              disabled={!chapterId}
            >
              Thread
            </button>
            <button
              className="nav-btn"
              aria-current={view === "explorer" ? "page" : undefined}
              onClick={() => setView("explorer")}
            >
              Explorer
            </button>
          </nav>
        </div>
      </header>

      <main id="main">
        {view === "atlas" && (
          <div className="view" key="atlas">
            <Hero archive={archive} onPick={pickChapter} onExplore={() => setView("explorer")} />
            <ChapterAtlas
              archive={archive}
              activeChapter={chapterId}
              onPick={pickChapter}
            />
            <MethodNote archive={archive} />
          </div>
        )}

        {view === "thread" && chapterId && (
          <div className="view" key="thread">
            <ThreadView
              archive={archive}
              chapterId={chapterId}
              path={path}
              onJump={jump}
              onBack={back}
              onReset={reset}
              onInspect={openReceipt}
            />
          </div>
        )}

        {view === "explorer" && (
          <div className="view" key="explorer">
            <Explorer
              archive={archive}
              isArchiveLoaded={isArchiveLoaded}
              query={query}
              kinds={kinds}
              chapterScope={scope}
              openId={openId}
              onQuery={setQuery}
              onKinds={setKinds}
              onScope={setScope}
              onOpen={openReceipt}
            />
          </div>
        )}
      </main>

      <footer className="hair-t" style={{ padding: "2rem 0" }}>
        <div className="shell" style={{ display: "grid", gap: "0.5rem" }}>
          <div className="t-label">AFTERPRINT · frontend-only</div>
          <p className="t-body" style={{ color: "var(--text-muted)" }}>
            {archive.totals.spotify.toLocaleString()} listening receipts and{" "}
            {archive.totals.household.toLocaleString()} household transactions,
            normalized in the browser. No backend, no tracking, no invented data.
          </p>
        </div>
      </footer>

      {open && (
        <ReceiptModal
          receipt={open}
          archive={archive}
          onClose={() => setOpenId(null)}
          onOpenRelated={openRelated}
        />
      )}
    </div>
  );
}

function Hero({
  archive,
  onPick,
  onExplore,
}: {
  archive: Archive;
  onPick: (id: string) => void;
  onExplore: () => void;
}) {
  const first = useMemo(() => {
    return archive.byId.get("SP-000001") || archive.receipts.find((r) => r.source === "spotify");
  }, [archive]);

  return (
    <section className="hero">
      <div className="shell hero-grid">
        <div>
          <div className="hero-eyebrow">
            <span className="t-label t-label-teal">Receipts Archive</span>
            <span className="rule-dash" aria-hidden="true" />
            <span className="t-label">
              {archive.totals.all.toLocaleString()} records · 2013 — 2024
            </span>
          </div>
          <h1 className="t-hero">
            Your life,
            <br />
            between the lines.
          </h1>
          <p className="t-lead" style={{ marginTop: "1.1rem", maxWidth: "52ch" }}>
            Two archives. One person. {archive.totals.spotify.toLocaleString()}{" "}
            listening records and {archive.totals.household.toLocaleString()}{" "}
            household transactions, read as chapters — not as a list. Every claim
            below traces to a receipt ID you can open.
          </p>
          <div className="hero-cta">
            <button className="btn" onClick={() => onPick(archive.chapters[0].id)}>
              Enter the first chapter →
            </button>
            <button className="btn btn-ghost" onClick={onExplore}>
              Browse the archive
            </button>
          </div>
        </div>

        <div>
          <div className="stat-rail">
            <Stat
              n={archive.totals.spotify.toLocaleString()}
              k="Listening records"
              kind="music"
            />
            <Stat
              n={archive.totals.household.toLocaleString()}
              k="Household transactions"
              kind="money"
            />
            <Stat
              n={String(archive.chapters.length)}
              k="Evidence-backed chapters"
              kind="meta"
            />
            <Stat
              n={String(archive.edges.length)}
              k="Supported connections"
              kind="meta"
            />
          </div>

          {first && (
            <div className="specimen">
              <div className="specimen-head">
                <span className="t-label">The very first receipt</span>
                <span className="t-data" style={{ fontSize: "0.62rem", color: "var(--text-subtle)" }}>
                  {first.id}
                </span>
              </div>
              <div className="specimen-body">
                <div className="specimen-title">{first.title}</div>
                <div className="row-sub" style={{ marginTop: "0.2rem" }}>
                  {first.subtitle}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: "0.85rem" }}
                  onClick={() => onPick(archive.chapters[0].id)}
                >
                  See where it leads →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  n,
  k,
  kind = "meta",
}: {
  n: string;
  k: string;
  kind?: "music" | "money" | "meta";
}) {
  return (
    <div className="stat-cell" data-kind={kind}>
      <div className="stat-num">{n}</div>
      <div className="stat-key t-label">{k}</div>
    </div>
  );
}

function MethodNote({ archive }: { archive: Archive }) {
  return (
    <section className="section hair-t" id="method" aria-labelledby="method-h">
      <div className="shell">
        <div className="section-head">
          <div className="eyebrow">
            <span className="eyebrow-num">04</span>
            <span className="rule-dash" aria-hidden="true" />
            <span className="t-label">Observation, not invention</span>
          </div>
          <h2 id="method-h" className="t-h2">
            What the data justifies, and what it does not.
          </h2>
          <p className="t-lead">
            The archive is two supplied files. {archive.sources.spotify.file} and{" "}
            {archive.sources.household.file}. A third supplied file was excluded
            from the archive: it describes 1,330 different card holders, not one
            person, and cannot be reconciled into a single life.
          </p>
          <p className="t-body" style={{ marginTop: "0.8rem" }}>
            Connections are drawn only from explicit shared detail — the same
            artist, the same device, the same subscription, or dates that fall
            in the same window as another meaningful shared fact. Generic words
            are never treated as matches. Where a link is plausible rather than
            certain it is labelled <em>tentative</em>, and every interpretation
            is separated from the evidence that produced it.
          </p>
        </div>
      </div>
    </section>
  );
}

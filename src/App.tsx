import { useCallback, useState } from "react";
import type { Receipt, ReceiptKind } from "./types";
import type { Archive } from "./data";
import { useArchive } from "./hooks/useArchive";
import { ChapterAtlas } from "./components/ChapterAtlas";
import { ThreadView } from "./components/ThreadView";
import { Explorer } from "./components/Explorer";
import { ReceiptModal } from "./components/ReceiptModal";
import { PatternLens } from "./components/PatternLens";

type View = "atlas" | "thread" | "explorer";

export function App() {
  const { archive, status, retry } = useArchive();
  const [view, setView] = useState<View>("atlas");
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<ReceiptKind[]>([]);
  const [scope, setScope] = useState<string | null>(null);
  const [artist, setArtist] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const closeReceipt = useCallback(() => setOpenId(null), []);

  const navigate = useCallback((next: View) => {
    setView(next);
    requestAnimationFrame(() => {
      const main = document.getElementById("main");
      main?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }, []);
  const pickChapter = useCallback((id: string) => {
    setChapterId(id);
    setPath([]);
    setScope(id);
    navigate("thread");
  }, [navigate]);
  const jump = useCallback((id: string) => {
    setPath((current) => {
      const at = current.indexOf(id);
      return at >= 0 ? current.slice(0, at + 1) : [...current, id];
    });
  }, []);
  const back = useCallback(() => setPath((current) => current.slice(0, -1)), []);
  const reset = useCallback(() => setPath([]), []);
  const exploreArtist = useCallback((name: string, chapter: string | null = null) => {
    setArtist(name);
    setScope(chapter);
    setQuery("");
    setKinds(["music"]);
    setOpenId(null);
    navigate("explorer");
  }, [navigate]);
  const exploreReceipt = useCallback((receipt: Receipt) => {
    if (receipt.music) exploreArtist(receipt.music.artist);
    else {
      setArtist(null);
      setScope(null);
      setQuery(receipt.transaction?.subcategory || receipt.transaction?.category || "");
      setKinds(["transaction"]);
      setOpenId(null);
      navigate("explorer");
    }
  }, [exploreArtist, navigate]);
  const open = openId ? archive.byId.get(openId) : null;

  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="chrome">
        <div className="shell chrome-inner">
          <a className="brand" href="#main" onClick={(event) => { event.preventDefault(); navigate("atlas"); }}>
            <span className="brand-mark">AFTERPRINT</span>
            <span className="brand-sub">your life, between the lines</span>
          </a>
          <nav className="nav" aria-label="Primary">
            <button className="nav-btn" aria-current={view === "atlas" ? "page" : undefined} onClick={() => navigate("atlas")}>Atlas</button>
            <button className="nav-btn" aria-current={view === "thread" ? "page" : undefined} onClick={() => chapterId ? navigate("thread") : pickChapter(archive.chapters[0].id)}>Thread</button>
            <button className="nav-btn" aria-current={view === "explorer" ? "page" : undefined} onClick={() => navigate("explorer")}>Explorer</button>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {status === "error" && <div className="shell archive-notice" role="alert">
          <div><strong>The full archive could not load.</strong><p>The curated story preview is still available. Full search needs a successful download.</p></div>
          <button className="btn btn-sm" onClick={retry}>Retry archive download</button>
        </div>}
        {view === "atlas" && <div className="view">
          <Hero archive={archive} onPick={pickChapter} onExplore={() => navigate("explorer")} />
          <PatternLens archive={archive} ready={status === "ready"} onExplore={exploreArtist} />
          <ChapterAtlas archive={archive} activeChapter={chapterId} onPick={pickChapter} onExploreArtist={exploreArtist} />
          <section className="section hair-t method-section"><div className="shell">
            <details className="method-note"><summary>How to read this archive</summary>
              <p className="t-body">Chapters are curated interpretations of two supplied archives, not runtime AI. The files have no shared identity key: a cross-source coincidence does not establish that records describe the same person or that one event caused another.</p>
              <p className="t-body">Source files: {archive.sources.spotify.file}; {archive.sources.household.file}. An additional multi-person transactions dataset is not included in this archive. Only music and household records are represented here.</p>
              <p className="t-body">Every curated link exposes its evidence. Tentative links are labelled. A receipt without a curated link is not necessarily unrelated.</p>
            </details>
          </div></section>
        </div>}
        {view === "thread" && chapterId && <div className="view"><ThreadView archive={archive} chapterId={chapterId} path={path} onJump={jump} onBack={back} onReset={reset} onInspect={setOpenId} /></div>}
        {view === "explorer" && <div className="view"><Explorer archive={archive} status={status} query={query} kinds={kinds} chapterScope={scope} artist={artist} openId={openId} onQuery={setQuery} onKinds={setKinds} onScope={setScope} onArtist={setArtist} onOpen={setOpenId} /></div>}
      </main>
      <footer className="hair-t app-footer"><div className="shell">
        <div className="t-label">AFTERPRINT · frontend-only · curated, not generated</div>
        <p className="t-body">{archive.totals.spotify.toLocaleString()} listening receipts · {archive.totals.household.toLocaleString()} household records. No backend or tracking.</p>
      </div></footer>
      {open && <ReceiptModal receipt={open} archive={archive} onClose={closeReceipt} onOpenRelated={setOpenId} onExplore={exploreReceipt} />}
    </div>
  );
}

function Hero({ archive, onPick, onExplore }: { archive: Archive; onPick: (id: string) => void; onExplore: () => void }) {
  return <section className="hero"><div className="shell hero-grid">
    <div>
      <div className="hero-eyebrow"><span className="t-label t-label-teal">An archive of small moments</span></div>
      <h1 className="t-hero">Your life,<br />between the lines.</h1>
      <p className="t-lead hero-intro">Songs repeat. Habits change. Follow the clues hiding inside two digital archives—and see the receipts behind every reading.</p>
      <div className="hero-cta">
        <button className="btn" onClick={() => onPick(archive.chapters[0].id)}>Explore the connections →</button>
        <button className="btn btn-ghost" onClick={onExplore}>Browse the archive</button>
      </div>
    </div>
    <div className="stat-rail" aria-label="Archive overview">
      <Stat value={archive.totals.all.toLocaleString()} label="Receipts" />
      <Stat value="2013–24" label="Recorded years" />
      <Stat value={String(archive.chapters.length)} label="Chapters" />
      <Stat value={String(archive.edges.length)} label="Curated links" />
    </div>
  </div></section>;
}
function Stat({ value, label }: { value: string; label: string }) {
  return <div className="stat-cell"><div className="stat-num">{value}</div><div className="stat-key t-label">{label}</div></div>;
}

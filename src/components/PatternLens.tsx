import { useMemo, useState } from "react";
import type { Archive } from "../data";

interface Props { archive: Archive; ready: boolean; onExplore: (artist: string, chapter: string | null) => void }

/** An exact artist comparison: shares, not raw growth across unequal periods. */
export function PatternLens({ archive, ready, onExplore }: Props) {
  const options = useMemo(() => [...new Set(archive.chapters.flatMap((chapter) => chapter.topArtists.map((artist) => artist.artist)))].sort(), [archive.chapters]);
  const [selected, setSelected] = useState(archive.chapters[1]?.topArtists[0]?.artist || options[0] || "");
  const comparison = useMemo(() => {
    const counts = new Array<number>(archive.chapters.length).fill(0);
    if (ready) {
      for (const receipt of archive.receipts) {
        if (receipt.music?.artist !== selected) continue;
        archive.chapters.forEach((chapter, index) => {
          if (receipt.ts >= chapter.lo && receipt.ts < chapter.hi) counts[index]++;
        });
      }
    }
    return archive.chapters.map((chapter, index) => ({ chapter, count: counts[index], share: chapter.counts.plays ? counts[index] / chapter.counts.plays * 100 : 0 }));
  }, [archive, ready, selected]);
  const peak = Math.max(...comparison.map((item) => item.share), 1);
  return <section className="pattern-section hair-b" aria-labelledby="pattern-heading"><div className="shell pattern-layout">
    <div className="pattern-intro">
      <span className="t-label t-label-teal">Discover a recurring motif</span>
      <h2 className="t-h2" id="pattern-heading">What stays. What changes.</h2>
      <p className="t-body">Follow one artist through four chapters. Select a bar to inspect the actual receipts.</p>
      <label className="t-label" htmlFor="pattern-artist">Choose an artist</label>
      <select className="input" id="pattern-artist" value={selected} onChange={(event) => setSelected(event.target.value)}>{options.map((artist) => <option key={artist}>{artist}</option>)}</select>
    </div>
    <div className="pattern-comparison" aria-live="polite">
      {!ready ? <p className="preview-notice" role="status">The guided chapters are ready. Complete artist comparisons appear when the full archive finishes loading.</p> : <>
        <ol className="pattern-bars">{comparison.map(({ chapter, count, share }, index) => <li key={chapter.id}>
          <button className="pattern-bar" onClick={() => onExplore(selected, chapter.id)} aria-label={`Explore ${selected} in ${chapter.title}: ${count} plays, ${share.toFixed(1)} percent of chapter plays`}>
            <span className="pattern-bar-heading"><span>{String(index + 1).padStart(2, "0")} · {chapter.title}</span><strong>{share.toFixed(1)}%</strong></span>
            <span className="pattern-track" aria-hidden="true"><span style={{ width: `${share / peak * 100}%` }} /></span>
            <span className="pattern-bar-caption">{count.toLocaleString()} of {chapter.counts.plays.toLocaleString()} plays · {new Date(chapter.lo * 1000).getUTCFullYear()}–{new Date((chapter.hi - 1) * 1000).getUTCFullYear()}</span>
          </button>
        </li>)}</ol>
        <p className="pattern-footnote">Share of recorded plays, not time listened. Chapters have different lengths; this comparison does not explain why tastes changed.</p>
      </>}
    </div>
  </div></section>;
}

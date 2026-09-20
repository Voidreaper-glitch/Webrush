# AFTERPRINT — Your life, between the lines

An interactive reading of one person's digital receipts. Two supplied archives,
152,321 records, eleven years — turned into chapters, threads, and inspectable
evidence rather than a list.

**Problem statement:** “Your Life, In Receipts.”
**Scope:** frontend-only. No backend, database, serverless function, server
action, SSR, authentication, or secret-bearing API call. All computation happens
in the browser against a static data bundle.

---

## Live URL, stack, and commands

- **Live URL:** _to be filled in at deploy time_ (static host)
- **Repository:** https://github.com/Voidreaper-glitch/Webrush
- **Stack:** React 19 · TypeScript (strict) · Vite 7 · plain CSS with custom
  properties. One package manager (npm), one lockfile. No UI, animation, or
  state libraries — the brief asked not to add dependencies that do not earn
  their place, and none were needed.
- **Fonts:** self-hosted variable fonts (see _Credits_). No third-party font
  request at runtime.

```bash
npm install
npm run dev        # local development
npm run typecheck  # tsc --noEmit
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

Data integrity checks (no test framework required, plain assertions):

```bash
node rendercheck.mjs   # 13 assertions against a served production build
```

---

## Why this is more than a timeline

A chronological list of 152,321 cards answers no question. What a life archive
actually holds is _change_ and _repetition_ — and both only become visible when
records are grouped by meaning and connected by shared detail.

AFTERPRINT therefore has three layers, and they are one product, not three demos:

1. **The Chapter Atlas** — four evidence-backed readings of the archive. Each
   chapter is a motif the records support, with its real span, counts, and
   activity types. Chapters are the unit of navigation; dates only orient.
2. **Follow the Thread** — the signature interaction. Opening a chapter drops you
   on a clue, and every step shows which two receipts are connected, the exact
   shared detail, whether the link is direct or tentative, and what it might
   mean. Branching follows the evidence; a path can be walked back or reset.
3. **The Receipt Explorer** — the evidence layer. Every supplied record,
   searchable and filterable, including the ones no chapter claims.

Every narrative claim keeps its supporting receipt IDs. Every drawn edge keeps
its endpoints and its evidence.

---

## The six requirements, mapped to what is implemented

| # | Requirement | Implementation | Where |
|---|---|---|---|
| 1 | Explore the provided receipts | Complete archive of 152,321 records, both sources, with source fields exposed per record | `Explorer`, `ReceiptModal` |
| 2 | Meaningful search / filter / navigation | Text search over normalized fields, activity-type filter, chapter navigation, live result count, visible and clearable chapter restriction | `Explorer`, `App` |
| 3 | Relationship / pattern discovery | 34 explainable edges from explicit shared detail; each carries both endpoint IDs, the rule, the shared evidence, and a direct/tentative strength | `story.json`, `ThreadView` |
| 4 | Interactive storytelling | Chapter → clue → branch, breadcrumb path, Back, Reset, changing explanation and evidence at every step | `ThreadView` |
| 5 | Visual representation of the journey | Chapter ribbon (SVG) projecting real spans, plus a catalogue of chapter cards; within-chapter evidence trail | `ChapterAtlas`, `ThreadView` |
| 6 | Responsive design | 320 / 390 / 768 / 1440 px; vertical full-width evidence trail on small screens; no drag, hover, or tiny-node dependence | `globals.css` |

---

## Dataset handling

### What was supplied

| File | Rows | Span | Used |
|---|---|---|---|
| `archive/spotify_history.csv` | 149,860 | 2013-07-08 → 2024-12-15 (UTC) | yes |
| `archive/spotify_data_dictionary.csv` | 11 field definitions | — | reference |
| `archive (1)/Daily Household Transactions.csv` | 2,461 | 2015-01-01 → 2018-09-20 | yes |
| `archive (2)/Augmented_IndiaTransactMultiFacet2024.{json,tsv,xml,csv}` | 10,267 | 2022-04 → 2024-04 | **no — see below** |

**Archive total: 152,321 records.**

### The excluded file

`Augmented_IndiaTransactMultiFacet2024` describes **1,330 distinct card numbers
and 1,279 distinct customer names** across its 10,267 rows, with roughly 49%
flagged `is_fraud = 1`. It is synthetic multi-holder data. It cannot be
reconciled with the single person the other two files describe, so it is not
part of the archive and no chapter, statistic, or connection draws on it. The
same 10,267 records appear in four formats; only one would ever have been used.
This is stated here rather than hidden, because silently mixing it in would have
produced a false biography.

### Normalization

The original files are untouched. A build-time pipeline emits a columnar,
dictionary-compressed bundle (`public/data/receipts.json`, ~10 MB raw) that the
browser expands into typed receipts on load:

- **Stable source reference.** Every receipt carries the 1-based row number of
  its original CSV, prefixed by source: `SP-000001`…`SP-149860` for listening
  records, `HH-000001`…`HH-002461` for transactions. Any claim in the UI can be
  traced back to an exact line in the supplied data.
- **Normalized type.** `music` or `transaction` — the two activity types the
  data actually contains.
- **Valid date or explicit undated state.** Spotify timestamps are UTC per the
  supplied data dictionary. Household dates are `dd/mm/yyyy`, some with a time
  and some without; both forms parse. No record is undated in this dataset, and
  the code still handles the case.
- **Display title, subtitle, and search text** derived per kind.
- **Sensible fallbacks.** Missing fields render as explicit placeholders
  (e.g. “— no further text in the source record —”). **No receipt is ever
  dropped** because a field is missing. 635 household rows have no subcategory
  and 521 have no note; all of them appear in the explorer.

### Reconciliation

`rendercheck.mjs` asserts, against a served production build, that: the declared
totals equal 149,860 + 2,461; each chapter's play count equals a fresh count from
the raw data; chapters cover 149,860 / 149,860 plays; and every edge and trail ID
exists in the archive.

---

## Relationship rules

Edges are produced by deterministic rules over the real records, not by
inference. A rule fires only when it has explicit shared detail to point at:

| Rule | Fires when |
|---|---|
| `same-artist` | Both receipts are the same named artist |
| `same-platform` / `device-shift` | Both records share a listening device, or a device first appears |
| `same-subcategory` | Both ledger rows carry the same explicit subcategory (e.g. Netflix) |
| `same-venue` | Both ledger notes name the same venue (e.g. PVR) |
| `same-language-strand` | Two artists in the same explicitly-identified language strand |
| `temporal+theme` | Close in time **and** a second meaningful shared detail |
| `co-occurrence` | Both records fall in the same chapter window, where the window itself is the meaningful shared fact |

**Time proximity alone is never treated as proof.** Generic words (“day”,
“good”, “love”) are never used as entity matches. No geographic inference is
made — the supplied data has no reliable location for this person. Stopwords are
not treated as shared detail.

Each edge records `strength: "direct"` or `"tentative"`. Direct means the shared
detail is explicit in both records. Tentative means the reading is plausible but
rests on context — and the UI says so in words, not just in colour.

### Observation versus interpretation

The `Why this connection?` block separates the two explicitly:

- **Evidence** — only what the records literally contain (“Both are plays of
  *The Killers*: 330 plays in 2017-09 versus 688 in 2020-08 alone”).
- **Reading** — the interpretation, introduced as such.

No breakup, move, diagnosis, personality trait, or causal event is inferred.
Where the data shows a change, the change is stated; the reason is not invented.

---

## How the chapters were derived

Chapter spans were chosen to align with real structural breaks in the evidence,
then **verified by recomputing every figure from the raw rows**. They are curated
readings, not runtime AI — and the application never claims otherwise.

| # | Chapter | Span | Plays | Artists | Hours | Skip | Motif |
|---|---|---|---|---|---|---|---|
| 1 | First Play to Obsession | 2013-07-08 → 2016-12-31 | 9,430 | 938 | 265.7 | 26.2% | Wide browsing on desktop/web players; 2015 alone carries 610 distinct artists and a 78.7% skip rate |
| 2 | The Beatles Regime | 2017-01-01 → 2018-12-31 | 41,137 | 781 | 1,144.9 | 0.0% | One band takes 5,250 plays; Android carries 94% of listening |
| 3 | The Lockdown Divide | 2019-01-01 → 2021-07-31 | 53,538 | 1,515 | 1,934.5 | 0.0% | Repertoire doubles; `cast to device` goes from 106 plays to 3,773 |
| 4 | A Second Language | 2021-08-20 → 2024-12-15 | 45,755 | 2,770 | 1,996.5 | 11.8% | A Spanish-language strand of 2,294 plays across six artists; a Mac appears in 2023 |

Chapter counts **overlap by design** (a receipt may belong to more than one
reading) and are therefore never summed into the archive total. The archive total
is always read from the source metadata.

For claims about changing behaviour, comparable windows are used and small
samples are disclosed. Where the data cannot support a trend, a narrower
observation is stated instead.

---

## Limitations

- **Two activity types, not the ten the brief anticipates.** The supplied data
  contains music listening and household transactions. There are no photos,
  messages, searches, places, events, or standalone notes in it. The interface
  says so rather than simulating those surfaces.
- **No image assets exist in the dataset**, so there are no photographs in the
  UI. The visual treatment is typographic and deliberately labelled as such. No
  external image is hotlinked, and no private file path is ever rendered.
- **The two sources overlap for 20 months** (2015-01 → 2018-09). Outside that
  window the ledger contributes nothing, and the UI does not pretend otherwise.
- **Household records are sparse before 2017** (388 rows in 2015 vs 889 in 2017),
  so spend comparisons across those years are reported as counts, not rates.
- **The relationship graph is small and hand-reviewed by design** — 34 edges over
  152,321 records. The brief asked for explainable links and warned against a
  force-directed hairball; a small number of defensible edges is the honest
  outcome here, and records with no known connection are labelled as such.
- Spotify timestamps are UTC as supplied; no attempt is made to guess the
  listener's timezone.

---

## Accessibility and performance

- Semantic landmarks, labelled controls, and a skip link.
- Visible focus rings on a branded token; never removed.
- The modal traps focus, closes on Escape, and restores focus on close.
- Status is never carried by colour alone — direct vs tentative is written out.
- The chapter ribbon is an SVG whose full content is duplicated in an accessible
  list; an SVG alone is never the only explanation of a relationship.
- `prefers-reduced-motion` is honoured globally.
- Fonts are self-hosted and subset, with `font-display: swap`; the layout reserves
  space so there is no shift when they load.
- The bundle is ~252 KB of JavaScript and ~28 KB of CSS before the data files;
  the data is loaded once and expanded in memory.

---

## Credits and disclosure

- **Fonts:** [Fraunces](https://fonts.google.com/specimen/Fraunces) (SIL Open Font
  License 1.1), [Instrument Sans](https://fonts.google.com/specimen/Instrument_Sans)
  and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains_Mono)
  (SIL Open Font License 1.1). Self-hosted as woff2 subsets.
- **Dataset:** the supplied `webrush_dataset` archives. No external data was
  fetched or invented.
- **AI disclosure:** the application contains no AI or generative model at
  runtime. No text, statistic, chapter, or connection is generated by a model in
  the browser. Chapters and their wording were authored during development and
  are validated against the data by the checks described above; the app presents
  this as curation throughout, and never claims runtime analysis.

---

## Repository layout

```
public/
  fonts/            self-hosted woff2 subsets
  data/
    receipts.json   normalized archive (152,321 records, columnar)
    story.json      chapters, edges, curated trail manifest
src/
  main.tsx          entry
  App.tsx           shell, view state, hero
  data.ts           archive loader, normalization, formatters
  selectors.ts      derived counts and lookups
  types.ts          data contracts
  tokens.css        design tokens
  fonts.css         @font-face + display type scale
  globals.css       layout and components
  components/
    ChapterAtlas.tsx   chapter catalogue + ribbon
    ThreadView.tsx     Follow the Thread
    Explorer.tsx       searchable archive
    ReceiptModal.tsx   source record detail
rendercheck.mjs     data + build integrity assertions
HACKATHON_STATE.md  working state, blockers, attempt ledger
```

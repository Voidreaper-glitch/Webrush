# AFTERPRINT — HACKATHON STATE

Single source of truth for scope, blockers, and next actions.
Last updated: 2026-09-20 (session 1).

## Event
- **Deliverable:** AFTERPRINT — Your life, between the lines.
- **Problem statement:** “Your Life, In Receipts.”
- **Constraints:** frontend-only, no backend/DB/serverless/SSR/auth, static host,
  browser-side computation, build tools allowed.
- **Deadline:** 6 hours from start. Started 2026-09-20 ~04:55 UTC.
- **Submissions:** user submits manually to FAIE. I produce build + commit only.

## Authorised decisions (from the user)
1. Fraud file `archive (2)/Augmented_IndiaTransactMultiFacet2024.*` **excluded** —
   synthetic multi-holder data (1,330 card numbers, 1,279 names, ~49% is_fraud=1).
   Documented in README, not used for narrative.
2. **One person, two sources** — Spotify + household ledger as a single archive.
3. **Static build, manual deploy, no GSAP** — pure CSS motion only.
4. **User submits FAIE manually.**

## Completed scope
- [x] Full dataset analysis from the real CSVs (no sampling, no retyping).
- [x] Normalization pipeline → columnar, dictionary-compressed JSON.
- [x] Validated story manifest: 4 chapters, 34 edges, 18 trail nodes.
- [x] Integrity gate: 0 failures (see `/tmp/integrity.py`).
- [x] Vite + React 19 + TypeScript strict scaffold.
- [x] Design tokens, self-hosted variable fonts (Fraunces / Instrument Sans / JetBrains Mono).
- [x] Chapter Atlas (ribbon + catalogue cards).
- [x] Follow the Thread (clue rail, evidence panel, breadcrumbs, Back/Reset).
- [x] Receipt Explorer (search, filters, live count, scope clearing, no-results state).
- [x] Receipt detail modal (focus trap, Escape, focus restore).
- [x] Smoke + render checks (13 assertions, all passing).
- [x] Fixed: React error #310 (hooks after early return) — the white-screen cause.

## Data findings (verified)
| Source | Rows | Span | Notes |
|---|---|---|---|
| `archive/spotify_history.csv` | 149,860 | 2013-07-08 → 2024-12-15 UTC | 11 fields, 0 invalid dates |
| `archive (1)/Daily Household Transactions.csv` | 2,461 | 2015-01-01 → 2018-09-20 | INR, 635 blank subcategory, 521 blank note |
| `archive (2)/Augmented_IndiaTransactMultiFacet2024.*` | 10,267 | 2022-04 → 2024-04 | EXCLUDED — not one person |

**Archive total: 152,321 records.** Overlap window between the two sources: 2015-01 → 2018-09.

Chapters (recomputed from source rows, cover 100% of plays):
| # | Title | Span | Plays | Artists | Skip |
|---|---|---|---|---|---|
| 1 | First Play to Obsession | 2013-07-08 → 2016-12-31 | 9,430 | 938 | 26.2% |
| 2 | The Beatles Regime | 2017-01-01 → 2018-12-31 | 41,137 | 781 | 0.0% |
| 3 | The Lockdown Divide | 2019-01-01 → 2021-07-31 | 53,538 | 1,515 | 0.0% |
| 4 | A Second Language | 2021-08-20 → 2024-12-15 | 45,755 | 2,770 | 11.8% |

## Environment blockers (IMPORTANT)
- `C:\...\Webrush` is a **Windows** path. npm there resolves win32 optional deps
  (`@rollup/rollup-win32-*`), so `vite build` **cannot run from the project dir in WSL**.
- Workaround in use: build in `/tmp/apbuild` (Linux-native), copy `dist/` back.
- The user runs `npm install && npm run build` on **Windows** where it works natively
  (Windows rollup binding is the correct one there).
- Hermes browser automation tool is **not available** in this environment. Browser
  evidence is produced with system headless Chromium + `--dump-dom` + console capture.

## Commands
```bash
# data pipeline (regenerate the archive bundle) — needs pandas
/tmp/dsvenv/bin/python /tmp/pipeline1.py   # receipts.json
/tmp/dsvenv/bin/python /tmp/pipeline3.py   # story.json chapters + edges
/tmp/dsvenv/bin/python /tmp/pipeline4.py   # trails
/tmp/dsvenv/bin/python /tmp/integrity.py   # gate: must print FAILURES: 0

# app
cd "/mnt/c/Users/izaza/Documents/Izaz/Webrush"
npx tsc --noEmit                 # must be clean
npm run build                    # on Windows
node rendercheck.mjs             # 13 assertions vs a served dist
```

## URLs
- Local preview (WSL): http://localhost:4175/ (from `dist/` via a static server)
- GitHub: https://github.com/Voidreaper-glitch/Webrush
- Live host: **not yet configured** — user deploys manually.

## Attempt ledger
| Attempt | Time | Commit | Live URL | Status |
|---|---|---|---|---|
| — | — | — | — | not submitted; user submits manually |

## Last verified checks
- `tsc --noEmit`: clean.
- `vite build`: succeeds (251 KB JS / 18 KB CSS before font + data).
- `rendercheck.mjs`: 13/13 pass — totals reconcile, chapter counts match source,
  chapters cover 149,860/149,860 plays, all trail and edge IDs exist.
- Headless Chromium render: **fixed** — was React #310, now renders.

## Next three actions
1. Confirm the app renders populated in headless Chromium after the redesign.
2. Run the responsive/traffic checks at 390 / 768 / 1440 px and fix overflow.
3. Write README (problem, live URL, six requirements mapping, dataset handling,
   relationship rules, observation vs interpretation, limitations, credits).
